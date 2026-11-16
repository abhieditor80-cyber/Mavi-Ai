import type { GatewayAttachment, GatewayMessage } from './ai-gateway.ts';

export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

export interface OllamaResolvedConfig {
  baseUrl: string;
  model: string;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface OllamaConnectionTestResult {
  ok: boolean;
  status: 'connected' | 'model_missing' | 'offline';
  provider: string;
  modelReady: boolean;
  availableModelCount?: number;
  latencyMs?: number;
  message: string;
}

export function resolveOllamaConfig(providerOverride?: {
  endpointUrl?: string | null;
  defaultModel?: string | null;
}): OllamaResolvedConfig {
  const envUrl = process.env.OLLAMA_BASE_URL?.trim();
  const envModel = process.env.OLLAMA_DEFAULT_MODEL?.trim();

  const dbUrl = providerOverride?.endpointUrl?.trim();
  const normalizedDbUrl =
    dbUrl && dbUrl !== 'http://localhost:11434' ? dbUrl : undefined;

  const dbModel = providerOverride?.defaultModel?.trim();
  const normalizedDbModel =
    dbModel && dbModel !== 'llama3.2' ? dbModel : undefined;

  const rawUrl = envUrl || normalizedDbUrl || DEFAULT_OLLAMA_BASE_URL;
  const baseUrl = rawUrl.replace(/\/+$/, '');
  const model = envModel || normalizedDbModel || DEFAULT_OLLAMA_MODEL;

  return { baseUrl, model };
}

export function buildOllamaMessages(
  messages: GatewayMessage[],
  latestAttachments: GatewayAttachment[] = [],
  systemInstruction?: string,
): OllamaChatMessage[] {
  const result: OllamaChatMessage[] = [];

  if (systemInstruction?.trim()) {
    result.push({
      role: 'system',
      content: systemInstruction.trim(),
    });
  }

  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  messages.forEach((msg, idx) => {
    const trimmedContent = (msg.content ?? '').trim();
    if (msg.role === 'assistant' && !trimmedContent) {
      return;
    }

    const attachmentsToInclude =
      idx === lastUserIdx ? latestAttachments : msg.attachments ?? [];

    const textParts: string[] = [];
    const images: string[] = [];

    for (const att of attachmentsToInclude) {
      if (att.kind === 'image' && att.dataBase64) {
        images.push(att.dataBase64);
      } else if (att.textContent) {
        textParts.push(
          `[Attached file: ${att.name}]\n\`\`\`\n${att.textContent.slice(0, 32000)}\n\`\`\``,
        );
      } else if (att.name) {
        textParts.push(`[Attached ${att.kind}: ${att.name}]`);
      }
    }

    if (trimmedContent) {
      textParts.push(trimmedContent);
    } else if (images.length > 0) {
      textParts.push('Please analyze the attached image(s).');
    }

    const content = textParts.join('\n\n').trim();
    if (!content && images.length === 0) {
      return;
    }

    const entry: OllamaChatMessage = {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content,
    };
    if (images.length > 0) {
      entry.images = images;
    }
    result.push(entry);
  });

  return result;
}

export interface ParsedOllamaChunk {
  content: string;
  done: boolean;
  evalCount?: number;
  promptEvalCount?: number;
  error?: string;
}

export function parseOllamaNdjsonLine(line: string): ParsedOllamaChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parsed = JSON.parse(trimmed) as {
    message?: { content?: string };
    response?: string;
    done?: boolean;
    eval_count?: number;
    prompt_eval_count?: number;
    error?: string;
  };

  if (parsed.error) {
    return {
      content: '',
      done: true,
      error: parsed.error,
    };
  }

  return {
    content: parsed.message?.content ?? parsed.response ?? '',
    done: Boolean(parsed.done),
    evalCount: typeof parsed.eval_count === 'number' ? parsed.eval_count : undefined,
    promptEvalCount:
      typeof parsed.prompt_eval_count === 'number' ? parsed.prompt_eval_count : undefined,
  };
}

