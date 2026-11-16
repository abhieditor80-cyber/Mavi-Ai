import type {
  AccentId,
  AssistantMode,
  AttachmentItem,
  Conversation,
  MaviModelOption,
  MaviSettings,
} from '../types/mavi';

export const MAVI_ASSETS = {
  mascot: '/src/assets/images/mavi_robot_mascot_1794815064966.jpg',
  avatar: '/src/assets/images/user_avatar_portrait_1794815066023.jpg',
  wallpaperLight: '/src/assets/images/wallpaper_lavender_silk_1794815065978.jpg',
  wallpaperDark: '/src/assets/images/wallpaper_midnight_glass_1794815065522.jpg',
} as const;

export const MAVI_MODELS: MaviModelOption[] = [
  {
    id: 'mavi-assistant-1.0',
    label: 'MAVI Assistant v1.0',
    tagline: 'Balanced intelligence for everyday tasks',
    badge: 'Balanced',
  },
  {
    id: 'mavi-deep-reason',
    label: 'MAVI DeepThink',
    tagline: 'Extended multi-step reasoning and synthesis',
    badge: 'Deep Reasoning',
  },
  {
    id: 'mavi-swift',
    label: 'MAVI Swift',
    tagline: 'Low-latency answers for quick drafts',
    badge: 'Fast',
  },
];

export const DEFAULT_SETTINGS: MaviSettings = {
  theme: 'light',
  accent: 'sapphire',
  fontSize: 'medium',
  chatDensity: 'cozy',
  sidebarStyle: 'floating',
  wallpaperPreset: 'ambient',
  customWallpaperUrl: null,
  userName: 'Alex Mercer',
  userAvatarUrl: MAVI_ASSETS.avatar,
};

export interface QuickActionConfig {
  id: AssistantMode | 'more_tools';
  label: string;
  mode: AssistantMode;
  starterPrompt: string;
  placeholder: string;
  opensToolsHub?: boolean;
}

export const QUICK_ACTIONS: QuickActionConfig[] = [
  {
    id: 'deep_research',
    label: 'Deep Research',
    mode: 'deep_research',
    starterPrompt: 'Conduct a structured deep-research brief on ',
    placeholder: 'Topic to research deeply with multi-step reasoning...',
  },
  {
    id: 'image',
    label: 'Make an Image',
    mode: 'image',
    starterPrompt: 'Create a custom vector illustration of ',
    placeholder: 'Describe the visual or SVG illustration you want MAVI to craft...',
  },
  {
    id: 'web_search',
    label: 'Search Web',
    mode: 'web_search',
    starterPrompt: 'Search the web for the latest updates on ',
    placeholder: 'Ask a live web question with grounded sources...',
  },
  {
    id: 'study',
    label: 'Study Assistant',
    mode: 'study',
    starterPrompt: 'Break down this concept with examples and quiz questions: ',
    placeholder: 'Paste notes, a topic, or ask for study flashcards...',
  },
  {
    id: 'coding',
    label: 'Coding Assistant',
    mode: 'coding',
    starterPrompt: 'Write clean, production-ready code for ',
    placeholder: 'Describe a feature, bug, or architecture question...',
  },
  {
    id: 'more_tools',
    label: 'More Tools',
    mode: 'general',
    starterPrompt: '',
    placeholder: 'Explore all MAVI AI tools and workspaces...',
    opensToolsHub: true,
  },
];

export function getGreetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning · Ready to create';
  if (hour >= 12 && hour < 17) return 'Good afternoon · Stay in flow';
  if (hour >= 17 && hour < 22) return 'Good evening · Build something great';
  return 'Late night flow · MAVI is ready';
}

export function buildChatTitle(rawMessage: string): string {
  const cleaned = rawMessage
    .replace(/[#*`>_~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'New Conversation';
  if (cleaned.length <= 44) return cleaned;
  return `${cleaned.slice(0, 41).trimEnd()}...`;
}

export function filterConversations(
  conversations: Conversation[],
  query: string,
): Conversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter((conv) => {
    if (conv.title.toLowerCase().includes(q)) return true;
    return conv.messages.some((m) => m.content.toLowerCase().includes(q));
  });
}

export interface GroupedConversations {
  label: 'Today' | 'Yesterday' | 'Previous 7 Days' | 'Earlier';
  items: Conversation[];
}

export function groupConversationsByRecency(
  conversations: Conversation[],
  nowMs: number = Date.now(),
): GroupedConversations[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

  const buckets: Record<GroupedConversations['label'], Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Earlier: [],
  };

  for (const conv of sorted) {
    if (conv.updatedAt >= todayStart) {
      buckets.Today.push(conv);
    } else if (conv.updatedAt >= yesterdayStart) {
      buckets.Yesterday.push(conv);
    } else if (conv.updatedAt >= weekStart) {
      buckets['Previous 7 Days'].push(conv);
    } else {
      buckets.Earlier.push(conv);
    }
  }

  return (['Today', 'Yesterday', 'Previous 7 Days', 'Earlier'] as const)
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }));
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export function classifyAttachmentKind(
  mimeType: string,
  fileName: string,
): AttachmentItem['kind'] | null {
  const lowerMime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();

  if (lowerMime.startsWith('image/')) return 'image';
  if (lowerMime === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    lowerMime.startsWith('text/') ||
    lowerMime === 'application/json' ||
    /\.(txt|md|csv|json|ts|tsx|js|jsx|py|html|css|yml|yaml)$/i.test(lowerName)
  ) {
    return 'document';
  }
  return null;
}

