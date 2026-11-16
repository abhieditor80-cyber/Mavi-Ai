import { desc, eq, sql, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  activityLogs,
  advertisements,
  aiProviders,
  conversationsTable,
  payments,
  storedFiles,
  subscriptionPlans,
  usageTracking,
  users,
  userSubscriptions,
} from './schema.ts';

let seededOnce = false;

export function getCurrentPeriodKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getNextResetDate(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

export const DEFAULT_FEATURE_FLAGS = {
  aiTextChat: true,
  imageGeneration: true,
  voiceChat: true,
  aiResearch: true,
  webSearch: true,
  pdfAnalysis: true,
  codingAssistant: true,
  studyAssistant: true,
  diagramGeneration: true,
  writingAssistant: true,
  dataAnalysis: true,
  workspaces: true,
  aiMemory: true,
  fileStorage: true,
  multilingualTelugu: true,
  customWallpapers: true,
};

export const UNLIMITED_PLAN_BENEFITS: string[] = [
  'Unlimited AI text conversations & messages',
  'Access to available advanced AI models',
  'AI image & vector visual generation',
  'Voice chat dictation & audio input',
  'AI Deep Research & synthesis',
  'Web search grounding (when provider supports it)',
  'PDF and document analysis',
  'AI coding assistant',
  'AI study assistant (guides, flashcards, quizzes)',
  'AI diagram generation',
  'AI writing assistant',
  'Data analysis tools',
  'Projects and workspaces',
  'Conversation history & persistent sync',
  'AI memory across sessions',
  'File uploads & persistent storage',
  'English, Telugu and Tenglish support',
  'Light Liquid Glass & Dark Liquid Glass themes',
  'Custom wallpapers',
  'No advertisements',
];

export async function ensureSeeded(): Promise<void> {
  if (seededOnce) return;
  try {
    // 1. Ensure the single MAVI UNLIMITED plan exists (never overwrite admin edits if already present)
    await db
      .insert(subscriptionPlans)
      .values({
        id: 'unlimited',
        name: 'MAVI UNLIMITED',
        tagline: 'One Plan. All Features. Unlimited Possibilities.',
        priceInr: 199,
        monthlyMessageCredits: 0,
        monthlyImageCredits: 0,
        monthlyVoiceMinutes: 0,
        storageQuotaMb: 2048, // Server technical disk safeguard (2 GB per workspace)
        adsEnabled: false,
        allowedModelTier: 'pro',
        priorityProcessing: true,
        isHighlighted: true,
        description:
          'Everything you need in one affordable AI subscription. No confusing tiers, no separate feature packages.',
        featuresJson: UNLIMITED_PLAN_BENEFITS,
        featureFlagsJson: DEFAULT_FEATURE_FLAGS,
      })
      .onConflictDoNothing();

    // 2. Safely migrate legacy 3-tier references without deleting users or payment history,
    // and without auto-charging or modifying active paid billing cycles.
    const legacyPlanIds = ['free', 'go', 'plus', 'pro'];
    const existingPlans = await db.select({ id: subscriptionPlans.id }).from(subscriptionPlans);
    const hasLegacyPlans = existingPlans.some((p) => legacyPlanIds.includes(p.id));

    if (hasLegacyPlans) {
      // Preserve every payment record (amountInr, invoiceNumber, status, timestamps untouched)
      for (const legacyId of legacyPlanIds) {
        await db
          .update(payments)
          .set({ planId: 'unlimited' })
          .where(eq(payments.planId, legacyId));
      }

      // Migrate previously paid subscribers (GO / PLUS / PRO) to MAVI UNLIMITED without changing their billing cycle or charging them
      for (const paidLegacyId of ['go', 'plus', 'pro']) {
        await db
          .update(userSubscriptions)
          .set({ planId: 'unlimited', updatedAt: new Date() })
          .where(eq(userSubscriptions.planId, paidLegacyId));
      }

      // Migrate legacy Free accounts to unbilled inactive status on MAVI UNLIMITED (never auto-billed)
      await db
        .update(userSubscriptions)
        .set({ planId: 'unlimited', status: 'inactive', updatedAt: new Date() })
        .where(eq(userSubscriptions.planId, 'free'));

      // Remove legacy multi-tier plans now that FKs point cleanly to 'unlimited'
      for (const legacyId of legacyPlanIds) {
        await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, legacyId));
      }
    }

    // 3. Ensure all legacy advertisements are deactivated (MAVI UNLIMITED is ad-free)
    await db
      .update(advertisements)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(advertisements.active, true));

    // 4. Ensure AI providers exist (Local Ollama primary)
    const existingProviders = await db.select().from(aiProviders);
    if (existingProviders.length === 0) {
      await db
        .insert(aiProviders)
        .values([
          {
            id: 'ollama',
            displayName: 'Ollama Local Models',
            enabled: true,
            priority: 1,
            endpointUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
            defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:3b',
            healthStatus: 'unknown',
          },
          {
            id: 'gemini',
            displayName: 'Google Gemini API',
            enabled: false,
            priority: 2,
            endpointUrl: 'https://generativelanguage.googleapis.com',
            defaultModel: 'gemini-4-hydrogen',
            healthStatus: process.env.GEMINI_API_KEY ? 'healthy' : 'unconfigured',
          },
          {
            id: 'openai_compat',
            displayName: 'OpenAI-Compatible Gateway',
            enabled: false,
            priority: 3,
            endpointUrl: process.env.COMPAT_AI_BASE_URL || '',
            defaultModel: process.env.COMPAT_AI_MODEL || 'gpt-4o-mini',
            healthStatus:
              process.env.COMPAT_AI_BASE_URL && process.env.COMPAT_AI_API_KEY
                ? 'healthy'
                : 'unconfigured',
          },
        ])
        .onConflictDoNothing();
    }

    seededOnce = true;
  } catch (error) {
    console.error('Failed to ensure seed data:', error);
    throw new Error('Database initialization failed.', { cause: error });
  }
}

