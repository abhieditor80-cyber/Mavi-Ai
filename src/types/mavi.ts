export type NavTab =
  | 'chat'
  | 'search'
  | 'explore'
  | 'tools'
  | 'history'
  | 'study'
  | 'planner'
  | 'pricing'
  | 'usage'
  | 'storage'
  | 'admin';

export type AssistantMode =
  | 'general'
  | 'deep_research'
  | 'image'
  | 'web_search'
  | 'study'
  | 'coding'
  | 'planning'
  | 'data_analyst'
  | 'agents';

export type MaviModelId =
  | 'mavi-assistant-1.0'
  | 'mavi-deep-reason'
  | 'mavi-swift';

export type PlanId = 'unlimited';

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

export interface MaviModelOption {
  id: MaviModelId;
  label: string;
  tagline: string;
  badge: string;
}

export interface AttachmentItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'pdf' | 'document';
  dataBase64?: string;
  textContent?: string;
  previewUrl?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  mode?: AssistantMode;
  modelId?: MaviModelId;
  providerUsed?: string;
  attachments?: Omit<AttachmentItem, 'dataBase64'>[];
  sources?: GroundingSource[];
  feedback?: 'up' | 'down' | null;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: AssistantMode;
  modelId: MaviModelId;
  messages: ChatMessage[];
}

export type ThemeMode = 'light' | 'dark';
export type AccentId = 'sapphire' | 'indigo' | 'teal' | 'rose';
export type FontSizeOption = 'small' | 'medium' | 'large';
export type ChatDensity = 'cozy' | 'compact';
export type SidebarStyle = 'floating' | 'expanded';

export interface MaviSettings {
  theme: ThemeMode;
  accent: AccentId;
  fontSize: FontSizeOption;
  chatDensity: ChatDensity;
  sidebarStyle: SidebarStyle;
  wallpaperPreset: 'ambient' | 'lavender_silk' | 'midnight_glass' | 'custom';
  customWallpaperUrl: string | null;
  userName: string;
  userAvatarUrl: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  category: 'Focus' | 'Build' | 'Study' | 'Creative';
  dueLabel: string;
  completed: boolean;
}

export interface SubscriptionPlanDTO {
  id: PlanId;
  name: string;
  tagline: string;
  priceInr: number;
  storageQuotaMb: number;
  adsEnabled: boolean;
  allowedModelTier: 'standard' | 'advanced' | 'pro';
  priorityProcessing: boolean;
  isHighlighted: boolean;
  description: string;
  featuresJson: string[];
  featureFlagsJson: MaviFeatureFlags;
}

export interface AccountSnapshotDTO {
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    memoryEnabled: boolean;
    memoryNotes: string;
  };
  subscription: {
    planId: PlanId;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  plan: SubscriptionPlanDTO;
  usage: {
    periodKey: string;
    messagesUsed: number;
    imagesUsed: number;
    voiceMinutesUsed: number;
    storageUsedBytes: number;
    tokensConsumed: number;
    resetDate: string;
  };
}

export interface AdvertisementDTO {
  id: number;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  placement: string;
  active: boolean;
  impressions: number;
}

export interface StoredFileDTO {
  id: string;
  fileName: string;
  mimeType: string;
  kind: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PaymentDTO {
  id: number;
  planId: string;
  amountInr: number;
  currency: string;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  invoiceNumber: string;
  createdAt: string;
}