export function formatFriendlyOllamaError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.message} ${err.cause instanceof Error ? err.cause.message : ''}`
      : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('model') &&
    (lower.includes('not found') || lower.includes('404') || lower.includes('pull'))
  ) {
    return 'The configured local AI model is not available on your Ollama server yet. Please pull the model in Ollama and try again.';
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('eai_again') ||
    lower.includes('socket') ||
    lower.includes('network') ||
    lower.includes('unreachable')
  ) {
    return 'Local Ollama AI server is currently offline or unreachable. Please start Ollama on your machine and try again.';
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    lower.includes('etimedout')
  ) {
    return 'The local Ollama AI server took too long to respond. Please check that Ollama is running and ready, then try again.';
  }

  if (lower.includes('http 404')) {
    return 'The configured local AI model or endpoint was not found on your Ollama server.';
  }

  if (lower.includes('http 5')) {
    return 'Your local Ollama server encountered an internal error while generating a response. Please try again.';
  }

  return 'Unable to reach your local Ollama AI server right now. Please make sure Ollama is running and try again.';
}

export function isOllamaModelInstalled(
  installedNames: string[],
  configuredModel: string,
): boolean {
  const target = configuredModel.trim().toLowerCase();
  if (!target) return false;
  return installedNames.some((name) => {
    const normalized = name.trim().toLowerCase();
    return normalized === target || normalized === `${target}:latest`;
  });
}

export async function testOllamaConnection(providerOverride?: {
  endpointUrl?: string | null;
  defaultModel?: string | null;
}): Promise<OllamaConnectionTestResult> {
  const { baseUrl, model } = resolveOllamaConfig(providerOverride);
  const startedAt = Date.now();

  try {
    const resp = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    const latencyMs = Math.max(1, Date.now() - startedAt);

    if (!resp.ok) {
      return {
        ok: false,
        status: 'offline',
        provider: 'Local Ollama',
        modelReady: false,
        latencyMs,
        message: `Local Ollama server responded with status ${resp.status}. Please check your Ollama service.`,
      };
    }

    const data = (await resp.json().catch(() => ({}))) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const modelNames = Array.isArray(data.models)
      ? data.models
          .map((m) => m.name || m.model || '')
          .filter(Boolean)
      : [];

    const modelReady = isOllamaModelInstalled(modelNames, model);

    if (!modelReady) {
      return {
        ok: true,
        status: 'model_missing',
        provider: 'Local Ollama',
        modelReady: false,
        availableModelCount: modelNames.length,
        latencyMs,
        message:
          'Connected to local Ollama server, but the configured default model is not installed yet. Pull the model in Ollama to start chatting.',
      };
    }

    return {
      ok: true,
      status: 'connected',
      provider: 'Local Ollama',
      modelReady: true,
      availableModelCount: modelNames.length,
      latencyMs,
      message: `Connected to local Ollama server (${latencyMs} ms). Ready to generate responses.`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'offline',
      provider: 'Local Ollama',
      modelReady: false,
      message: formatFriendlyOllamaError(err),
    };
  }
}

export async function streamOllamaChat(input: {
  messages: GatewayMessage[];
  attachments: GatewayAttachment[];
  systemInstruction: string;
  providerOverride?: { endpointUrl?: string | null; defaultModel?: string | null };
  onChunk: (text: string) => void;
}): Promise<{ tokensEstimated: number }> {
  const { baseUrl, model } = resolveOllamaConfig(input.providerOverride);
  const ollamaMessages = buildOllamaMessages(
    input.messages,
    input.attachments,
    input.systemInstruction,
  );

  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    throw new Error(formatFriendlyOllamaError(err), { cause: err });
  }

  if (!resp.ok || !resp.body) {
    const errBody = await resp.text().catch(() => '');
    let parsedErr = '';
    try {
      const json = JSON.parse(errBody) as { error?: string };
      if (json.error) parsedErr = json.error;
    } catch {
      parsedErr = errBody;
    }
    throw new Error(
      formatFriendlyOllamaError(
        new Error(parsedErr || `HTTP ${resp.status}`),
      ),
    );
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let charCount = 0;
  let actualTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const parsed = parseOllamaNdjsonLine(line);
      if (!parsed) continue;
      if (parsed.error) {
        throw new Error(formatFriendlyOllamaError(new Error(parsed.error)));
      }
      if (parsed.content) {
        charCount += parsed.content.length;
        input.onChunk(parsed.content);
      }
      if (parsed.evalCount || parsed.promptEvalCount) {
        actualTokens = (parsed.evalCount ?? 0) + (parsed.promptEvalCount ?? 0);
      }
    }
  }

  if (buffer.trim()) {
    const trailing = parseOllamaNdjsonLine(buffer);
    if (trailing?.error) {
      throw new Error(formatFriendlyOllamaError(new Error(trailing.error)));
    }
    if (trailing?.content) {
      charCount += trailing.content.length;
      input.onChunk(trailing.content);
    }
    if (trailing?.evalCount || trailing?.promptEvalCount) {
      actualTokens =
        (trailing.evalCount ?? 0) + (trailing.promptEvalCount ?? 0);
    }
  }

  const estTokens =
    actualTokens > 0 ? actualTokens : Math.max(10, Math.round(charCount / 3.5));
  return { tokensEstimated: estTokens };
}
