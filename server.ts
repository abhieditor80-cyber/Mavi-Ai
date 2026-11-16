import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { desc, eq, and } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  advertisements,
  aiProviders,
  payments,
  storedFiles,
  subscriptionPlans,
  users,
  userSubscriptions,
} from './src/db/schema.ts';
import {
  deleteConversationForUser,
  ensureSeeded,
  getAdminOverview,
  getConversationsForUser,
  getSubscriptionPlans,
  getUserAccountSnapshot,
  logActivity,
  recordAiUsage,
  saveConversationDb,
} from './src/db/repository.ts';
import {
  optionalAuth,
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';
import {
  streamFromConfiguredProviders,
  type GatewayAttachment,
  type GatewayMessage,
  type GatewayMode,
  type GatewayModelId,
} from './server/ai-gateway.ts';
import { testOllamaConnection } from './server/ollama.ts';
import {
  activateVerifiedPayment,
  createRazorpaySubscriptionOrder,
  verifyRazorpayWebhookSignature,
} from './server/billing.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const STORAGE_ROOT = path.resolve(__dirname, '.mavi-storage');

// Simple in-memory sliding-window rate limiter per IP/UID
const rateBuckets = new Map<string, number[]>();
function checkRateLimit(key: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

async function startServer() {
  const app = express();

  // Preserve raw body for Razorpay webhook signature verification
  app.use(
    '/api/billing/webhook',
    express.raw({ type: 'application/json' }),
  );
  app.use(express.json({ limit: '25mb' }));

  // Health & Provider Status (never exposes internal endpoints, ports, or credentials)
  app.get('/api/health', async (_req, res) => {
    try {
      await ensureSeeded();
      const providers = await db.select().from(aiProviders);
      res.json({
        ok: true,
        service: 'MAVI AI',
        localAiConfigured: true,
        razorpayConfigured: Boolean(
          process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
        ),
        providers: providers.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          enabled: p.enabled,
          healthStatus: p.healthStatus,
        })),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Health check error';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // Test Local AI Connection (Server-side probe to Ollama)
  app.post('/api/ai/test-connection', async (req, res) => {
    const rateKey = `test:${req.ip || 'anon'}`;
    if (!checkRateLimit(rateKey, 20, 60_000)) {
      res.status(429).json({
        ok: false,
        status: 'offline',
        message: 'Too many connection checks. Please wait a moment and try again.',
      });
      return;
    }

    try {
      let ollamaRow: { endpointUrl?: string | null; defaultModel?: string | null } | undefined;
      try {
        await ensureSeeded();
        const [row] = await db
          .select()
          .from(aiProviders)
          .where(eq(aiProviders.id, 'ollama'));
        ollamaRow = row;
      } catch {
        // Proceed with server env/default config if DB is unavailable locally
      }

      const result = await testOllamaConnection(ollamaRow);

      try {
        await db
          .update(aiProviders)
          .set({
            healthStatus: result.status === 'connected' ? 'healthy' : 'degraded',
            lastError: result.ok ? null : result.message,
            updatedAt: new Date(),
          })
          .where(eq(aiProviders.id, 'ollama'));
      } catch {
        // Ignore telemetry update failures if DB is unavailable
      }

      res.json(result);
    } catch {
      res.json({
        ok: false,
        status: 'offline',
        provider: 'Local Ollama',
        modelReady: false,
        message:
          'Local Ollama AI server is currently offline or unreachable. Please start Ollama and try again.',
      });
    }
  });

  // Public Subscription Plans
  app.get('/api/plans', async (_req, res) => {
    try {
      const plans = await getSubscriptionPlans();
      res.json({ plans });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load plans';
      res.status(500).json({ error: msg });
    }
  });

  // Ad-Free Single-Plan Policy (MAVI UNLIMITED includes No Advertisements)
  app.get('/api/ads', optionalAuth, async (_req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const plans = await getSubscriptionPlans();
      const unlimitedPlan = plans[0];
      if (!unlimitedPlan?.adsEnabled) {
        res.json({ adsEnabled: false, ads: [] });
        return;
      }
      const activeAds = await db
        .select()
        .from(advertisements)
        .where(eq(advertisements.active, true));
      res.json({ adsEnabled: true, ads: activeAds });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load ads';
      res.status(500).json({ error: msg });
    }
  });

  // Authenticated Account & Usage Snapshot
  app.get('/api/account', requireAuth, async (req: AuthRequest, res) => {
    try {
      const snapshot = await getUserAccountSnapshot(req.dbUser!.id);
      res.json(snapshot);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch account';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/account/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const displayName =
        typeof req.body?.displayName === 'string'
          ? req.body.displayName.trim().slice(0, 80)
          : undefined;
      const avatarUrl =
        typeof req.body?.avatarUrl === 'string'
          ? req.body.avatarUrl.slice(0, 2_000_000)
          : undefined;
      const memoryEnabled =
        typeof req.body?.memoryEnabled === 'boolean'
          ? req.body.memoryEnabled
          : undefined;
      const memoryNotes =
        typeof req.body?.memoryNotes === 'string'
          ? req.body.memoryNotes.slice(0, 1200)
          : undefined;

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (displayName) patch.displayName = displayName;
      if (avatarUrl !== undefined) patch.avatarUrl = avatarUrl;
      if (memoryEnabled !== undefined) patch.memoryEnabled = memoryEnabled;
      if (memoryNotes !== undefined) patch.memoryNotes = memoryNotes;

      await db.update(users).set(patch).where(eq(users.id, req.dbUser!.id));
      const snapshot = await getUserAccountSnapshot(req.dbUser!.id);
      res.json(snapshot);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update profile';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/account', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser!.id;
      const userDir = path.join(STORAGE_ROOT, String(userId));
      if (fs.existsSync(userDir)) {
        fs.rmSync(userDir, { recursive: true, force: true });
      }
      await db.delete(users).where(eq(users.id, userId));
      res.json({ deleted: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete account';
      res.status(500).json({ error: msg });
    }
  });

  // Persistent Chat History
  app.get('/api/chats', optionalAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.dbUser) {
        res.json({ chats: [] });
        return;
      }
      const chats = await getConversationsForUser(req.dbUser.id);
      res.json({ chats });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to load chats';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/chats', optionalAuth, async (req: AuthRequest, res) => {
    const incoming = req.body?.chat as
      | {
          id: string;
          title: string;
          mode: string;
          modelId: string;
          messages: unknown[];
        }
      | undefined;
    if (!incoming || !incoming.id || !Array.isArray(incoming.messages)) {
      res.status(400).json({ error: 'Invalid conversation payload.' });
      return;
    }
    if (!req.dbUser) {
      res.json({ chat: incoming, persisted: 'local' });
      return;
    }
    try {
      await saveConversationDb({
        id: incoming.id,
        userId: req.dbUser.id,
        title: incoming.title || 'New Conversation',
        mode: incoming.mode || 'general',
        modelId: incoming.modelId || 'mavi-assistant-1.0',
        messages: incoming.messages,
      });
      res.json({ chat: incoming, persisted: 'postgres' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to persist chat';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/chats/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteConversationForUser(String(req.params.id), req.dbUser!.id);
      res.json({ deleted: req.params.id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete chat';
      res.status(500).json({ error: msg });
    }
  });

  // Storage & Files (Quota-enforced per plan)
  app.get('/api/files', requireAuth, async (req: AuthRequest, res) => {
    try {
      const files = await db
        .select()
        .from(storedFiles)
        .where(eq(storedFiles.userId, req.dbUser!.id))
        .orderBy(desc(storedFiles.createdAt));
      res.json({ files });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to list files';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/files/upload', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { fileName, mimeType, kind, dataBase64 } = (req.body ?? {}) as {
        fileName?: string;
        mimeType?: string;
        kind?: string;
        dataBase64?: string;
      };
      if (!fileName || !dataBase64) {
        res.status(400).json({ error: 'fileName and dataBase64 are required.' });
        return;
      }

      const buffer = Buffer.from(dataBase64, 'base64');
      const maxSingleFileBytes = 15 * 1024 * 1024;
      if (buffer.length <= 0 || buffer.length > maxSingleFileBytes) {
        res.status(400).json({ error: 'File must be between 1 byte and 15 MB.' });
        return;
      }

      const snapshot = await getUserAccountSnapshot(req.dbUser!.id);
      if (snapshot.plan?.featureFlagsJson && snapshot.plan.featureFlagsJson.fileStorage === false) {
        res.status(403).json({
          error: 'File storage is currently disabled by your workspace administrator.',
        });
        return;
      }

      const quotaBytes = (snapshot.plan?.storageQuotaMb ?? 2048) * 1024 * 1024;
      if (snapshot.usage.storageUsedBytes + buffer.length > quotaBytes) {
        res.status(429).json({
          errorCode: 'STORAGE_SAFEGUARD_REACHED',
          error: `Workspace disk safeguard (${snapshot.plan?.storageQuotaMb ?? 2048} MB) reached. Please remove older files before uploading new ones.`,
        });
        return;
      }

      const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const userDir = path.join(STORAGE_ROOT, String(req.dbUser!.id));
      fs.mkdirSync(userDir, { recursive: true });
      const targetPath = path.join(userDir, `${fileId}_${safeName}`);
      fs.writeFileSync(targetPath, buffer);

      const [inserted] = await db
        .insert(storedFiles)
        .values({
          id: fileId,
          userId: req.dbUser!.id,
          fileName: safeName,
          mimeType: mimeType || 'application/octet-stream',
          kind: kind || 'document',
          sizeBytes: buffer.length,
          storagePath: targetPath,
        })
        .returning();

      await logActivity({
        userId: req.dbUser!.id,
        category: 'storage',
        action: 'file_uploaded',
        detail: `Uploaded ${safeName} (${buffer.length} bytes)`,
      });

      res.json({ file: inserted });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'File upload failed';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/files/:id/download', requireAuth, async (req: AuthRequest, res) => {
    try {
      const [fileRow] = await db
        .select()
        .from(storedFiles)
        .where(
          and(
            eq(storedFiles.id, String(req.params.id)),
            eq(storedFiles.userId, req.dbUser!.id),
          ),
        );
      if (!fileRow || !fs.existsSync(fileRow.storagePath)) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      res.setHeader('Content-Type', fileRow.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileRow.fileName}"`,
      );
      fs.createReadStream(fileRow.storagePath).pipe(res);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Download failed';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/files/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const [fileRow] = await db
        .select()
        .from(storedFiles)
        .where(
          and(
            eq(storedFiles.id, String(req.params.id)),
            eq(storedFiles.userId, req.dbUser!.id),
          ),
        );
      if (!fileRow) {
        res.status(404).json({ error: 'File not found.' });
        return;
      }
      if (fs.existsSync(fileRow.storagePath)) {
        fs.unlinkSync(fileRow.storagePath);
      }
      await db.delete(storedFiles).where(eq(storedFiles.id, fileRow.id));
      res.json({ deleted: fileRow.id });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Delete file failed';
      res.status(500).json({ error: msg });
    }
  });

  // Streaming AI Gateway (/api/chat)
  app.post('/api/chat', optionalAuth, async (req: AuthRequest, res) => {
    const rateKey = req.dbUser ? `u:${req.dbUser.id}` : `ip:${req.ip || 'anon'}`;
    if (!checkRateLimit(rateKey, 35, 60_000)) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please pause briefly and try again.',
      });
      return;
    }

    const {
      messages = [],
      modelId = 'mavi-assistant-1.0',
      mode = 'general',
      attachments = [],
    } = (req.body ?? {}) as {
      messages?: GatewayMessage[];
      modelId?: GatewayModelId;
      mode?: GatewayMode;
      attachments?: GatewayAttachment[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    const allowedTier: 'standard' | 'advanced' | 'pro' = 'pro';
    let memoryNotes = '';

    // Enforce admin feature toggles (without arbitrary monthly message/voice credit caps)
    try {
      const plans = await getSubscriptionPlans();
      const flags = plans[0]?.featureFlagsJson;
      if (flags) {
        if (!flags.aiTextChat && mode === 'general') {
          res.status(403).json({ error: 'AI text chat is currently paused by the administrator.' });
          return;
        }
        if (mode === 'image' && !flags.imageGeneration) {
          res.status(403).json({ error: 'AI image studio is currently paused by the administrator.' });
          return;
        }
        if (mode === 'deep_research' && !flags.aiResearch) {
          res.status(403).json({ error: 'AI research is currently paused by the administrator.' });
          return;
        }
        if (mode === 'web_search' && !flags.webSearch) {
          res.status(403).json({ error: 'Web search is currently paused by the administrator.' });
          return;
        }
        if (mode === 'coding' && !flags.codingAssistant) {
          res.status(403).json({ error: 'AI coding assistant is currently paused by the administrator.' });
          return;
        }
        if (mode === 'study' && !flags.studyAssistant) {
          res.status(403).json({ error: 'AI study assistant is currently paused by the administrator.' });
          return;
        }
        if (mode === 'data_analyst' && !flags.dataAnalysis) {
          res.status(403).json({ error: 'Data analysis tools are currently paused by the administrator.' });
          return;
        }
        if (attachments.some((a) => a.kind === 'pdf') && !flags.pdfAnalysis) {
          res.status(403).json({ error: 'PDF analysis is currently paused by the administrator.' });
          return;
        }
      }

      if (req.dbUser && req.dbUser.memoryEnabled && req.dbUser.memoryNotes) {
        if (!flags || flags.aiMemory) {
          memoryNotes = req.dbUser.memoryNotes;
        }
      }
    } catch (err) {
      console.error('Feature check error:', err);
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const result = await streamFromConfiguredProviders({
        messages,
        attachments,
        modelId,
        mode,
        allowedTier,
        memoryNotes,
        callbacks: {
          onProviderSelected: (providerName) => {
            sendEvent({ type: 'meta', provider: providerName });
          },
          onChunk: (text) => {
            sendEvent({ type: 'chunk', text });
          },
          onSources: (sources) => {
            sendEvent({ type: 'sources', sources });
          },
        },
      });

      if (req.dbUser) {
        await recordAiUsage({
          userId: req.dbUser.id,
          kind: mode === 'image' ? 'image' : 'message',
          tokens: result.tokensEstimated,
        });
      }

      sendEvent({ type: 'done', providerId: result.providerId });
      res.end();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI Gateway error';
      sendEvent({ type: 'error', error: msg });
      res.end();
    }
  });

  // Razorpay Billing Endpoints
  app.post('/api/billing/create-order', requireAuth, async (req: AuthRequest, res) => {
    try {
      const planId = String(req.body?.planId || '');
      const result = await createRazorpaySubscriptionOrder({
        userId: req.dbUser!.id,
        email: req.dbUser!.email,
        planId,
      });
      if (!result.configured) {
        res.status(501).json(result);
        return;
      }
      res.json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Order creation failed';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/billing/verify-payment', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        (req.body ?? {}) as Record<string, string>;
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({ error: 'Missing Razorpay verification parameters.' });
        return;
      }
      const activated = await activateVerifiedPayment({
        userId: req.dbUser!.id,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
      res.json({ verified: true, ...activated });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : 'Payment verification failed';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/billing/webhook', async (req, res) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      res.status(400).json({ error: 'Invalid webhook signature.' });
      return;
    }

    try {
      const event = JSON.parse(rawBody.toString('utf8')) as {
        event?: string;
        payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
      };
      const orderId = event.payload?.payment?.entity?.order_id;
      const paymentId = event.payload?.payment?.entity?.id;

      if (event.event === 'payment.failed' && orderId) {
        await db
          .update(payments)
          .set({ status: 'failed', razorpayPaymentId: paymentId ?? null })
          .where(eq(payments.razorpayOrderId, orderId));
      } else if (event.event === 'payment.captured' && orderId) {
        const [pRow] = await db
          .select()
          .from(payments)
          .where(eq(payments.razorpayOrderId, orderId));
        if (pRow && pRow.status !== 'paid') {
          await db
            .update(payments)
            .set({ status: 'paid', razorpayPaymentId: paymentId ?? null })
            .where(eq(payments.id, pRow.id));
          await db
            .update(userSubscriptions)
            .set({ planId: pRow.planId, status: 'active', updatedAt: new Date() })
            .where(eq(userSubscriptions.userId, pRow.userId));
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Webhook handling error:', err);
      res.status(500).json({ error: 'Webhook processing error' });
    }
  });

  app.post('/api/billing/cancel', requireAuth, async (req: AuthRequest, res) => {
    try {
      await db
        .update(userSubscriptions)
        .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
        .where(eq(userSubscriptions.userId, req.dbUser!.id));
      await logActivity({
        userId: req.dbUser!.id,
        category: 'billing',
        action: 'subscription_cancel_scheduled',
        detail: 'User scheduled MAVI UNLIMITED cancellation at period end',
      });
      res.json({ cancelAtPeriodEnd: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Cancellation failed';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/billing/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rows = await db
        .select()
        .from(payments)
        .where(eq(payments.userId, req.dbUser!.id))
        .orderBy(desc(payments.createdAt));
      res.json({ payments: rows });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'History failed';
      res.status(500).json({ error: msg });
    }
  });

  // Admin RBAC Routes
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    try {
      const data = await getAdminOverview();
      res.json(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Admin overview failed';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/plans/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const planId = String(req.params.id || 'unlimited');
      if (planId !== 'unlimited') {
        res.status(400).json({ error: 'Only the single MAVI UNLIMITED plan can be configured.' });
        return;
      }
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.priceInr === 'number' && Number.isFinite(body.priceInr)) {
        patch.priceInr = Math.max(1, Math.round(body.priceInr));
      }
      if (typeof body.storageQuotaMb === 'number' && Number.isFinite(body.storageQuotaMb)) {
        patch.storageQuotaMb = Math.max(128, Math.round(body.storageQuotaMb));
      }
      if (typeof body.adsEnabled === 'boolean') {
        patch.adsEnabled = body.adsEnabled;
      }
      if (typeof body.tagline === 'string' && body.tagline.trim()) {
        patch.tagline = body.tagline.trim().slice(0, 140);
      }
      if (typeof body.description === 'string' && body.description.trim()) {
        patch.description = body.description.trim().slice(0, 280);
      }
      if (body.featureFlagsJson && typeof body.featureFlagsJson === 'object') {
        const currentPlans = await getSubscriptionPlans();
        const existingFlags = currentPlans[0]?.featureFlagsJson ?? {};
        const nextFlags: Record<string, boolean> = { ...existingFlags };
        for (const [k, v] of Object.entries(body.featureFlagsJson as Record<string, unknown>)) {
          if (typeof v === 'boolean') {
            nextFlags[k] = v;
          }
        }
        patch.featureFlagsJson = nextFlags;
      }

      await db
        .update(subscriptionPlans)
        .set(patch)
        .where(eq(subscriptionPlans.id, 'unlimited'));

      await logActivity({
        userId: req.dbUser!.id,
        category: 'admin',
        action: 'plan_updated',
        detail: `Updated MAVI UNLIMITED configuration`,
      });
      const plans = await getSubscriptionPlans();
      res.json({ plans });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Plan update failed';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/providers/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const providerId = String(req.params.id);
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
      if (typeof body.priority === 'number') patch.priority = body.priority;
      if (typeof body.endpointUrl === 'string') patch.endpointUrl = body.endpointUrl;
      if (typeof body.defaultModel === 'string') patch.defaultModel = body.defaultModel;

      await db
        .update(aiProviders)
        .set(patch)
        .where(eq(aiProviders.id, providerId));

      await logActivity({
        userId: req.dbUser!.id,
        category: 'admin',
        action: 'provider_updated',
        detail: `Updated AI provider ${providerId}`,
      });
      const providers = await db.select().from(aiProviders);
      res.json({ providers });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Provider update failed';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/ads', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { title, body, ctaLabel, ctaUrl, placement } = req.body ?? {};
      if (!title || !body) {
        res.status(400).json({ error: 'Title and body are required.' });
        return;
      }
      const [created] = await db
        .insert(advertisements)
        .values({
          title: String(title),
          body: String(body),
          ctaLabel: String(ctaLabel || 'Learn More'),
          ctaUrl: String(ctaUrl || '#pricing'),
          placement: String(placement || 'workspace_banner'),
          active: true,
        })
        .returning();
      res.json({ ad: created });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create ad';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/ads/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const adId = Number(req.params.id);
      const active = Boolean(req.body?.active);
      await db
        .update(advertisements)
        .set({ active, updatedAt: new Date() })
        .where(eq(advertisements.id, adId));
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update ad';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/admin/ads/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      await db.delete(advertisements).where(eq(advertisements.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete ad';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/users/:id/plan', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const targetUserId = Number(req.params.id);
      const status = String(req.body?.status || 'active');
      const allowedStatuses = ['active', 'inactive', 'cancelled'];
      const safeStatus = allowedStatuses.includes(status) ? status : 'inactive';
      await db
        .update(userSubscriptions)
        .set({
          planId: 'unlimited',
          status: safeStatus,
          cancelAtPeriodEnd: safeStatus === 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(userSubscriptions.userId, targetUserId));
      await logActivity({
        userId: req.dbUser!.id,
        category: 'admin',
        action: 'subscriber_status_changed',
        detail: `Admin set MAVI UNLIMITED status=${safeStatus} for user #${targetUserId}`,
      });
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update subscriber';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/payments/:id/refund', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const paymentId = Number(req.params.id);
      await db
        .update(payments)
        .set({ status: 'refunded' })
        .where(eq(payments.id, paymentId));
      await logActivity({
        userId: req.dbUser!.id,
        category: 'admin',
        action: 'payment_refunded',
        detail: `Marked payment #${paymentId} as refunded`,
      });
      res.json({ ok: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Refund update failed';
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAVI AI SaaS server running at http://localhost:${PORT}`);
  });
}

startServer();
