import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import type { ChatDensity, ChatMessage, FontSizeOption } from '../types/mavi';
import { extractSvgFromContent } from '../utils/chatLogic';
import { MaviLogo } from './MaviLogo';

interface ConversationViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  fontSize: FontSizeOption;
  chatDensity: ChatDensity;
  userAvatarUrl: string;
  userName: string;
  onRegenerate: (assistantMessageId: string) => void;
  onFeedback: (messageId: string, feedback: 'up' | 'down') => void;
  onNewChat: () => void;
}

const CodeBlock: React.FC<{ className?: string; children?: React.ReactNode }> = ({
  className,
  children,
}) => {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children ?? '').replace(/\n$/, '');
  const langMatch = /language-(\w+)/.exec(className || '');
  const lang = langMatch?.[1] || 'code';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in non-secure context
    }
  };

  if (!className) {
    return (
      <code className="px-1.5 py-0.5 rounded-md text-[0.87em] font-mono bg-slate-900/[0.06] dark:bg-white/10 text-slate-900 dark:text-sky-200">
        {children}
      </code>
    );
  }

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-white/10 text-xs">
        <span className="font-mono text-slate-400">{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono mavi-scroll">
        <code>{rawCode}</code>
      </pre>
    </div>
  );
};

export const ConversationView: React.FC<ConversationViewProps> = ({
  messages,
  isStreaming,
  fontSize,
  chatDensity,
  userAvatarUrl,
  userName,
  onRegenerate,
  onFeedback,
  onNewChat,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isStreaming]);

  const textSizeClass =
    fontSize === 'small'
      ? 'text-[13.5px]'
      : fontSize === 'large'
        ? 'text-[16px]'
        : 'text-[14.5px]';

  const gapClass = chatDensity === 'compact' ? 'gap-3.5 py-3' : 'gap-5 py-5';

  const handleCopyMessage = async (msg: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopiedId(msg.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDownloadSvg = (svgMarkup: string) => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mavi-artwork-${Date.now()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 flex flex-col">
      {/* Subtle Top Conversation Action Strip */}
      <div className="flex items-center justify-between pt-3 pb-2 border-b border-slate-900/[0.05] dark:border-white/[0.06]">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Conversation · {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
        <button
          type="button"
          onClick={onNewChat}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-900/10 shadow-2xs transition-colors cursor-pointer dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-white/10"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      <div className={`flex flex-col ${gapClass}`}>
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const isLastAssistant =
            !isUser && index === messages.length - 1 && isStreaming && !msg.content;
          const isActivelyStreaming =
            !isUser && index === messages.length - 1 && isStreaming && Boolean(msg.content);
          const svgPreview = !isUser ? extractSvgFromContent(msg.content) : null;

          if (isUser) {
            return (
              <div key={msg.id} className="flex items-end justify-end gap-2.5">
                <div className="max-w-[82%] sm:max-w-[74%] flex flex-col items-end gap-2">
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {msg.attachments.map((att) =>
                        att.previewUrl ? (
                          <img
                            key={att.id}
                            src={att.previewUrl}
                            alt={att.name}
                            className="w-32 h-24 rounded-2xl object-cover border border-white/80 dark:border-white/15 shadow-sm"
                          />
                        ) : (
                          <div
                            key={att.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-900/85 text-white dark:bg-slate-800"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="max-w-[160px] truncate">{att.name}</span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                  <div
                    className={`px-4 py-3 rounded-[22px] rounded-br-md bg-slate-900 text-white dark:bg-blue-600 shadow-sm leading-relaxed whitespace-pre-wrap ${textSizeClass}`}
                  >
                    {msg.content}
                  </div>
                </div>
                <img
                  src={userAvatarUrl}
                  alt={userName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-white/90 dark:border-white/15 shrink-0"
                />
              </div>
            );
          }

          return (
            <div key={msg.id} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                <MaviLogo size={32} />
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className={`px-4 sm:px-5 py-3.5 rounded-[22px] rounded-tl-md backdrop-blur-xl border shadow-[0_6px_24px_rgba(15,23,42,0.04)] ${
                    msg.error
                      ? 'bg-rose-50/90 border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-500/30 dark:text-rose-200'
                      : 'bg-white/88 border-white/90 text-slate-800 dark:bg-slate-800/75 dark:border-white/10 dark:text-slate-100'
                  }`}
                >
                  {isLastAssistant ? (
                    <div
                      aria-label="MAVI AI is generating a response"
                      role="status"
                      className="flex items-center gap-3 py-1.5"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-sky-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-sky-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-sky-400 animate-bounce" />
                      </div>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                        Generating response with local AI...
                      </span>
                    </div>
                  ) : msg.error ? (
                    <div role="alert" className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                      <div className="space-y-2 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                          AI Connection Notice
                        </p>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        <button
                          type="button"
                          onClick={() => onRegenerate(msg.id)}
                          disabled={isStreaming}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Try Again</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {svgPreview && (
                        <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-3">
                          <div
                            className="w-full max-h-[340px] flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-[310px] [&>svg]:rounded-xl"
                            dangerouslySetInnerHTML={{ __html: svgPreview }}
                          />
                          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-200/70 dark:border-white/10">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              Vector Artwork · MAVI Visual Studio
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDownloadSvg(svgPreview)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download SVG</span>
                            </button>
                          </div>
                        </div>
                      )}

                      <div className={`mavi-prose leading-relaxed space-y-2.5 ${textSizeClass}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: ({ className, children }) => (
                              <CodeBlock className={className}>{children}</CodeBlock>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-blue-600 dark:text-sky-400 underline underline-offset-2 hover:opacity-80"
                              >
                                {children}
                              </a>
                            ),
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-3 rounded-xl border border-slate-200/80 dark:border-white/10">
                                <table>{children}</table>
                              </div>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-5 space-y-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-5 space-y-1">{children}</ol>
                            ),
                            h1: ({ children }) => (
                              <h1 className="font-display text-lg font-bold mt-3 mb-1">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="font-display text-base font-bold mt-3 mb-1">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="font-display text-sm font-bold mt-2.5 mb-1">{children}</h3>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>

                      {isActivelyStreaming && (
                        <div className="mt-2.5 flex items-center gap-2 text-[11.5px] font-medium text-blue-600 dark:text-sky-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-sky-400 animate-ping" />
                          <span>Streaming response...</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Grounded Web Search Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-slate-900/[0.06] dark:border-white/10">
                      <p className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        Grounded Sources
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src) => (
                          <a
                            key={src.uri}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-900 dark:text-slate-200 transition-colors max-w-[230px]"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assistant Action Controls */}
                {!isLastAssistant && msg.content && (
                  <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      aria-label="Copy response"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRegenerate(msg.id)}
                      disabled={isStreaming}
                      aria-label="Regenerate response"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-white/70 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onFeedback(msg.id, 'up')}
                      aria-label="Thumbs up"
                      aria-pressed={msg.feedback === 'up'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        msg.feedback === 'up'
                          ? 'text-blue-600 bg-blue-500/10 dark:text-sky-400'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onFeedback(msg.id, 'down')}
                      aria-label="Thumbs down"
                      aria-pressed={msg.feedback === 'down'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        msg.feedback === 'down'
                          ? 'text-rose-600 bg-rose-500/10 dark:text-rose-400'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
