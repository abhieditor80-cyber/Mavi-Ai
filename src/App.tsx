import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountModal } from './components/AccountModal';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ChatComposer } from './components/ChatComposer';
import { ConversationView } from './components/ConversationView';
import { FloatingNavRail } from './components/FloatingNavRail';
import { SettingsModal } from './components/Modals';
import { PricingView } from './components/PricingView';
import { TopHeader } from './components/TopHeader';
import { UsageAndStorageView } from './components/UsageAndStorageView';
import { WelcomeDashboard } from './components/WelcomeDashboard';
import { WorkspaceViews } from './components/WorkspaceViews';
import { useAuth } from './context/AuthContext';
import type {
  AssistantMode,
  AttachmentItem,
  ChatMessage,
  Conversation,
  GroundingSource,
  MaviModelId,
  MaviSettings,
  NavTab,
  PlannerTask,
} from './types/mavi';
import {
  DEFAULT_SETTINGS,
  MAVI_ASSETS,
  buildChatTitle,
} from './utils/chatLogic';

const SETTINGS_STORAGE_KEY = 'mavi-ai-settings-v1';
const CHATS_STORAGE_KEY = 'mavi-ai-chats-v1';
const TASKS_STORAGE_KEY = 'mavi-ai-tasks-v1';

const INITIAL_TASKS: PlannerTask[] = [
  {
    id: 't1',
    title: 'Outline research notes for weekly synthesis',
    category: 'Study',
    dueLabel: 'Today',
    completed: false,
  },
  {
    id: 't2',
    title: 'Prototype component architecture & API contract',
    category: 'Build',
    dueLabel: 'Tomorrow',
    completed: false,
  },
  {
    id: 't3',
    title: 'Draft creative visual moodboard in Visual Studio',
    category: 'Creative',
    dueLabel: 'This week',
    completed: true,
  },
];