export async function getOrCreateUser(input: {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  await ensureSeeded();
  try {
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const shouldBootstrapAdmin = adminEmails.includes(input.email.toLowerCase());

    const inserted = await db
      .insert(users)
      .values({
        uid: input.uid,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        role: shouldBootstrapAdmin ? 'admin' : 'user',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: input.email,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = inserted[0];

    // Ensure default subscription record exists on the single MAVI UNLIMITED plan (inactive until subscribed)
    const existingSub = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, user.id));

    if (existingSub.length === 0) {
      await db
        .insert(userSubscriptions)
        .values({
          userId: user.id,
          planId: 'unlimited',
          status: 'inactive',
          currentPeriodStart: new Date(),
          currentPeriodEnd: getNextResetDate(),
        })
        .onConflictDoNothing();
    }

    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getSubscriptionPlans() {
  await ensureSeeded();
  try {
    const rows = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, 'unlimited'));
    return rows.map((r) => ({
      ...r,
      featureFlagsJson: {
        ...DEFAULT_FEATURE_FLAGS,
        ...(r.featureFlagsJson ?? {}),
      },
    }));
  } catch (error) {
    console.error('Failed to fetch subscription plans:', error);
    throw new Error('Unable to load subscription plan.', { cause: error });
  }
}

export async function getUserAccountSnapshot(userId: number) {
  await ensureSeeded();
  try {
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    if (!userRow) throw new Error('User not found.');

    const [subRow] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId));

    const [planRow] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, 'unlimited'));

    const normalizedPlan = planRow
      ? {
          ...planRow,
          featureFlagsJson: {
            ...DEFAULT_FEATURE_FLAGS,
            ...(planRow.featureFlagsJson ?? {}),
          },
        }
      : planRow;

    const periodKey = getCurrentPeriodKey();
    let [usageRow] = await db
      .select()
      .from(usageTracking)
      .where(and(eq(usageTracking.userId, userId), eq(usageTracking.periodKey, periodKey)));

    if (!usageRow) {
      const [created] = await db
        .insert(usageTracking)
        .values({
          userId,
          periodKey,
          resetDate: getNextResetDate(),
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        usageRow = created;
      } else {
        const [refetched] = await db
          .select()
          .from(usageTracking)
          .where(and(eq(usageTracking.userId, userId), eq(usageTracking.periodKey, periodKey)));
        usageRow = refetched;
      }
    }

    const storageRows = await db
      .select({ totalBytes: sql<number>`coalesce(sum(${storedFiles.sizeBytes}), 0)::bigint` })
      .from(storedFiles)
      .where(eq(storedFiles.userId, userId));
    const totalStorageBytes = Number(storageRows[0]?.totalBytes ?? 0);

    return {
      user: userRow,
      subscription: subRow,
      plan: normalizedPlan,
      usage: {
        ...usageRow,
        storageUsedBytes: totalStorageBytes,
      },
    };
  } catch (error) {
    console.error('Failed to load user account snapshot:', error);
    throw new Error('Unable to load account details.', { cause: error });
  }
}