export function validateAttachment(
  file: { name: string; type: string; size: number },
  maxBytes: number = MAX_ATTACHMENT_BYTES,
): { ok: true; kind: AttachmentItem['kind'] } | { ok: false; error: string } {
  if (file.size <= 0) {
    return { ok: false, error: `"${file.name}" is empty.` };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `"${file.name}" exceeds the ${mb} MB attachment limit.` };
  }
  const kind = classifyAttachmentKind(file.type, file.name);
  if (!kind) {
    return {
      ok: false,
      error: `"${file.name}" is not a supported PDF, image, or text document.`,
    };
  }
  return { ok: true, kind };
}

export function getAccentTokens(accent: AccentId): {
  label: string;
  hex: string;
  softBg: string;
  ringClass: string;
  gradientText: string;
  buttonBg: string;
} {
  switch (accent) {
    case 'indigo':
      return {
        label: 'Indigo Prism',
        hex: '#4F46E5',
        softBg: 'rgba(79, 70, 229, 0.14)',
        ringClass: 'focus:ring-indigo-500/30',
        gradientText:
          'from-indigo-600 via-blue-600 to-violet-500 dark:from-indigo-300 dark:via-sky-300 dark:to-violet-300',
        buttonBg: 'bg-indigo-600 hover:bg-indigo-700',
      };
    case 'teal':
      return {
        label: 'Glacier Teal',
        hex: '#0D9488',
        softBg: 'rgba(13, 148, 136, 0.14)',
        ringClass: 'focus:ring-teal-500/30',
        gradientText:
          'from-teal-600 via-cyan-600 to-sky-500 dark:from-teal-300 dark:via-cyan-300 dark:to-sky-300',
        buttonBg: 'bg-teal-600 hover:bg-teal-700',
      };
    case 'rose':
      return {
        label: 'Coral Dusk',
        hex: '#E11D48',
        softBg: 'rgba(225, 29, 72, 0.12)',
        ringClass: 'focus:ring-rose-500/30',
        gradientText:
          'from-rose-600 via-pink-600 to-indigo-500 dark:from-rose-300 dark:via-pink-300 dark:to-indigo-300',
        buttonBg: 'bg-rose-600 hover:bg-rose-700',
      };
    case 'sapphire':
    default:
      return {
        label: 'Sapphire Blue',
        hex: '#2563EB',
        softBg: 'rgba(37, 99, 235, 0.14)',
        ringClass: 'focus:ring-blue-500/30',
        gradientText:
          'from-blue-600 via-sky-600 to-indigo-600 dark:from-sky-300 dark:via-blue-300 dark:to-indigo-300',
        buttonBg: 'bg-blue-600 hover:bg-blue-700',
      };
  }
}

export function extractSvgFromContent(markdown: string): string | null {
  const match = markdown.match(/<svg[\s\S]*?<\/svg>/i);
  if (!match) return null;
  const candidate = match[0];
  return candidate
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function computeUsageSummary(used: number, limit: number): {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  exhausted: boolean;
} {
  const safeLimit = Math.max(1, limit);
  const safeUsed = Math.max(0, used);
  const remaining = Math.max(0, safeLimit - safeUsed);
  const percent = Math.min(100, Math.round((safeUsed / safeLimit) * 100));
  return {
    used: safeUsed,
    limit: safeLimit,
    remaining,
    percent,
    exhausted: safeUsed >= safeLimit,
  };
}

export function formatStorageSafeguard(megabytes: number): string {
  if (megabytes >= 1024) {
    const gb = megabytes / 1024;
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
  }
  return `${megabytes} MB`;
}

export function isSubscriptionActive(status?: string | null): boolean {
  return status === 'active';
}
