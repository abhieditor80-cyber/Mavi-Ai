import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import { asc } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import { aiProviders } from '../src/db/schema.ts';
import { ensureSeeded, updateProviderTelemetry } from '../src/db/repository.ts';
import { streamOllamaChat } from './ollama.ts';

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export interface GatewayAttachment {
  name: string;
  mimeType: string;
  kind: 'image' | 'pdf' | 'document';
  dataBase64?: string;
  textContent?: string;
}

export interface GatewayMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: GatewayAttachment[];
}

export type GatewayMode =
  | 'general'
  | 'deep_research'
  | 'image'
  | 'web_search'
  | 'study'
  | 'coding'
  | 'planning'
  | 'data_analyst'
  | 'agents';

export type GatewayModelId =
  | 'mavi-assistant-1.0'
  | 'mavi-deep-reason'
  | 'mavi-swift';

export function buildSystemInstruction(mode: GatewayMode, memoryNotes?: string): string {
  const base =
    'You are MAVI AI ("One Plan. All Features. Unlimited Possibilities."), an intelligent, friendly, precise AI assistant supporting English, Telugu (తెలుగు), and Tenglish (Telugu written in English script). Match the user\'s preferred language naturally. Format responses cleanly with Markdown headings, structured lists, tables, Mermaid diagrams, and fenced code blocks with language tags when helpful.';

  const memorySegment = memoryNotes?.trim()
    ? `\n\nUser preference & workspace context (remembered by user setting):\n${memoryNotes.trim().slice(0, 800)}`
    : '';

  switch (mode) {
    case 'deep_research':
      return `${base} Operate in MAVI Research (Deep Research) mode: provide thorough, multi-perspective analysis, verify assumptions, compare trade-offs in structured tables when relevant, and conclude with actionable takeaways.${memorySegment}`;
    case 'web_search':
      return `${base} Operate in Search Web mode: use live Google Search grounding when available to answer with accurate, up-to-date facts and cite key points clearly.${memorySegment}`;
    case 'study':
      return `${base} Operate in MAVI Study mode: break down complex concepts intuitively, give step-by-step explanations, analogies, and include 2-3 active-recall check questions at the end.${memorySegment}`;
    case 'coding':
      return `${base} Operate in MAVI Code mode: write clean, idiomatic, production-grade TypeScript/React/Python/SQL code with clear edge-case handling and concise explanations.${memorySegment}`;
    case 'planning':
      return `${base} Operate in MAVI Projects & Planning mode: organize ideas into clear phases, milestones, priorities, diagrams, and realistic next steps.${memorySegment}`;
    case 'data_analyst':
      return `${base} Operate in MAVI Data Analyst & Personal Finance mode: structure calculations, budgets (in INR ₹ when relevant), ratios, and clear Markdown tables with exact formulas.${memorySegment}`;
    case 'agents':
      return `${base} Operate in MAVI Agents mode: design autonomous multi-step execution workflows, tool chains, verification gates, and clear step-by-step action checklists.${memorySegment}`;
    case 'image':
      return `${base} Operate in MAVI Image Studio mode: create a rich, detailed, self-contained vector artwork as a valid \`\`\`svg ... \`\`\` block (with viewBox="0 0 800 520", clean layered gradients, crisp shapes, and harmonious composition—never include <script> tags). Also provide a brief caption below the SVG block.${memorySegment}`;
    default:
      return `${base}${memorySegment}`;
  }
}

export function resolveGeminiConfig(
  modelId: GatewayModelId,
  mode: GatewayMode,
  allowedTier: 'standard' | 'advanced' | 'pro',
): { model: string; thinkingLevel?: ThinkingLevel } {
  // Plan-based routing: standard tier routes deep_reason down to balanced standard if unentitled
  if (
    (mode === 'deep_research' || modelId === 'mavi-deep-reason') &&
    allowedTier !== 'standard'
  ) {
    return {
      model: 'gemini-4-hydrogen',
      thinkingLevel: allowedTier === 'pro' ? ThinkingLevel.XHIGH : ThinkingLevel.HIGH,
    };
  }
  if (modelId === 'mavi-swift') {
    return {
      model: 'gemini-3.1-flash-lite',
    };
  }
  // Default low-latency reasoning on gemini-4-hydrogen so first token streams quickly
  return {
    model: 'gemini-4-hydrogen',
    thinkingLevel: ThinkingLevel.LOW,
  };
}

