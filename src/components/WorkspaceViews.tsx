import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  Compass,
  CreditCard,
  FileText,
  FolderOpen,
  Globe,
  HardDrive,
  MessageSquare,
  Palette,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Telescope,
  Trash2,
  Workflow,
} from 'lucide-react';
import type { AssistantMode, Conversation, NavTab, PlannerTask } from '../types/mavi';
import { filterConversations, groupConversationsByRecency } from '../utils/chatLogic';

interface WorkspaceViewsProps {
  activeTab: 'search' | 'explore' | 'tools' | 'history' | 'study' | 'planner';
  conversations: Conversation[];
  tasks: PlannerTask[];
  onToggleTask: (id: string) => void;
  onAddTask: (title: string, category: PlannerTask['category']) => void;
  onDeleteTask: (id: string) => void;
  onOpenConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onLaunchPrompt: (prompt: string, mode?: AssistantMode, populateOnly?: boolean) => void;
  onSelectWorkspaceTab: (tab: NavTab) => void;
}

const EXPLORE_IDEAS: Array<{
  category: string;
  title: string;
  description: string;
  prompt: string;
  mode: AssistantMode;
}> = [
  {
    category: 'Research',
    title: 'Compare Solar Battery Technologies',
    description: 'Build a structured comparison table of LFP, solid-state, and sodium-ion storage.',
    prompt: 'Compare LFP, solid-state, and sodium-ion battery storage in a clear technical table with trade-offs.',
    mode: 'deep_research',
  },
  {
    category: 'Study',
    title: 'Master Neural Network Backpropagation',
    description: 'Intuitive chain-rule breakdown plus 3 active-recall practice questions.',
    prompt: 'Explain backpropagation intuitively step-by-step with a small numerical example and 3 quiz questions.',
    mode: 'study',
  },
  {
    category: 'Coding',
    title: 'Design a Rate-Limited Express API',
    description: 'Clean TypeScript sliding-window middleware with edge-case tests.',
    prompt: 'Write a clean TypeScript Express sliding-window rate limiter middleware and explain edge cases.',
    mode: 'coding',
  },
  {
    category: 'Visual Studio',
    title: 'Minimalist Mountain Sunrise SVG Poster',
    description: 'Generate scalable layered vector artwork ready to download as SVG.',
    prompt: 'Create a minimalist geometric mountain sunrise poster vector artwork with soft lavender and gold gradients.',
    mode: 'image',
  },
  {
    category: 'Data & Finance',
    title: 'Personal Monthly Budget & SIP Analysis',
    description: 'Analyze income allocation in INR with clear savings projections.',
    prompt: 'Create a structured INR monthly budget and SIP compounding comparison table for a ₹65,000 take-home salary.',
    mode: 'data_analyst',
  },
  {
    category: 'Agents',
    title: 'Automated Study & Exam Sprint Agent',
    description: 'Design a multi-step agent workflow for weekly syllabus mastery.',
    prompt: 'Design an automated 4-step agentic workflow to organize PDFs, generate flashcards, and schedule revision.',
    mode: 'agents',
  },
];

