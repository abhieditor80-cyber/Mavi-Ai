import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('MAVI Member'),
  avatarUrl: text('avatar_url'),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  memoryEnabled: boolean('memory_enabled').notNull().default(true),
  memoryNotes: text('memory_notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface MaviFeatureFlags {
  aiTextChat: boolean;
  imageGeneration: boolean;
  voiceChat: boolean;
  aiResearch: boolean;
  webSearch: boolean;
  pdfAnalysis: boolean;
  codingAssistant: boolean;
  studyAssistant: boolean;
  diagramGeneration: boolean;
  writingAssistant: boolean;
  dataAnalysis: boolean;
  workspaces: boolean;
  aiMemory: boolean;
  fileStorage: boolean;
  multilingualTelugu: boolean;
  customWallpapers: boolean;
}

export const subscriptionPlans = pgTable('subscription_plans', {
  id: text('id').primaryKey(), // 'unlimited'
  name: text('name').notNull(),
  tagline: text('tagline').notNull().default('One Plan. All Features. Unlimited Possibilities.'),
  priceInr: integer('price_inr').notNull(),
  monthlyMessageCredits: integer('monthly_message_credits').notNull().default(0),
  monthlyImageCredits: integer('monthly_image_credits').notNull().default(0),
  monthlyVoiceMinutes: integer('monthly_voice_minutes').notNull().default(0),
  storageQuotaMb: integer('storage_quota_mb').notNull().default(2048),
  adsEnabled: boolean('ads_enabled').notNull().default(false),
  allowedModelTier: text('allowed_model_tier').notNull().default('pro'),
  priorityProcessing: boolean('priority_processing').notNull().default(true),
  isHighlighted: boolean('is_highlighted').notNull().default(true),
  description: text('description').notNull(),
  featuresJson: jsonb('features_json').$type<string[]>().notNull(),
  featureFlagsJson: jsonb('feature_flags_json').$type<MaviFeatureFlags>(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSubscriptions = pgTable('user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  planId: text('plan_id')
    .references(() => subscriptionPlans.id)
    .notNull()
    .default('unlimited'),
  status: text('status').notNull().default('inactive'), // 'active' | 'inactive' | 'pending' | 'cancelled' | 'past_due'
  razorpaySubscriptionId: text('razorpay_subscription_id'),
  razorpayOrderId: text('razorpay_order_id'),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usageTracking = pgTable(
  'usage_tracking',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    periodKey: text('period_key').notNull(), // YYYY-MM
    messagesUsed: integer('messages_used').notNull().default(0),
    imagesUsed: integer('images_used').notNull().default(0),
    voiceMinutesUsed: integer('voice_minutes_used').notNull().default(0),
    storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).notNull().default(0),
    tokensConsumed: bigint('tokens_consumed', { mode: 'number' }).notNull().default(0),
    resetDate: timestamp('reset_date').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('usage_user_period_idx').on(table.userId, table.periodKey),
  ],
);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  planId: text('plan_id')
    .references(() => subscriptionPlans.id)
    .notNull(),
  amountInr: integer('amount_inr').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('created'), // 'created' | 'paid' | 'failed' | 'refunded'
  razorpayOrderId: text('razorpay_order_id').notNull(),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpaySignature: text('razorpay_signature'),
  invoiceNumber: text('invoice_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversationsTable = pgTable('conversations', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  mode: text('mode').notNull().default('general'),
  modelId: text('model_id').notNull().default('mavi-assistant-1.0'),
  messagesJson: jsonb('messages_json').$type<unknown[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const storedFiles = pgTable('stored_files', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  kind: text('kind').notNull(), // 'image' | 'pdf' | 'document'
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const aiProviders = pgTable('ai_providers', {
  id: text('id').primaryKey(), // 'gemini' | 'ollama' | 'openai_compat'
  displayName: text('display_name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  priority: integer('priority').notNull().default(1),
  endpointUrl: text('endpoint_url'),
  defaultModel: text('default_model').notNull(),
  healthStatus: text('health_status').notNull().default('healthy'),
  totalRequests: integer('total_requests').notNull().default(0),
  totalErrors: integer('total_errors').notNull().default(0),
  totalTokens: bigint('total_tokens', { mode: 'number' }).notNull().default(0),
  estimatedCostInr: integer('estimated_cost_inr').notNull().default(0),
  lastError: text('last_error'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const advertisements = pgTable('advertisements', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  ctaLabel: text('cta_label').notNull(),
  ctaUrl: text('cta_url').notNull(),
  placement: text('placement').notNull().default('workspace_banner'),
  active: boolean('active').notNull().default(true),
  impressions: integer('impressions').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  category: text('category').notNull(), // 'auth' | 'billing' | 'ai' | 'admin' | 'storage'
  action: text('action').notNull(),
  detail: text('detail').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(userSubscriptions, {
    fields: [users.id],
    references: [userSubscriptions.userId],
  }),
  usages: many(usageTracking),
  payments: many(payments),
  conversations: many(conversationsTable),
  files: many(storedFiles),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));