function loadSettings(): MaviSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadLocalChats(): Conversation[] {
  try {
    const raw = localStorage.getItem(CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadTasks(): PlannerTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return INITIAL_TASKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_TASKS;
  } catch {
    return INITIAL_TASKS;
  }
}

export default function App() {
  const { firebaseUser, account, authFetch, refreshAccount } = useAuth();

  const [settings, setSettings] = useState<MaviSettings>(loadSettings);
  const [activeTab, setActiveTab] = useState<NavTab>('chat');
  const [selectedModel, setSelectedModel] = useState<MaviModelId>('mavi-assistant-1.0');
  const [activeMode, setActiveMode] = useState<AssistantMode>('general');
  const [conversations, setConversations] = useState<Conversation[]>(loadLocalChats);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PlannerTask[]>(loadTasks);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeChatId) ?? null,
    [conversations, activeChatId],
  );

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Ignore storage errors
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      // Ignore storage errors
    }
  }, [conversations]);

  // Hydrate DB conversations when authenticated
  useEffect(() => {
    if (!firebaseUser) return;
    let active = true;
    authFetch('/api/chats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data?.chats || !Array.isArray(data.chats)) return;
        if (data.chats.length > 0) {
          setConversations((prev) => {
            const byId = new Map<string, Conversation>();
            for (const c of data.chats as Conversation[]) byId.set(c.id, c);
            for (const c of prev) {
              if (!byId.has(c.id)) byId.set(c.id, c);
            }
            return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [firebaseUser, authFetch]);

  const persistConversationToServer = useCallback(
    (conv: Conversation) => {
      const sanitizedConv: Conversation = {
        ...conv,
        messages: conv.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((att) => ({
            ...att,
            previewUrl: undefined,
            textContent: undefined,
          })),
        })),
      };
      authFetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: sanitizedConv }),
      }).catch(() => {});
    },
    [authFetch],
  );

  const streamAssistantReply = useCallback(
    async (
      convId: string,
      historyMessages: ChatMessage[],
      assistantMsgId: string,
      modeToUse: AssistantMode,
      modelToUse: MaviModelId,
      latestAttachments: AttachmentItem[],
    ) => {
      setIsStreaming(true);
      setLimitNotice(null);

      try {
        const response = await authFetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelId: modelToUse,
            mode: modeToUse,
            messages: historyMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            attachments: latestAttachments.map((att) => ({
              name: att.name,
              mimeType: att.mimeType,
              kind: att.kind,
              dataBase64: att.dataBase64,
              textContent: att.textContent,
            })),
          }),
        });

        if (!response.ok || !response.body) {
          const errJson = await response.json().catch(() => ({}));
          if (errJson.errorCode === 'PLAN_LIMIT_REACHED') {
            setLimitNotice(errJson.error);
          }
          throw new Error(errJson.error || `Request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';
        let groundedSources: GroundingSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const block of lines) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            const jsonStr = dataLine.slice(6).trim();
            if (!jsonStr) continue;

            const payload = JSON.parse(jsonStr) as {
              type: 'meta' | 'chunk' | 'sources' | 'done' | 'error';
              text?: string;
              sources?: GroundingSource[];
              error?: string;
            };

            if (payload.type === 'chunk' && payload.text) {
              accumulatedText += payload.text;
              setConversations((prev) =>
                prev.map((c) =>
                  c.id !== convId
                    ? c
                    : {
                        ...c,
                        updatedAt: Date.now(),
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId
                            ? { ...m, content: accumulatedText }
                            : m,
                        ),
                      },
                ),
              );
            } else if (payload.type === 'sources' && payload.sources) {
              groundedSources = payload.sources;
              setConversations((prev) =>
                prev.map((c) =>
                  c.id !== convId
                    ? c
                    : {
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === assistantMsgId
                            ? { ...m, sources: groundedSources }
                            : m,
                        ),
                      },
                ),
              );
            } else if (payload.type === 'error') {
              throw new Error(payload.error || 'Failed to generate response.');
            }
          }
        }

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const finalized: Conversation = {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content:
                        accumulatedText ||
                        'I did not receive any response text. Please try again.',
                      sources: groundedSources.length ? groundedSources : m.sources,
                    }
                  : m,
              ),
            };
            persistConversationToServer(finalized);
            return finalized;
          }),
        );

        if (firebaseUser) {
          void refreshAccount();
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to reach MAVI AI right now. Please try again.';
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== convId
              ? c
              : {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: message, error: true }
                      : m,
                  ),
                },
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [authFetch, firebaseUser, persistConversationToServer, refreshAccount],
  );

  const sendPrompt = useCallback(
    async (
      promptText: string,
      modeOverride?: AssistantMode,
      attachedFiles: AttachmentItem[] = [],
    ) => {
      const trimmed = promptText.trim();
      if (!trimmed && attachedFiles.length === 0) return;

      const modeToUse = modeOverride ?? activeMode;
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `msg-u-${now}`,
        role: 'user',
        content: trimmed || 'Please analyze the attached file(s).',
        createdAt: now,
        mode: modeToUse,
        modelId: selectedModel,
        attachments: attachedFiles.map(({ dataBase64: _omit, ...rest }) => rest),
      };
      const assistantMsgId = `msg-a-${now + 1}`;
      const placeholderAssistant: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        mode: modeToUse,
        modelId: selectedModel,
      };

      setActiveTab('chat');
      setComposerValue('');
      setAttachments([]);

      if (activeConversation) {
        const updatedMessages = [...activeConversation.messages, userMsg];
        const nextConv: Conversation = {
          ...activeConversation,
          updatedAt: now,
          mode: modeToUse,
          modelId: selectedModel,
          messages: [...updatedMessages, placeholderAssistant],
        };
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversation.id ? nextConv : c)),
        );
        await streamAssistantReply(
          activeConversation.id,
          updatedMessages,
          assistantMsgId,
          modeToUse,
          selectedModel,
          attachedFiles,
        );
      } else {
        const newId = `chat-${now}`;
        const newConv: Conversation = {
          id: newId,
          title: buildChatTitle(userMsg.content),
          createdAt: now,
          updatedAt: now,
          mode: modeToUse,
          modelId: selectedModel,
          messages: [userMsg, placeholderAssistant],
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveChatId(newId);
        await streamAssistantReply(
          newId,
          [userMsg],
          assistantMsgId,
          modeToUse,
          selectedModel,
          attachedFiles,
        );
      }
    },
    [activeConversation, activeMode, selectedModel, streamAssistantReply],
  );

  const handleComposerSend = () => {
    if (isStreaming) return;
    void sendPrompt(composerValue, activeMode, attachments);
  };

  const handleRegenerate = (assistantMessageId: string) => {
    if (!activeConversation || isStreaming) return;
    const idx = activeConversation.messages.findIndex((m) => m.id === assistantMessageId);
    if (idx <= 0) return;

    const historyUpToUser = activeConversation.messages.slice(0, idx);
    const newAssistantId = `msg-a-${Date.now()}`;
    const placeholder: ChatMessage = {
      id: newAssistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      mode: activeConversation.mode,
      modelId: selectedModel,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? { ...c, messages: [...historyUpToUser, placeholder] }
          : c,
      ),
    );

    void streamAssistantReply(
      activeConversation.id,
      historyUpToUser,
      newAssistantId,
      activeConversation.mode,
      selectedModel,
      [],
    );
  };

  const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
    if (!activeConversation) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConversation.id) return c;
        const updated: Conversation = {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId
              ? { ...m, feedback: m.feedback === feedback ? null : feedback }
              : m,
          ),
        };
        persistConversationToServer(updated);
        return updated;
      }),
    );
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setActiveTab('chat');
    setActiveMode('general');
    setComposerValue('');
    setAttachments([]);
    setTimeout(() => composerInputRef.current?.focus(), 60);
  };

  const handleLaunchFromWorkspace = (
    prompt: string,
    mode: AssistantMode = 'general',
    populateOnly = false,
  ) => {
    setActiveChatId(null);
    setActiveTab('chat');
    setActiveMode(mode);
    if (populateOnly) {
      setComposerValue(prompt);
      setTimeout(() => composerInputRef.current?.focus(), 60);
    } else {
      void sendPrompt(prompt, mode, []);
    }
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
    authFetch(`/api/chats/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };

  const wallpaperUrl = useMemo(() => {
    if (settings.wallpaperPreset === 'custom' && settings.customWallpaperUrl) {
      return settings.customWallpaperUrl;
    }
    if (settings.wallpaperPreset === 'lavender_silk') {
      return MAVI_ASSETS.wallpaperLight;
    }
    if (settings.wallpaperPreset === 'midnight_glass') {
      return MAVI_ASSETS.wallpaperDark;
    }
    return null;
  }, [settings.wallpaperPreset, settings.customWallpaperUrl]);

  const effectiveDisplayName = firebaseUser
    ? account?.user.displayName || firebaseUser.displayName || settings.userName
    : 'Guest';
  const effectiveAvatar =
    account?.user.avatarUrl || firebaseUser?.photoURL || settings.userAvatarUrl;
  const planBadge =
    account && account.subscription.status === 'active'
      ? 'MAVI Unlimited'
      : 'Get MAVI Unlimited';

  const centerTitle = useMemo(() => {
    if (activeTab === 'chat' && activeConversation) return activeConversation.title;
    if (activeTab === 'search') return 'Search · Conversations & Knowledge';
    if (activeTab === 'explore') return 'Explore · Curated AI Workflows';
    if (activeTab === 'tools') return 'AI Tools · Workspaces & Platform';
    if (activeTab === 'history') return 'History · Saved Sessions';
    if (activeTab === 'study') return 'MAVI Study Workspace';
    if (activeTab === 'planner') return 'MAVI Projects & Planning';
    if (activeTab === 'pricing') return 'MAVI UNLIMITED · ₹199/mo';
    if (activeTab === 'usage' || activeTab === 'storage')
      return 'Workspace, Storage & AI Memory';
    if (activeTab === 'admin') return 'Admin Console';
    return undefined;
  }, [activeTab, activeConversation]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-0 md:p-5 bg-gradient-to-br from-[#ECEFFF] via-[#E5EEFF] to-[#F7F9FF] dark:from-[#060913] dark:via-[#0B1224] dark:to-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {wallpaperUrl && (
        <img
          src={wallpaperUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-55 dark:opacity-45"
        />
      )}

      {/* Lightweight GPU-friendly Ambient Glow & Abstract Curved Lines */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-55 dark:opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(165,180,252,0.55) 0%, rgba(165,180,252,0) 70%)',
          }}
        />
        <div
          className="absolute -bottom-28 -right-24 w-[540px] h-[540px] rounded-full opacity-55 dark:opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(125,211,252,0.55) 0%, rgba(125,211,252,0) 70%)',
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full opacity-45 dark:opacity-20"
          viewBox="0 0 1440 900"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M-60 240 C 260 110, 560 410, 940 220 C 1180 100, 1340 180, 1520 120"
            stroke="url(#bgRibbonA)"
            strokeWidth="2"
          />
          <path
            d="M-80 680 C 310 520, 620 820, 1020 610 C 1240 495, 1380 570, 1520 510"
            stroke="url(#bgRibbonB)"
            strokeWidth="1.6"
          />
          <defs>
            <linearGradient id="bgRibbonA" x1="0" y1="0" x2="1440" y2="300" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#E0E7FF" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="bgRibbonB" x1="0" y1="500" x2="1440" y2="800" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#C7D2FE" stopOpacity="0.45" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Stage: Floating Left Navigation + ~92vw x 90vh Liquid Glass Container */}
      <div className="relative z-10 w-full md:w-[92vw] max-w-[1420px] h-[100dvh] md:h-[90vh] md:max-h-[920px] flex items-stretch gap-3.5">
        <FloatingNavRail
          activeTab={activeTab}
          sidebarStyle={settings.sidebarStyle}
          onSelectTab={(tab) => setActiveTab(tab)}
          onNewChat={handleNewChat}
        />

        <main className="flex-1 min-w-0 flex flex-col md:rounded-[30px] backdrop-blur-xl bg-white/76 dark:bg-slate-900/76 border border-white/85 dark:border-white/12 shadow-[0_24px_70px_rgba(15,23,42,0.10)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.48)] overflow-hidden">
          <TopHeader
            selectedModel={selectedModel}
            onSelectModel={setSelectedModel}
            centerTitle={centerTitle}
            userName={effectiveDisplayName}
            userAvatarUrl={effectiveAvatar}
            isSignedIn={Boolean(firebaseUser)}
            planBadge={planBadge}
            onOpenUpgrade={() => setActiveTab('pricing')}
            onOpenAccount={() => setAccountOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogoClick={handleNewChat}
          />

          {/* Friendly Workspace Notification Banner */}
          {limitNotice && (
            <div className="mx-4 sm:mx-8 mt-3 p-3.5 rounded-2xl bg-amber-50/95 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-100">
              <span>{limitNotice}</span>
              <button
                type="button"
                onClick={() => {
                  setLimitNotice(null);
                  setActiveTab('pricing');
                }}
                className="px-3.5 py-1.5 rounded-full font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 whitespace-nowrap cursor-pointer"
              >
                MAVI Unlimited
              </button>
            </div>
          )}

          {/* Scrollable Main Content Viewport */}
          <div
            className={`flex-1 overflow-y-auto mavi-scroll flex flex-col ${
              activeTab !== 'chat' ? 'pb-20 md:pb-0' : ''
            }`}
          >
            {activeTab === 'chat' ? (
              activeConversation ? (
                <ConversationView
                  messages={activeConversation.messages}
                  isStreaming={isStreaming}
                  fontSize={settings.fontSize}
                  chatDensity={settings.chatDensity}
                  userAvatarUrl={effectiveAvatar}
                  userName={effectiveDisplayName}
                  onRegenerate={handleRegenerate}
                  onFeedback={handleFeedback}
                  onNewChat={handleNewChat}
                />
              ) : (
                <div className="my-auto">
                  <WelcomeDashboard
                    accent={settings.accent}
                    onQuickStartChat={() => {
                      setActiveMode('general');
                      composerInputRef.current?.focus();
                    }}
                    onOpenStudyWorkspace={() => setActiveTab('study')}
                    onOpenPlanningWorkspace={() => setActiveTab('planner')}
                  />
                </div>
              )
            ) : activeTab === 'pricing' ? (
              <PricingView onOpenAuth={() => setAccountOpen(true)} />
            ) : activeTab === 'usage' || activeTab === 'storage' ? (
              <UsageAndStorageView
                onOpenAuth={() => setAccountOpen(true)}
                onGoToPricing={() => setActiveTab('pricing')}
              />
            ) : activeTab === 'admin' ? (
              <AdminDashboardView />
            ) : (
              <WorkspaceViews
                activeTab={activeTab}
                conversations={conversations}
                tasks={tasks}
                onToggleTask={(id) =>
                  setTasks((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
                  )
                }
                onAddTask={(title, category) =>
                  setTasks((prev) => [
                    {
                      id: `t-${Date.now()}`,
                      title,
                      category,
                      dueLabel: 'Today',
                      completed: false,
                    },
                    ...prev,
                  ])
                }
                onDeleteTask={(id) =>
                  setTasks((prev) => prev.filter((t) => t.id !== id))
                }
                onOpenConversation={(id) => {
                  setActiveChatId(id);
                  setActiveTab('chat');
                }}
                onDeleteConversation={handleDeleteConversation}
                onLaunchPrompt={(prompt, mode, populateOnly) =>
                  handleLaunchFromWorkspace(prompt, mode, populateOnly ?? prompt.endsWith(' '))
                }
                onSelectWorkspaceTab={(tab) => setActiveTab(tab)}
              />
            )}
          </div>

          {/* Bottom Floating Liquid Glass AI Chat Composer */}
          {(activeTab === 'chat' || activeTab === 'tools' || activeTab === 'explore') && (
            <ChatComposer
              value={composerValue}
              onChange={setComposerValue}
              activeMode={activeMode}
              onSelectMode={setActiveMode}
              onOpenMoreTools={() => setActiveTab('tools')}
              onOpenUpgrade={() => setActiveTab('pricing')}
              attachments={attachments}
              onAddAttachments={(items) =>
                setAttachments((prev) => [...prev, ...items])
              }
              onRemoveAttachment={(id) =>
                setAttachments((prev) => prev.filter((a) => a.id !== id))
              }
              onSend={handleComposerSend}
              isSending={isStreaming}
              inputRef={composerInputRef}
            />
          )}
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onUpdate={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        onReset={() => setSettings(DEFAULT_SETTINGS)}
        onClose={() => setSettingsOpen(false)}
      />

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
}
