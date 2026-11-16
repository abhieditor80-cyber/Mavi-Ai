import React, { useState } from 'react';
import { ArrowUpRight, BookOpen, Calendar, Layers } from 'lucide-react';
import type { AccentId } from '../types/mavi';
import { MAVI_ASSETS, getAccentTokens } from '../utils/chatLogic';

interface WelcomeDashboardProps {
  accent: AccentId;
  onQuickStartChat: () => void;
  onOpenStudyWorkspace: () => void;
  onOpenPlanningWorkspace: () => void;
}

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  accent,
  onQuickStartChat,
  onOpenStudyWorkspace,
  onOpenPlanningWorkspace,
}) => {
  const [mascotError, setMascotError] = useState(false);
  const accentTokens = getAccentTokens(accent);

  const cards = [
    {
      id: 'quick-start',
      kicker: 'Quick Start',
      title: 'Your ideas, powered by AI.',
      description:
        'Ask questions, discover ideas, write content and solve problems with your personal AI assistant.',
      icon: Layers,
      iconTone:
        'bg-blue-500/10 text-blue-600 dark:bg-sky-400/15 dark:text-sky-300',
      onClick: onQuickStartChat,
    },
    {
      id: 'study-work',
      kicker: 'Study & Productivity',
      title: 'Learn, create and work smarter.',
      description:
        'Understand difficult topics, summarize documents, generate notes and improve your productivity.',
      icon: BookOpen,
      iconTone:
        'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-300',
      onClick: onOpenStudyWorkspace,
    },
    {
      id: 'plan-create',
      kicker: 'Planning & Creativity',
      title: 'Organize your time and ideas.',
      description:
        'Plan projects, organize tasks, explore creative ideas and stay focused on your goals.',
      icon: Calendar,
      iconTone:
        'bg-teal-500/10 text-teal-600 dark:bg-teal-400/15 dark:text-teal-300',
      onClick: onOpenPlanningWorkspace,
    },
  ];

  return (
    <div className="w-full max-w-[1060px] mx-auto px-4 sm:px-8 pt-4 sm:pt-7 pb-4 flex flex-col gap-6 sm:gap-8">
      {/* Upper-Middle Welcome Section + 3D Mascot */}
      <section className="grid grid-cols-1 lg:grid-cols-12 items-center gap-6 lg:gap-4">
        <div className="lg:col-span-7 flex flex-col items-start text-left">
          <h1 className="font-display text-[32px] sm:text-[42px] lg:text-[48px] font-bold leading-[1.12] tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
            Hi there, Ready to{' '}
            <br />
            <span
              className={`bg-gradient-to-r ${accentTokens.gradientText} bg-clip-text text-transparent`}
            >
              Achieve Great Things?
            </span>
          </h1>
          <p className="mt-3.5 text-[15px] sm:text-[16px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-[540px]">
            Your ideas deserve intelligence. Ask MAVI anything and turn your thoughts into reality.
          </p>
        </div>

        {/* Right: 3D AI Robot Mascot + Floating Speech Bubble */}
        <div className="lg:col-span-5 flex items-center justify-center lg:justify-end">
          <div className="relative flex items-center gap-3 sm:gap-4">
            {/* Floating Speech Bubble */}
            <div className="relative max-w-[205px] px-4 py-3 rounded-2xl backdrop-blur-xl bg-white/90 dark:bg-slate-800/90 border border-white/90 dark:border-white/15 shadow-[0_12px_32px_rgba(15,23,42,0.09)] text-slate-800 dark:text-slate-100">
              <p className="text-[13px] font-semibold leading-snug">
                Hey there! 👋
              </p>
              <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-snug mt-0.5">
                What shall we create today?
              </p>
              <span
                aria-hidden="true"
                className="hidden sm:block absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-white/90 dark:bg-slate-800/90 border-r border-t border-white/90 dark:border-white/15"
              />
            </div>

            {/* 3D Robot Mascot */}
            <div className="relative flex flex-col items-center">
              <div className="mavi-float relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden bg-gradient-to-b from-indigo-50/90 via-white/80 to-sky-50/80 dark:from-slate-800/90 dark:via-slate-800/75 dark:to-indigo-950/80 border border-white/90 dark:border-sky-300/20 shadow-[0_20px_44px_rgba(37,99,235,0.14)] dark:shadow-[0_20px_44px_rgba(56,189,248,0.16)] flex items-center justify-center">
                {!mascotError ? (
                  <img
                    src={MAVI_ASSETS.mascot}
                    alt="MAVI AI 3D robot assistant mascot"
                    referrerPolicy="no-referrer"
                    onError={() => setMascotError(true)}
                    style={{
                      WebkitMaskImage:
                        'radial-gradient(circle at 50% 48%, black 55%, transparent 94%)',
                      maskImage:
                        'radial-gradient(circle at 50% 48%, black 55%, transparent 94%)',
                    }}
                    className="w-full h-full object-cover scale-105 dark:brightness-95"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 text-cyan-300">
                    <div className="flex gap-3">
                      <span className="w-3 h-3 rounded-full bg-cyan-300" />
                      <span className="w-3 h-3 rounded-full bg-cyan-300" />
                    </div>
                  </div>
                )}
              </div>
              <div
                aria-hidden="true"
                className="w-24 h-2.5 mt-2 rounded-full bg-slate-900/10 dark:bg-black/40 blur-[4px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Three Horizontal Feature Cards */}
      <section aria-label="Featured capabilities" className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={card.onClick}
              className="group text-left flex flex-col justify-between p-5 sm:p-6 rounded-[24px] bg-white/82 hover:bg-white/95 dark:bg-slate-800/65 dark:hover:bg-slate-800/85 border border-white/90 dark:border-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.05)] hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)] hover:-translate-y-1 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${card.iconTone}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>

                <p className="mt-4 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                  {card.kicker}
                </p>
                <h2 className="mt-1 font-display text-[17px] font-bold text-slate-900 dark:text-white leading-snug">
                  {card.title}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {card.description}
                </p>
              </div>
            </button>
          );
        })}
      </section>
    </div>
  );
};