function toGeminiContents(
  messages: GatewayMessage[],
  latestAttachments: GatewayAttachment[] = [],
): Content[] {
  return messages.map((msg, idx) => {
    const isLastUser = idx === messages.length - 1 && msg.role === 'user';
    const attachmentsToInclude = isLastUser
      ? latestAttachments
      : msg.attachments ?? [];

    const parts: Part[] = [];

    for (const att of attachmentsToInclude) {
      if ((att.kind === 'image' || att.kind === 'pdf') && att.dataBase64) {
        parts.push({
          inlineData: {
            mimeType:
              att.mimeType || (att.kind === 'pdf' ? 'application/pdf' : 'image/png'),
            data: att.dataBase64,
          },
        });
      } else if (att.textContent) {
        parts.push({
          text: `[Attached file: ${att.name}]\n\`\`\`\n${att.textContent.slice(0, 32000)}\n\`\`\``,
        });
      }
    }

    if (msg.content.trim()) {
      parts.push({ text: msg.content });
    } else if (parts.length > 0) {
      parts.push({ text: 'Please analyze the attached file(s).' });
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

export interface StreamGatewayCallbacks {
  onProviderSelected: (providerName: string) => void;
  onChunk: (text: string) => void;
  onSources: (sources: Array<{ title: string; uri: string }>) => void;
}

export async function streamFromConfiguredProviders(input: {
  messages: GatewayMessage[];
  attachments: GatewayAttachment[];
  modelId: GatewayModelId;
  mode: GatewayMode;
  allowedTier: 'standard' | 'advanced' | 'pro';
  memoryNotes?: string;
  callbacks: StreamGatewayCallbacks;
}): Promise<{ providerId: string; tokensEstimated: number }> {
  let providers: Array<{
    id: string;
    displayName: string;
    enabled: boolean;
    priority: number;
    endpointUrl: string | null;
    defaultModel: string;
  }> = [];

  try {
    await ensureSeeded();
    providers = await db
      .select()
      .from(aiProviders)
      .orderBy(asc(aiProviders.priority));
  } catch {
    providers = [
      {
        id: 'ollama',
        displayName: 'Local Ollama',
        enabled: true,
        priority: 1,
        endpointUrl: null,
        defaultModel: '',
      },
    ];
  }

  const enabledProviders = providers.filter((p) => p.enabled);
  if (enabledProviders.length === 0) {
    throw new Error(
      'No AI providers are currently enabled. Ask an administrator to enable a provider in the Admin Dashboard.',
    );
  }

  const systemInstruction = buildSystemInstruction(input.mode, input.memoryNotes);
  const errors: string[] = [];

  for (const provider of enabledProviders) {
    if (provider.id === 'gemini') {
      const ai = getGeminiClient();
      if (!ai) {
        errors.push('Google Gemini API key (GEMINI_API_KEY) is not configured.');
        continue;
      }

      try {
        input.callbacks.onProviderSelected(provider.displayName);
        const { model, thinkingLevel } = resolveGeminiConfig(
          input.modelId,
          input.mode,
          input.allowedTier,
        );
        const contents = toGeminiContents(input.messages, input.attachments);
        const config: Record<string, unknown> = { systemInstruction };
        if (thinkingLevel) config.thinkingConfig = { thinkingLevel };
        if (input.mode === 'web_search' || input.mode === 'deep_research') {
          config.tools = [{ googleSearch: {} }];
        }

        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config,
        });

        const sourcesMap = new Map<string, { title: string; uri: string }>();
        let charCount = 0;

        for await (const chunk of stream) {
          if (chunk.text) {
            charCount += chunk.text.length;
            input.callbacks.onChunk(chunk.text);
          }
          const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (Array.isArray(grounding)) {
            for (const g of grounding) {
              if (g.web?.uri) {
                sourcesMap.set(g.web.uri, {
                  uri: g.web.uri,
                  title: g.web.title || g.web.uri,
                });
              }
            }
          }
        }

        if (sourcesMap.size > 0) {
          input.callbacks.onSources(Array.from(sourcesMap.values()).slice(0, 6));
        }

        const estTokens = Math.max(20, Math.round(charCount / 3.5));
        await updateProviderTelemetry({ providerId: 'gemini', tokens: estTokens });
        return { providerId: 'gemini', tokensEstimated: estTokens };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gemini request failed';
        await updateProviderTelemetry({ providerId: 'gemini', tokens: 0, error: msg });
        errors.push(`Gemini: ${msg}`);
        continue;
      }
    }

    if (provider.id === 'ollama') {
      try {
        input.callbacks.onProviderSelected(provider.displayName);
        const { tokensEstimated } = await streamOllamaChat({
          messages: input.messages,
          attachments: input.attachments,
          systemInstruction,
          providerOverride: {
            endpointUrl: provider.endpointUrl,
            defaultModel: provider.defaultModel,
          },
          onChunk: input.callbacks.onChunk,
        });

        await updateProviderTelemetry({
          providerId: 'ollama',
          tokens: tokensEstimated,
        });
        return { providerId: 'ollama', tokensEstimated };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Local Ollama AI server is currently offline or unreachable.';
        await updateProviderTelemetry({ providerId: 'ollama', tokens: 0, error: msg });
        if (enabledProviders.length === 1) {
          throw new Error(msg);
        }
        errors.push(`Ollama: ${msg}`);
        continue;
      }
    }

    if (provider.id === 'openai_compat') {
      const baseUrl = provider.endpointUrl || process.env.COMPAT_AI_BASE_URL;
      const apiKey = process.env.COMPAT_AI_API_KEY;
      if (!baseUrl || !apiKey) {
        errors.push('OpenAI-compatible gateway URL or key is not configured.');
        continue;
      }

      try {
        input.callbacks.onProviderSelected(provider.displayName);
        const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: provider.defaultModel || 'gpt-4o-mini',
            stream: true,
            messages: [
              { role: 'system', content: systemInstruction },
              ...input.messages.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`Compatible provider returned HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let charCount = 0;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
            const parsed = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              charCount += text.length;
              input.callbacks.onChunk(text);
            }
          }
        }

        const estTokens = Math.max(20, Math.round(charCount / 3.5));
        await updateProviderTelemetry({ providerId: 'openai_compat', tokens: estTokens });
        return { providerId: 'openai_compat', tokensEstimated: estTokens };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Compatible gateway failed';
        await updateProviderTelemetry({ providerId: 'openai_compat', tokens: 0, error: msg });
        errors.push(`Compatible AI: ${msg}`);
        continue;
      }
    }
  }

  throw new Error(
    errors.length > 0
      ? `All enabled AI providers failed or are unconfigured: ${errors.join(' | ')}`
      : 'No AI provider is configured. Configure GEMINI_API_KEY or an Ollama endpoint on the server.',
  );
}