export async function recordAiUsage(input: {
  userId: number;
  kind: 'message' | 'image' | 'voice';
  tokens: number;
  voiceMinutes?: number;
}) {
  const periodKey = getCurrentPeriodKey();
  try {
    await db
      .insert(usageTracking)
      .values({
        userId: input.userId,
        periodKey,
        messagesUsed: input.kind === 'message' ? 1 : 0,
        imagesUsed: input.kind === 'image' ? 1 : 0,
        voiceMinutesUsed: input.kind === 'voice' ? input.voiceMinutes ?? 1 : 0,
        tokensConsumed: input.tokens,
        resetDate: getNextResetDate(),
      })
      .onConflictDoUpdate({
        target: [usageTracking.userId, usageTracking.periodKey],
        set: {
          messagesUsed:
            input.kind === 'message'
              ? sql`${usageTracking.messagesUsed} + 1`
              : usageTracking.messagesUsed,
          imagesUsed:
            input.kind === 'image'
              ? sql`${usageTracking.imagesUsed} + 1`
              : usageTracking.imagesUsed,
          voiceMinutesUsed:
            input.kind === 'voice'
              ? sql`${usageTracking.voiceMinutesUsed} + ${input.voiceMinutes ?? 1}`
              : usageTracking.voiceMinutesUsed,
          tokensConsumed: sql`${usageTracking.tokensConsumed} + ${input.tokens}`,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to record AI usage:', error);
  }
}

export async function updateProviderTelemetry(input: {
  providerId: string;
  tokens: number;
  error?: string;
}) {
  try {
    await db
      .update(aiProviders)
      .set({
        totalRequests: sql`${aiProviders.totalRequests} + 1`,
        totalErrors: input.error
          ? sql`${aiProviders.totalErrors} + 1`
          : aiProviders.totalErrors,
        totalTokens: sql`${aiProviders.totalTokens} + ${input.tokens}`,
        healthStatus: input.error ? 'degraded' : 'healthy',
        lastError: input.error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(aiProviders.id, input.providerId));
  } catch (err) {
    console.error('Failed to update provider telemetry:', err);
  }
}

export async function logActivity(input: {
  userId?: number | null;
  category: string;
  action: string;
  detail: string;
}) {
  try {
    await db.insert(activityLogs).values({
      userId: input.userId ?? null,
      category: input.category,
      action: input.action,
      detail: input.detail,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

export async function getAdminOverview() {
  await ensureSeeded();
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allSubs = await db.select().from(userSubscriptions);
    const allPlans = await getSubscriptionPlans();
    const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
    const providers = await db.select().from(aiProviders);
    const ads = await db.select().from(advertisements).orderBy(desc(advertisements.id));
    const logs = await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(40);
    const storageAgg = await db
      .select({ totalBytes: sql<number>`coalesce(sum(${storedFiles.sizeBytes}), 0)::bigint` })
      .from(storedFiles);

    const unlimitedPlan = allPlans[0];
    const planPriceInr = unlimitedPlan?.priceInr ?? 199;

    let activeSubscribers = 0;
    let inactiveSubscribers = 0;
    let cancelledSubscribers = 0;

    for (const s of allSubs) {
      if (s.status === 'active') {
        activeSubscribers += 1;
      } else if (s.status === 'cancelled') {
        cancelledSubscribers += 1;
      } else {
        inactiveSubscribers += 1;
      }
    }

    const estimatedMonthlyRevenueInr = activeSubscribers * planPriceInr;
    const totalRequests = providers.reduce((acc, p) => acc + p.totalRequests, 0);
    const totalErrors = providers.reduce((acc, p) => acc + p.totalErrors, 0);
    const totalTokens = providers.reduce((acc, p) => acc + Number(p.totalTokens || 0), 0);

    return {
      metrics: {
        totalUsers: allUsers.length,
        activePaidSubscribers: activeSubscribers,
        inactiveSubscribers,
        cancelledSubscribers,
        monthlyRevenueInr: estimatedMonthlyRevenueInr,
        totalStorageBytes: Number(storageAgg[0]?.totalBytes ?? 0),
        totalRequests,
        totalErrors,
        totalTokens,
      },
      users: allUsers.map((u) => {
        const sub = allSubs.find((s) => s.userId === u.id);
        return {
          ...u,
          planId: 'unlimited',
          subscriptionStatus: sub?.status ?? 'inactive',
        };
      }),
      plans: allPlans,
      providers: providers.map(({ endpointUrl: _omitUrl, ...safeProvider }) => ({
        ...safeProvider,
        endpointUrl: null,
      })),
      advertisements: ads,
      payments: allPayments,
      activityLogs: logs,
    };
  } catch (error) {
    console.error('Failed to load admin overview:', error);
    throw new Error('Unable to load administrator dashboard metrics.', { cause: error });
  }
}

export async function saveConversationDb(input: {
  id: string;
  userId: number | null;
  title: string;
  mode: string;
  modelId: string;
  messages: unknown[];
}) {
  try {
    await db
      .insert(conversationsTable)
      .values({
        id: input.id,
        userId: input.userId,
        title: input.title,
        mode: input.mode,
        modelId: input.modelId,
        messagesJson: input.messages,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: conversationsTable.id,
        set: {
          title: input.title,
          mode: input.mode,
          modelId: input.modelId,
          messagesJson: input.messages,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Failed to save conversation to DB:', error);
    throw new Error('Failed to save conversation.', { cause: error });
  }
}

export async function getConversationsForUser(userId: number) {
  try {
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.userId, userId))
      .orderBy(desc(conversationsTable.updatedAt))
      .limit(60);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      mode: r.mode,
      modelId: r.modelId,
      messages: Array.isArray(r.messagesJson) ? r.messagesJson : [],
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime(),
    }));
  } catch (error) {
    console.error('Failed to load user conversations:', error);
    throw new Error('Unable to load chat history.', { cause: error });
  }
}

export async function deleteConversationForUser(id: string, userId: number) {
  try {
    await db
      .delete(conversationsTable)
      .where(and(eq(conversationsTable.id, id), eq(conversationsTable.userId, userId)));
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    throw new Error('Unable to delete conversation.', { cause: error });
  }
}
