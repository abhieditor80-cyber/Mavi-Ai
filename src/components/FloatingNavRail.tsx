import React from 'react';
import { Clock, Compass, LayoutGrid, Plus, Search } from 'lucide-react';
import type { NavTab, SidebarStyle } from '../types/mavi';
import { MaviLogo } from './MaviLogo';

interface FloatingNavRailProps {
  activeTab: NavTab;
  sidebarStyle: SidebarStyle;
  onSelectTab: (tab: NavTab) => void;
  onNewChat: () => void;
}

interface RailItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isNewChat?: boolean;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'chat', label: 'New Chat', icon: Plus, isNewChat: true },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'tools', label: 'AI Tools', icon: LayoutGrid },
  { id: 'history', label: 'History', icon: Clock },
];

export const FloatingNavRail: React.FC<FloatingNavRailProps> = ({
  activeTab,
  sidebarStyle,
  onSelectTab,
  onNewChat,
}) => {
  const isExpanded = sidebarStyle === 'expanded';

  const handleItemClick = (item: RailItem) => {
    if (item.isNewChat) {
      onNewChat();
    } else {
      onSelectTab(item.id);
    }
  };

  return (
    <>
      {/* Desktop Floating Left Rail */}
      <aside
        aria-label="Primary navigation"
        className={`hidden md:flex flex-col items-center justify-between py-4 shrink-0 transition-all duration-200 ${
          isExpanded ? 'w-[148px] px-2.5' : 'w-[64px]'
        }`}
      >
        <div
          className={`flex flex-col gap-3 p-2 rounded-[26px] border backdrop-blur-xl shadow-[0_12px_36px_rgba(15,23,42,0.08)] bg-white/75 border-white/80 dark:bg-slate-900/75 dark:border-white/10 ${
            isExpanded ? 'w-full items-stretch' : 'items-center'
          }`}
        >
          {RAIL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'tools' && (activeTab === 'study' || activeTab === 'planner'));

            return (
              <div key={item.id} className="relative group">
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 cursor-pointer ${
                    isExpanded
                      ? 'w-full gap-2.5 px-3 py-2.5 rounded-2xl text-[13px] font-medium whitespace-nowrap'
                      : 'w-11 h-11 justify-center rounded-full'
                  } ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                      : 'bg-white/90 text-slate-700 hover:bg-white hover:scale-105 shadow-[0_4px_14px_rgba(15,23,42,0.06)] dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </button>

                {!isExpanded && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 z-40 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 bg-slate-900 text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
                  >
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Circular MAVI AI Emblem */}
        <button
          type="button"
          onClick={onNewChat}
          aria-label="MAVI AI Home"
          title="MAVI AI — One AI. Unlimited Possibilities."
          className="w-12 h-12 rounded-full flex items-center justify-center bg-white/85 dark:bg-slate-900/85 border border-white/80 dark:border-white/10 shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:scale-105 transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <MaviLogo size={30} />
        </button>
      </aside>

      {/* Mobile Compact Bottom Navigation Dock */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-2.5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full backdrop-blur-2xl bg-white/88 dark:bg-slate-900/88 border border-white/80 dark:border-white/15 shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
      >
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeTab === item.id ||
            (item.id === 'tools' && (activeTab === 'study' || activeTab === 'planner'));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item)}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          );
        })}
      </nav>
    </>
  );
};
