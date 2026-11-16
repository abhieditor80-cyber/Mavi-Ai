import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Code2,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Mic,
  MicOff,
  Palette,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Telescope,
  X,
} from 'lucide-react';
import type { AssistantMode, AttachmentItem } from '../types/mavi';
import { QUICK_ACTIONS, formatFileSize, validateAttachment } from '../utils/chatLogic';

interface ChatComposerProps {
  value: string;
  onChange: (val: string) => void;
  activeMode: AssistantMode;
  onSelectMode: (mode: AssistantMode) => void;
  onOpenMoreTools: () => void;
  onOpenUpgrade: () => void;
  attachments: AttachmentItem[];
  onAddAttachments: (items: AttachmentItem[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  isSending: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  deep_research: Telescope,
  image: Palette,
  web_search: Globe,
  study: BookOpen,
  coding: Code2,
  more_tools: LayoutGrid,
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  activeMode,
  onSelectMode,
  onOpenMoreTools,
  onOpenUpgrade,
  attachments,
  onAddAttachments,
  onRemoveAttachment,
  onSend,
  isSending,
  inputRef,
}) => {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const activeQuickAction = QUICK_ACTIONS.find((q) => q.mode === activeMode && !q.opensToolsHub);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const readFileAsAttachment = (file: File): Promise<AttachmentItem | null> => {
    return new Promise((resolve) => {
      const check = validateAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!check.ok) {
        setAttachError(check.error);
        resolve(null);
        return;
      }

      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (check.kind === 'document') {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id,
            name: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            kind: 'document',
            textContent: String(reader.result ?? ''),
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result ?? '');
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve({
            id,
            name: file.name,
            mimeType: file.type || (check.kind === 'pdf' ? 'application/pdf' : 'image/png'),
            size: file.size,
            kind: check.kind,
            dataBase64: base64,
            previewUrl: check.kind === 'image' ? dataUrl : undefined,
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileSelection = async (files: FileList | null) => {
    setAttachMenuOpen(false);
    setAttachError(null);
    if (!files || files.length === 0) return;

    const results = await Promise.all(Array.from(files).map(readFileAsAttachment));
    const valid = results.filter((item): item is AttachmentItem => item !== null);
    if (valid.length > 0) {
      onAddAttachments(valid);
    }
  };

  const handleToggleVoice = () => {
    setVoiceNotice(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setVoiceNotice('Voice dictation is not supported in this browser environment.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onChange(value ? `${value.trimEnd()} ${transcript}` : transcript);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setVoiceNotice('Microphone permission was denied or unavailable.');
      };
      rec.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setVoiceNotice('Unable to start microphone input.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending && (value.trim() || attachments.length > 0)) {
        onSend();
      }
    }
  };

  const handleQuickActionClick = (action: (typeof QUICK_ACTIONS)[number]) => {
    if (action.opensToolsHub) {
      onOpenMoreTools();
      return;
    }
    if (activeMode === action.mode) {
      onSelectMode('general');
      return;
    }
    onSelectMode(action.mode);
    if (!value.trim()) {
      onChange(action.starterPrompt);
    }
    inputRef?.current?.focus();
  };

  const canSend = !isSending && (value.trim().length > 0 || attachments.length > 0);

  return (
    <div className="w-full max-w-[920px] mx-auto px-3 sm:px-6 pb-[74px] md:pb-4 pt-2 shrink-0">
      {/* Main Glass Composer Container */}
      <div className="rounded-[26px] backdrop-blur-2xl bg-white/86 dark:bg-slate-900/82 border border-white/95 dark:border-white/15 shadow-[0_14px_42px_rgba(15,23,42,0.09)] px-4 sm:px-5 pt-3 pb-3.5 transition-all">
        {/* Top Meta Strip */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-900/[0.05] dark:border-white/[0.07] text-[11.5px] sm:text-[12px]">
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white font-medium transition-colors text-left truncate cursor-pointer"
          >
            ✧ MAVI UNLIMITED · ₹199/mo — One Plan. All Features.
          </button>
          <span className="text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap shrink-0">
            ✧ Powered by MAVI AI
          </span>
        </div>

        {/* Active Mode & Attachment Chips */}
        {(activeMode !== 'general' || attachments.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-2.5">
            {activeMode !== 'general' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Sparkles className="w-3 h-3" />
                <span>{activeQuickAction?.label ?? activeMode}</span>
                <button
                  type="button"
                  onClick={() => onSelectMode('general')}
                  aria-label="Clear active tool mode"
                  className="ml-0.5 hover:opacity-75 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-2 pl-2 pr-2 py-1 rounded-xl text-xs bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200"
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                ) : (
                  <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span className="max-w-[140px] truncate font-medium">{att.name}</span>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {formatFileSize(att.size)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(att.id)}
                  aria-label={`Remove ${att.name}`}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(attachError || voiceNotice) && (
          <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
            {attachError || voiceNotice}
          </p>
        )}

        {/* Textarea Input */}
        <textarea
          ref={inputRef}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Ask MAVI AI"
          placeholder={
            activeQuickAction?.placeholder ??
            'Ask MAVI anything... Explain a concept, write code, create ideas or solve a problem.'
          }
          className="w-full mt-2.5 resize-none bg-transparent text-[14.5px] sm:text-[15px] leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none max-h-36 mavi-scroll"
        />

        {/* Hidden File Inputs */}
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            void handleFileSelection(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileSelection(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={docInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py,.html,.css,text/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFileSelection(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Bottom Controls Row */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1.5 relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              aria-label="Attach PDF, image, or document"
              aria-expanded={attachMenuOpen}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Image</span>
            </button>

            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Document</span>
            </button>

            {attachMenuOpen && (
              <div className="absolute bottom-11 left-0 w-52 p-1.5 rounded-2xl z-40 backdrop-blur-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-white/15 shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Upload PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>Upload image</span>
                </button>
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Paperclip className="w-4 h-4 text-teal-500" />
                  <span>Upload document</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              aria-label={isListening ? 'Stop voice dictation' : 'Start voice input'}
              aria-pressed={isListening}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                isListening
                  ? 'bg-rose-600 text-white shadow-md scale-105'
                  : 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                canSend
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:scale-105 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:text-slate-600'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick-Action Pill Buttons Row */}
      <div
        aria-label="Quick AI tools"
        className="flex items-center justify-start sm:justify-center gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar"
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = ACTION_ICONS[action.id] ?? Sparkles;
          const isSelected = !action.opensToolsHub && activeMode === action.mode;

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickActionClick(action)}
              aria-pressed={!action.opensToolsHub ? isSelected : undefined}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-medium whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md -translate-y-0.5 dark:bg-sky-400 dark:text-slate-950'
                  : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 border border-transparent dark:border-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
