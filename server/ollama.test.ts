import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  buildOllamaMessages,
  formatFriendlyOllamaError,
  isOllamaModelInstalled,
  parseOllamaNdjsonLine,
  resolveOllamaConfig,
} from './ollama.ts';

test('resolveOllamaConfig defaults to 127.0.0.1:11434 and qwen2.5:3b and upgrades legacy seed values', () => {
  const prevUrl = process.env.OLLAMA_BASE_URL;
  const prevModel = process.env.OLLAMA_DEFAULT_MODEL;
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_DEFAULT_MODEL;

  try {
    assert.deepEqual(resolveOllamaConfig(), {
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: DEFAULT_OLLAMA_MODEL,
    });

    assert.deepEqual(
      resolveOllamaConfig({
        endpointUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
      }),
      {
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen2.5:3b',
      },
    );

    assert.deepEqual(
      resolveOllamaConfig({
        endpointUrl: 'http://127.0.0.1:11434/',
        defaultModel: 'qwen2.5:7b',
      }),
      {
        baseUrl: 'http://127.0.0.1:11434',
        model: 'qwen2.5:7b',
      },
    );
  } finally {
    if (prevUrl !== undefined) process.env.OLLAMA_BASE_URL = prevUrl;
    if (prevModel !== undefined) process.env.OLLAMA_DEFAULT_MODEL = prevModel;
  }
});

test('buildOllamaMessages preserves conversation history, system prompt, and latest attachments', () => {
  const result = buildOllamaMessages(
    [
      { role: 'user', content: 'Hi MAVI' },
      { role: 'assistant', content: 'Hello! How can I help?' },
      { role: 'user', content: 'Summarize this file.' },
    ],
    [
      {
        name: 'notes.md',
        mimeType: 'text/markdown',
        kind: 'document',
        textContent: '# Study Plan\nDay 1: Algebra',
      },
    ],
    'You are MAVI AI.',
  );

  assert.equal(result.length, 4);
  assert.deepEqual(result[0], { role: 'system', content: 'You are MAVI AI.' });
  assert.deepEqual(result[1], { role: 'user', content: 'Hi MAVI' });
  assert.deepEqual(result[2], { role: 'assistant', content: 'Hello! How can I help?' });
  assert.equal(result[3].role, 'user');
  assert.ok(result[3].content.includes('[Attached file: notes.md]'));
  assert.ok(result[3].content.includes('Day 1: Algebra'));
  assert.ok(result[3].content.includes('Summarize this file.'));
});

test('parseOllamaNdjsonLine parses message chunks, completion metadata, and Ollama errors', () => {
  assert.equal(parseOllamaNdjsonLine('   '), null);

  const chunk = parseOllamaNdjsonLine(
    '{"model":"qwen2.5:3b","message":{"role":"assistant","content":"Hello"},"done":false}',
  );
  assert.deepEqual(chunk, {
    content: 'Hello',
    done: false,
    evalCount: undefined,
    promptEvalCount: undefined,
  });

  const finalChunk = parseOllamaNdjsonLine(
    '{"done":true,"eval_count":42,"prompt_eval_count":18}',
  );
  assert.deepEqual(finalChunk, {
    content: '',
    done: true,
    evalCount: 42,
    promptEvalCount: 18,
  });

  const errChunk = parseOllamaNdjsonLine(
    '{"error":"model \'qwen2.5:3b\' not found"}',
  );
  assert.equal(errChunk?.error, "model 'qwen2.5:3b' not found");
});

test('formatFriendlyOllamaError returns clear user-facing errors without leaking server details', () => {
  const offlineMsg = formatFriendlyOllamaError(new Error('connect ECONNREFUSED 127.0.0.1:11434'));
  assert.ok(offlineMsg.toLowerCase().includes('offline'));
  assert.ok(!offlineMsg.includes('11434'));

  const missingModelMsg = formatFriendlyOllamaError(
    new Error("model 'qwen2.5:3b' not found"),
  );
  assert.ok(missingModelMsg.toLowerCase().includes('not available'));
  assert.ok(!missingModelMsg.includes('127.0.0.1'));

  const timeoutMsg = formatFriendlyOllamaError(new Error('The operation timed out'));
  assert.ok(timeoutMsg.toLowerCase().includes('too long'));
});

test('isOllamaModelInstalled matches exact and :latest model tags', () => {
  assert.equal(isOllamaModelInstalled(['qwen2.5:3b', 'llama3:8b'], 'qwen2.5:3b'), true);
  assert.equal(isOllamaModelInstalled(['qwen2.5:latest'], 'qwen2.5'), true);
  assert.equal(isOllamaModelInstalled(['llama3:8b'], 'qwen2.5:3b'), false);
});

test('testOllamaConnection and streamOllamaChat work over real HTTP NDJSON streaming', async () => {
  const http = await import('node:http');
  const { testOllamaConnection, streamOllamaChat } = await import('./ollama.ts');

  const server = http.createServer((req, res) => {
    if (req.url === '/api/tags' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [{ name: 'qwen2.5:3b' }] }));
      return;
    }
    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        const parsed = JSON.parse(body) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
          stream: boolean;
        };
        assert.equal(parsed.model, 'qwen2.5:3b');
        assert.equal(parsed.stream, true);
        assert.equal(parsed.messages.length, 4); // system + 3 history turns

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
        res.write(
          `${JSON.stringify({ message: { role: 'assistant', content: 'Hello ' }, done: false })}\n`,
        );
        res.write(
          `${JSON.stringify({ message: { role: 'assistant', content: 'from Ollama!' }, done: false })}\n`,
        );
        res.end(
          `${JSON.stringify({ done: true, eval_count: 12, prompt_eval_count: 20 })}\n`,
        );
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const testUrl = `http://127.0.0.1:${address.port}`;

  try {
    const conn = await testOllamaConnection({
      endpointUrl: testUrl,
      defaultModel: 'qwen2.5:3b',
    });
    assert.equal(conn.ok, true);
    assert.equal(conn.status, 'connected');
    assert.equal(conn.modelReady, true);

    const chunks: string[] = [];
    const res = await streamOllamaChat({
      messages: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Follow up' },
      ],
      attachments: [],
      systemInstruction: 'You are MAVI AI.',
      providerOverride: { endpointUrl: testUrl, defaultModel: 'qwen2.5:3b' },
      onChunk: (txt) => chunks.push(txt),
    });

    assert.equal(chunks.join(''), 'Hello from Ollama!');
    assert.equal(res.tokensEstimated, 32);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