export const WorkspaceViews: React.FC<WorkspaceViewsProps> = ({
  activeTab,
  conversations,
  tasks,
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onOpenConversation,
  onDeleteConversation,
  onLaunchPrompt,
  onSelectWorkspaceTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyFormat, setStudyFormat] = useState<'summary' | 'flashcards' | 'quiz'>('summary');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCat, setNewTaskCat] = useState<PlannerTask['category']>('Focus');
  const [aiPlanGoal, setAiPlanGoal] = useState('');

  const filteredChats = useMemo(
    () => filterConversations(conversations, searchQuery),
    [conversations, searchQuery],
  );
  const groupedChats = useMemo(
    () => groupConversationsByRecency(filteredChats),
    [filteredChats],
  );

  if (activeTab === 'search') {
    return (
      <div className="w-full max-w-[920px] mx-auto px-4 sm:px-8 py-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Search MAVI AI
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Find past conversations, prompts, or jump directly into a workspace.
        </p>

        <div className="mt-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search conversations and prompts"
            placeholder="Search conversations by title or keyword..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white/85 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <div className="mt-6 space-y-2.5">
          {filteredChats.length === 0 ? (
            <div className="p-8 rounded-2xl text-center bg-white/70 dark:bg-slate-800/50 border border-white/80 dark:border-white/10">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {conversations.length === 0
                  ? 'No saved conversations yet.'
                  : 'No conversations matched your search.'}
              </p>
              <button
                type="button"
                onClick={() => onLaunchPrompt('Help me brainstorm 5 creative project ideas.', 'general')}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Start First Conversation</span>
              </button>
            </div>
          ) : (
            filteredChats.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl text-left bg-white/80 hover:bg-white dark:bg-slate-800/65 dark:hover:bg-slate-800 border border-white/90 dark:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {conv.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {conv.messages[conv.messages.length - 1]?.content.slice(0, 90)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">
                  {conv.messages.length} msgs
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'explore') {
    return (
      <div className="w-full max-w-[980px] mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Explore MAVI Workflows
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Launch curated workflows across research, study, coding, finance, and visual creativity.
            </p>
          </div>
          <Compass className="w-6 h-6 text-blue-600 dark:text-sky-400 shrink-0" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPLORE_IDEAS.map((idea) => (
            <button
              key={idea.title}
              type="button"
              onClick={() => onLaunchPrompt(idea.prompt, idea.mode)}
              className="group text-left p-5 rounded-[22px] bg-white/82 hover:bg-white dark:bg-slate-800/65 dark:hover:bg-slate-800 border border-white/90 dark:border-white/10 shadow-[0_8px_26px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-medium text-blue-600 dark:text-sky-400">
                  {idea.category}
                </span>
                <h2 className="mt-1.5 font-display text-[15.5px] font-bold text-slate-900 dark:text-white leading-snug">
                  {idea.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {idea.description}
                </p>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:gap-2 transition-all">
                <span>Try prompt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'tools') {
    const tools = [
      {
        title: 'MAVI Research',
        desc: 'Extended reasoning with structured comparisons and grounded synthesis.',
        icon: Telescope,
        action: () => onLaunchPrompt('Conduct a deep-research analysis on ', 'deep_research', true),
      },
      {
        title: 'MAVI Image Studio',
        desc: 'Generate clean, downloadable SVG illustrations and visual concepts.',
        icon: Palette,
        action: () => onLaunchPrompt('Create a custom vector illustration of ', 'image', true),
      },
      {
        title: 'Search Web',
        desc: 'Answer current questions with live Google Search grounding and source links.',
        icon: Globe,
        action: () => onLaunchPrompt('Search the web for ', 'web_search', true),
      },
      {
        title: 'MAVI Study',
        desc: 'Summarize notes, build active-recall flashcards, and test understanding.',
        icon: BookOpen,
        action: () => onSelectWorkspaceTab('study'),
      },
      {
        title: 'MAVI Code',
        desc: 'Architect features, debug edge cases, and generate clean TypeScript/Python.',
        icon: Code2,
        action: () => onLaunchPrompt('Write clean code for ', 'coding', true),
      },
      {
        title: 'MAVI Data Analyst',
        desc: 'Personal finance in INR, spreadsheet formulas, and structured data analysis.',
        icon: BarChart3,
        action: () => onLaunchPrompt('Analyze this dataset or budget in INR: ', 'data_analyst', true),
      },
      {
        title: 'MAVI Projects',
        desc: 'Manage tasks and generate AI-structured project milestones.',
        icon: Calendar,
        action: () => onSelectWorkspaceTab('planner'),
      },
      {
        title: 'MAVI Agents',
        desc: 'Design autonomous multi-step execution workflows and checklists.',
        icon: Bot,
        action: () => onLaunchPrompt('Build a multi-step agent workflow for ', 'agents', true),
      },
      {
        title: 'MAVI Diagrams',
        desc: 'Generate clean architecture flowcharts, sequence diagrams, and SVG visuals.',
        icon: Workflow,
        action: () =>
          onLaunchPrompt('Create a clear architecture diagram using Mermaid or SVG for ', 'planning', true),
      },
      {
        title: 'MAVI Writing Assistant',
        desc: 'Draft essays, emails, documentation, and bilingual English/Telugu/Tenglish copy.',
        icon: PenLine,
        action: () =>
          onLaunchPrompt('Write and refine clear, engaging content for ', 'general', true),
      },
      {
        title: 'MAVI File Assistant',
        desc: 'Persistent PDF & file vault with transparent server disk safeguards.',
        icon: FolderOpen,
        action: () => onSelectWorkspaceTab('storage'),
      },
      {
        title: 'Workspace, Storage & Memory',
        desc: 'Manage persistent files, AI memory preferences, and billing invoices.',
        icon: HardDrive,
        action: () => onSelectWorkspaceTab('usage'),
      },
      {
        title: 'MAVI UNLIMITED (₹199/mo)',
        desc: 'One plan. All AI features included with zero advertisements.',
        icon: CreditCard,
        action: () => onSelectWorkspaceTab('pricing'),
      },
    ];

    return (
      <div className="w-full max-w-[980px] mx-auto px-4 sm:px-8 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              MAVI AI Workspaces & Platform Tools
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              All AI workspaces, storage, and tools included in one unified MAVI UNLIMITED experience.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.title}
                type="button"
                onClick={tool.action}
                className="text-left p-5 rounded-[22px] bg-white/82 hover:bg-white dark:bg-slate-800/65 dark:hover:bg-slate-800 border border-white/90 dark:border-white/10 shadow-[0_8px_26px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
                  {tool.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {tool.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (activeTab === 'history') {
    return (
      <div className="w-full max-w-[920px] mx-auto px-4 sm:px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Chat History
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Resume any saved conversation across your MAVI AI sessions.
            </p>
          </div>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>

        {groupedChats.length === 0 ? (
          <div className="mt-8 p-10 rounded-[24px] text-center bg-white/75 dark:bg-slate-800/55 border border-white/80 dark:border-white/10">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Your conversation history is empty.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ask MAVI a question in the composer below and your threads will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groupedChats.map((group) => (
              <div key={group.label}>
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                  {group.label}
                </h2>
                <div className="space-y-2">
                  {group.items.map((conv) => (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/82 dark:bg-slate-800/65 border border-white/90 dark:border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenConversation(conv.id)}
                        className="flex-1 min-w-0 text-left flex items-center gap-3 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {conv.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {conv.messages.length} messages · {new Date(conv.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteConversation(conv.id)}
                        aria-label={`Delete conversation ${conv.title}`}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'study') {
    const handleLaunchStudy = (e: React.FormEvent) => {
      e.preventDefault();
      if (!studyTopic.trim()) return;
      const prefix =
        studyFormat === 'flashcards'
          ? 'Create 6 concise Q&A study flashcards covering: '
          : studyFormat === 'quiz'
            ? 'Generate a 5-question multiple choice practice quiz with answer explanations on: '
            : 'Provide a clear structured study guide and executive summary for: ';
      onLaunchPrompt(`${prefix}${studyTopic.trim()}`, 'study');
    };

    return (
      <div className="w-full max-w-[920px] mx-auto px-4 sm:px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-600 dark:text-indigo-300">
              Study & Productivity Workspace
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
              Learn, Summarize & Master Faster
            </h1>
          </div>
          <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
        </div>

        <form
          onSubmit={handleLaunchStudy}
          className="mt-6 p-5 sm:p-6 rounded-[24px] bg-white/85 dark:bg-slate-800/70 border border-white/90 dark:border-white/10 shadow-sm space-y-4"
        >
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'summary', label: 'Concept Guide' },
                { id: 'flashcards', label: 'Flashcards' },
                { id: 'quiz', label: 'Practice Quiz' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStudyFormat(opt.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  studyFormat === opt.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={studyTopic}
            onChange={(e) => setStudyTopic(e.target.value)}
            aria-label="Paste study notes or topic"
            placeholder="Paste lecture notes, a tough textbook paragraph, or enter a topic like 'Operating System Deadlocks'..."
            className="w-full p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="w-3.5 h-3.5" />
              <span>Tip: You can also attach PDFs directly in the composer below.</span>
            </span>
            <button
              type="submit"
              disabled={!studyTopic.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer dark:bg-white dark:text-slate-900"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate in MAVI Chat</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Planning & Creativity Workspace
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    onAddTask(newTaskTitle.trim(), newTaskCat);
    setNewTaskTitle('');
  };

  return (
    <div className="w-full max-w-[920px] mx-auto px-4 sm:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-600 dark:text-teal-300">
            Planning & Creativity Workspace
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Organize Goals & Creative Sprints
          </h1>
        </div>
        <Calendar className="w-6 h-6 text-teal-600 dark:text-teal-300" />
      </div>

      <div className="p-4 rounded-[22px] bg-white/85 dark:bg-slate-800/70 border border-white/90 dark:border-white/10 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={aiPlanGoal}
          onChange={(e) => setAiPlanGoal(e.target.value)}
          aria-label="Goal for AI roadmap"
          placeholder="Ask MAVI to map out a goal (e.g., Launch portfolio site in 2 weeks)..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none"
        />
        <button
          type="button"
          disabled={!aiPlanGoal.trim()}
          onClick={() =>
            onLaunchPrompt(
              `Build a prioritized milestone and creative execution plan for: ${aiPlanGoal.trim()}`,
              'planning',
            )
          }
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer dark:bg-white dark:text-slate-900 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generate AI Roadmap</span>
        </button>
      </div>

      <div className="p-5 rounded-[24px] bg-white/82 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-4">
        <form onSubmit={handleCreateTask} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            aria-label="New task title"
            placeholder="Add a task or creative milestone..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white focus:outline-none"
          />
          <select
            value={newTaskCat}
            onChange={(e) => setNewTaskCat(e.target.value as PlannerTask['category'])}
            aria-label="Task category"
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="Focus">Focus</option>
            <option value="Build">Build</option>
            <option value="Study">Study</option>
            <option value="Creative">Creative</option>
          </select>
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 cursor-pointer dark:bg-white dark:text-slate-900"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        </form>

        <div className="divide-y divide-slate-900/[0.06] dark:divide-white/10">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-3 py-3">
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      task.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {task.category} · {task.dueLabel}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                aria-label={`Delete task ${task.title}`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
