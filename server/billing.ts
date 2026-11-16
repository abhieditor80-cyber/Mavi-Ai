import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { payments, subscriptionPlans, userSubscriptions } from '../src/db/schema.ts';
import { getNextResetDate, logActivity } from '../src/db/repository.ts';

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createRazorpaySubscriptionOrder(input: {
  userId: number;
  email: string;
  planId?: string;
}) {
  const targetPlanId = input.planId === 'unlimited' || !input.planId ? 'unlimited' : input.planId;
  if (targetPlanId !== 'unlimited') {
    throw new Error('Only the MAVI UNLIMITED subscription plan is available.');
  }

  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, 'unlimited'));

  if (!plan) {
    throw new Error('MAVI UNLIMITED subscription plan was not found.');
  }

  if (plan.priceInr <= 0) {
    throw new Error('Subscription price must be greater than ₹0.');
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return {
      configured: false as const,
      plan,
      message:
        'Razorpay checkout requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server environment secrets. No payment was charged.',
    };
  }

  const amountPaise = plan.priceInr * 100;
  const authToken = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const receipt = `mavi_${input.userId}_${Date.now()}`;

  const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        userId: String(input.userId),
        planId: plan.id,
        email: input.email,
      },
    }),
  });

  if (!rzpResponse.ok) {
    const errText = await rzpResponse.text();
    throw new Error(`Razorpay order creation failed: ${errText}`);
  }

  const order = (await rzpResponse.json()) as {
    id: string;
    amount: number;
    currency: string;
  };

  const invoiceNumber = `MAVI-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  await db.insert(payments).values({
    userId: input.userId,
    planId: plan.id,
    amountInr: plan.priceInr,
    currency: 'INR',
    status: 'created',
    razorpayOrderId: order.id,
    invoiceNumber,
  });

  await logActivity({
    userId: input.userId,
    category: 'billing',
    action: 'razorpay_order_created',
    detail: `Created Razorpay order ${order.id} for ${plan.name} (₹${plan.priceInr})`,
  });

  return {
    configured: true as const,
    keyId,
    orderId: order.id,
    amountPaise: order.amount,
    currency: order.currency,
    plan,
    invoiceNumber,
  };
}

export function verifyRazorpayPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(input.signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function activateVerifiedPayment(input: {
  userId: number;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const valid = verifyRazorpayPaymentSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
  });

  if (!valid) {
    throw new Error('Payment signature verification failed. Subscription was not activated.');
  }

  const [paymentRow] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, input.orderId));

  if (!paymentRow || paymentRow.userId !== input.userId) {
    throw new Error('Payment order record not found for this account.');
  }

  await db
    .update(payments)
    .set({
      status: 'paid',
      razorpayPaymentId: input.paymentId,
      razorpaySignature: input.signature,
    })
    .where(eq(payments.id, paymentRow.id));

  const now = new Date();
  const nextEnd = getNextResetDate(now);

  await db
    .insert(userSubscriptions)
    .values({
      userId: input.userId,
      planId: paymentRow.planId,
      status: 'active',
      razorpayOrderId: input.orderId,
      currentPeriodStart: now,
      currentPeriodEnd: nextEnd,
      cancelAtPeriodEnd: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userSubscriptions.userId,
      set: {
        planId: paymentRow.planId,
        status: 'active',
        razorpayOrderId: input.orderId,
        currentPeriodStart: now,
        currentPeriodEnd: nextEnd,
        cancelAtPeriodEnd: false,
        updatedAt: now,
      },
    });

  await logActivity({
    userId: input.userId,
    category: 'billing',
    action: 'subscription_activated',
    detail: `Verified payment ${input.paymentId} and activated plan ${paymentRow.planId}`,
  });

  return {
    planId: paymentRow.planId,
    invoiceNumber: paymentRow.invoiceNumber,
  };
}
