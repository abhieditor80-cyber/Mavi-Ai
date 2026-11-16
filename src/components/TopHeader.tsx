import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Settings, Sparkles } from 'lucide-react';
import type { MaviModelId } from '../types/mavi';
import { MAVI_MODELS, getGreetingForHour } from '../utils/chatLogic';
import { MaviLogo } from './MaviLogo';

interface TopHeaderProps {
  selectedModel: MaviModelId;
  onSelectModel: (id: MaviModelId) => void;
  centerTitle?: string;
  userName: string;
  userAvatarUrl: string;
  isSignedIn: boolean;
  planBadge?: string;
  onOpenUpgrade: () => void;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
  onLogoClick: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  selectedModel,
  onSelectModel,
  centerTitle,
  userName,
  userAvatarUrl,
  isSignedIn,
  planBadge,
  onOpenUpgrade,
  onOpenAccount,
  onOpenSettings,
  onLogoClick,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel =
    MAVI_MODELS.find((m) => m.id === selectedModel) ?? MAVI_MODELS[0];

  const greetingText = centerTitle || getGreetingForHour(new Date().getHours());

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <header className="flex items-center justify-between gap-1.5 sm:gap-4 px-2.5 sm:px-7 py-3 sm:py-3.5 border-b border-slate-900/[0.06] dark:border-white/[0.08] shrink-0">
      {/* Zone 1: MAVI AI Brand + Model Selector */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 lg:flex-initial">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-1.5 sm:gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-xl pr-0.5 sm:pr-1"
        >
          <MaviLogo size={26} />
          <span className="font-display text-[14px] sm:text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">
            MAVI AI
          </span>
        </button>

        <span
          aria-hidden="true"
          className="hidden sm:inline-block h-4 w-px bg-slate-900/10 dark:bg-white/15 shrink-0"
        />

        <div className="relative min-w-0 flex-1 sm:flex-initial" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label="Select MAVI AI model"
            className="flex items-center gap-1 sm:gap-1.5 max-w-full sm:max-w-none px-2 sm:px-3 py-1.5 rounded-full text-[11.5px] sm:text-[13px] font-medium whitespace-nowrap bg-white/80 hover:bg-white text-slate-800 border border-slate-900/10 shadow-2xs transition-colors cursor-pointer dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-100 dark:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <span className="truncate min-w-0">{currentModel.label}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Available MAVI models"
              className="absolute left-0 mt-2 w-72 p-1.5 rounded-2xl z-50 backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-white/15 shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
            >
              {MAVI_MODELS.map((model) => {
                const isSelected = model.id === selectedModel;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectModel(model.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900/[0.06] dark:bg-white/10'
                        : 'hover:bg-slate-900/[0.04] dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-900 dark:text-white">
                          {model.label}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          · {model.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {model.tagline}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Zone 2: Dynamic Greeting / Active Title */}
      <div className="hidden lg:flex items-center justify-center min-w-0 flex-1 px-4">
        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[340px]">
          {greetingText}
        </p>
      </div>

      {/* Zone 3: Single-Plan CTA + Account Avatar + Settings */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenUpgrade}
          className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-[11.5px] sm:text-[13px] font-semibold whitespace-nowrap shrink-0 bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 shadow-sm transition-all duration-150 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="sm:hidden">Unlimited</span>
          <span className="hidden sm:inline">
            {planBadge ? planBadge : 'MAVI Unlimited'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenAccount}
          aria-label={isSignedIn ? `Account menu for ${userName}` : 'Sign in or manage account'}
          title={isSignedIn ? userName : 'Sign in to MAVI AI'}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-white/90 dark:border-white/20 shadow-2xs hover:scale-105 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 bg-slate-200 dark:bg-slate-700"
        >
          <img
            src={userAvatarUrl}
            alt={userName}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings and customization"
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-white/80 hover:bg-white text-slate-700 border border-slate-900/10 shadow-2xs transition-colors cursor-pointer dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
