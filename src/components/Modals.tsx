import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Moon,
  RotateCcw,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import type {
  AccentId,
  ChatDensity,
  FontSizeOption,
  MaviSettings,
  SidebarStyle,
} from '../types/mavi';
import { DEFAULT_SETTINGS, MAVI_ASSETS } from '../utils/chatLogic';

interface SettingsModalProps {
  open: boolean;
  settings: MaviSettings;
  onUpdate: (patch: Partial<MaviSettings>) => void;
  onReset: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  onUpdate,
  onReset,
  onClose,
}) => {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean;
    status: 'connected' | 'model_missing' | 'offline';
    message: string;
    latencyMs?: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleTestAiConnection = async () => {
    setTestingConnection(true);
    try {
      const res = await fetch('/api/ai/test-connection', { method: 'POST' });
      const data = (await res.json()) as {
        ok?: boolean;
        status?: 'connected' | 'model_missing' | 'offline';
        message?: string;
        latencyMs?: number;
      };
      setConnectionResult({
        ok: Boolean(data.ok),
        status: data.status ?? (data.ok ? 'connected' : 'offline'),
        message:
          data.message ||
          (data.ok
            ? 'Connected to local Ollama AI server.'
            : 'Unable to reach local Ollama AI server.'),
        latencyMs: data.latencyMs,
      });
    } catch {
      setConnectionResult({
        ok: false,
        status: 'offline',
        message: 'Unable to reach the MAVI backend server to test the AI connection.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'customWallpaperUrl' | 'userAvatarUrl',
  ) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      if (field === 'customWallpaperUrl') {
        onUpdate({ customWallpaperUrl: result, wallpaperPreset: 'custom' });
      } else {
        onUpdate({ userAvatarUrl: result });
      }
    };
    reader.readAsDataURL(file);
  };

  const accents: Array<{ id: AccentId; label: string; color: string }> = [
    { id: 'sapphire', label: 'Sapphire', color: 'bg-blue-600' },
    { id: 'indigo', label: 'Indigo', color: 'bg-indigo-600' },
    { id: 'teal', label: 'Teal', color: 'bg-teal-600' },
    { id: 'rose', label: 'Coral', color: 'bg-rose-600' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MAVI AI Customization and Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-[640px] max-h-[86vh] overflow-y-auto mavi-scroll rounded-[28px] backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-white/15 shadow-[0_24px_64px_rgba(15,23,42,0.28)] p-6 sm:p-7 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-900/[0.08] dark:border-white/10">
          <div>
            <h2 className="font-display text-xl font-bold">Customize MAVI AI</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Liquid Glass appearance, wallpaper, profile, and layout preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Theme Mode */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
              Liquid Glass Theme
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onUpdate({ theme: 'light' })}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  settings.theme === 'light'
                    ? 'border-blue-600 bg-blue-50/70 text-slate-900 dark:bg-blue-950/30 dark:text-white'
                    : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">Light Liquid Glass</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Lavender & pearl white</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ theme: 'dark' })}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  settings.theme === 'dark'
                    ? 'border-sky-400 bg-slate-900 text-white'
                    : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <Moon className="w-4 h-4 text-sky-400" />
                <div>
                  <p className="text-sm font-semibold">Dark Liquid Glass</p>
                  <p className="text-xs text-slate-400">Deep navy & obsidian</p>
                </div>
              </button>
            </div>
          </div>

          {/* Profile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label
                htmlFor="mavi-user-name"
                className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Display Name
              </label>
              <input
                id="mavi-user-name"
                type="text"
                value={settings.userName}
                onChange={(e) => onUpdate({ userName: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-sm focus:outline-none"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Profile Picture
              </p>
              <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer">
                <img
                  src={settings.userAvatarUrl}
                  alt={settings.userName}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'userAvatarUrl')}
                />
              </label>
            </div>
          </div>

          {/* Background Wallpaper */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
              Background Wallpaper
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => onUpdate({ wallpaperPreset: 'ambient' })}
                className={`p-2 rounded-xl border text-center cursor-pointer ${
                  settings.wallpaperPreset === 'ambient'
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <div className="h-12 rounded-lg bg-gradient-to-br from-indigo-100 via-sky-50 to-white dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950" />
                <span className="block text-[11px] font-medium mt-1.5">Ambient Silk</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ wallpaperPreset: 'lavender_silk' })}
                className={`p-2 rounded-xl border text-center cursor-pointer ${
                  settings.wallpaperPreset === 'lavender_silk'
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <img
                  src={MAVI_ASSETS.wallpaperLight}
                  alt="Lavender Silk preset"
                  className="h-12 w-full object-cover rounded-lg"
                />
                <span className="block text-[11px] font-medium mt-1.5">Lavender Glass</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdate({ wallpaperPreset: 'midnight_glass' })}
                className={`p-2 rounded-xl border text-center cursor-pointer ${
                  settings.wallpaperPreset === 'midnight_glass'
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <img
                  src={MAVI_ASSETS.wallpaperDark}
                  alt="Midnight Glass preset"
                  className="h-12 w-full object-cover rounded-lg"
                />
                <span className="block text-[11px] font-medium mt-1.5">Midnight Prism</span>
              </button>

              <label
                className={`p-2 rounded-xl border text-center cursor-pointer flex flex-col items-center justify-center ${
                  settings.wallpaperPreset === 'custom'
                    ? 'border-blue-600 ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <div className="h-12 w-full rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-slate-500" />
                </div>
                <span className="block text-[11px] font-medium mt-1.5">Upload Custom</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e, 'customWallpaperUrl')}
                />
              </label>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Accent Gradient
            </p>
            <div className="flex flex-wrap gap-2.5">
              {accents.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onUpdate({ accent: acc.id })}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                    settings.accent === acc.id
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                      : 'border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${acc.color}`} />
                  <span>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography, Chat Density & Sidebar Style */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Font Size
              </p>
              <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800">
                {(['small', 'medium', 'large'] as FontSizeOption[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onUpdate({ fontSize: sz })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                      settings.fontSize === sz
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Chat Appearance
              </p>
              <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800">
                {(['cozy', 'compact'] as ChatDensity[]).map((dn) => (
                  <button
                    key={dn}
                    type="button"
                    onClick={() => onUpdate({ chatDensity: dn })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                      settings.chatDensity === dn
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {dn}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Sidebar Rail
              </p>
              <div className="flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800">
                {(['floating', 'expanded'] as SidebarStyle[]).map((sb) => (
                  <button
                    key={sb}
                    type="button"
                    onClick={() => onUpdate({ sidebarStyle: sb })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                      settings.sidebarStyle === sb
                        ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {sb}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Local AI Engine Connection */}
          <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                  <span>Local AI Engine (Ollama)</span>
                </p>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Verify that your server-side local Ollama connection is online and ready to stream responses.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestAiConnection}
                disabled={testingConnection}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <span>Test AI Connection</span>
                )}
              </button>
            </div>

            {connectionResult && (
              <div
                role="status"
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  connectionResult.status === 'connected'
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-200'
                    : connectionResult.status === 'model_missing'
                      ? 'bg-amber-50/90 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-500/30 dark:text-amber-200'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-500/30 dark:text-rose-200'
                }`}
              >
                {connectionResult.status === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {connectionResult.status === 'connected'
                      ? 'Connected · Ready'
                      : connectionResult.status === 'model_missing'
                        ? 'Connected · Model Setup Needed'
                        : 'Offline / Unreachable'}
                    {typeof connectionResult.latencyMs === 'number' && (
                      <span className="ml-2 font-normal opacity-75 tabular-nums">
                        ({connectionResult.latencyMs} ms)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 leading-relaxed opacity-90">
                    {connectionResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 pt-4 border-t border-slate-900/[0.08] dark:border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onReset();
              onUpdate(DEFAULT_SETTINGS);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
