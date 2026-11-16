import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAVI_MODELS,
  buildChatTitle,
  computeUsageSummary,
  extractSvgFromContent,
  filterConversations,
  formatFileSize,
  formatInr,
  formatStorageSafeguard,
  getAccentTokens,
  getGreetingForHour,
  groupConversationsByRecency,
  isSubscriptionActive,
  validateAttachment,
} from './chatLogic';
import type { Conversation } from '../types/mavi';

const sampleConversations: Conversation[] = [
  {
    id: 'c1',
    title: 'Quantum Entanglement Explained',
    createdAt: 1_700_000_000_000,
    updatedAt: new Date(2026, 10, 15, 14, 0, 0).getTime(),
    mode: 'study',
    modelId: 'mavi-assistant-1.0',
    messages: [
      { id: 'm1', role: 'user', content: 'Explain Bell inequalities simply', createdAt: 1 },
      { id: 'm2', role: 'assistant', content: 'Quantum entanglement links particles...', createdAt: 2 },
    ],
  },
  {
    id: 'c2',
    title: 'React Liquid Glass Layout',
    createdAt: 1_700_000_000_000,
    updatedAt: new Date(2026, 10, 14, 10, 0, 0).getTime(),
    mode: 'coding',
    modelId: 'mavi-deep-reason',
    messages: [
      { id: 'm3', role: 'user', content: 'Help me build a Tailwind backdrop blur card', createdAt: 3 },
    ],
  },
  {
    id: 'c3',
    title: 'Q4 Product Launch Roadmap',
    createdAt: 1_700_000_000_000,
    updatedAt: new Date(2026, 10, 11, 9, 0, 0).getTime(),
    mode: 'planning',
    modelId: 'mavi-assistant-1.0',
    messages: [
      { id: 'm4', role: 'user', content: 'Draft milestones for launch', createdAt: 4 },
    ],
  },
  {
    id: 'c4',
    title: 'Old Semester Notes',
    createdAt: 1_700_000_000_000,
    updatedAt: new Date(2026, 9, 1, 9, 0, 0).getTime(),
    mode: 'general',
    modelId: 'mavi-swift',
    messages: [
      { id: 'm5', role: 'user', content: 'Summarize thermodynamics chapter 2', createdAt: 5 },
    ],
  },
];

test('buildChatTitle strips markdown noise and truncates cleanly', () => {
  assert.equal(buildChatTitle('  ## **Hello** `world`  '), 'Hello world');
  assert.equal(buildChatTitle('   '), 'New Conversation');
  const longTitle = buildChatTitle('Explain how distributed consensus algorithms like Raft handle split votes');
  assert.equal(longTitle.length <= 44, true);
  assert.equal(longTitle.endsWith('...'), true);
});

test('filterConversations matches titles and message content case-insensitively', () => {
  assert.equal(filterConversations(sampleConversations, '').length, 4);
  const byTitle = filterConversations(sampleConversations, 'roadmap');
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, 'c3');

  const byContent = filterConversations(sampleConversations, 'thermodynamics');
  assert.equal(byContent.length, 1);
  assert.equal(byContent[0].id, 'c4');
});

test('groupConversationsByRecency organizes threads into Today, Yesterday, Previous 7 Days, Earlier', () => {
  const now = new Date(2026, 10, 15, 20, 0, 0).getTime();
  const grouped = groupConversationsByRecency(sampleConversations, now);
  assert.deepEqual(
    grouped.map((g) => g.label),
    ['Today', 'Yesterday', 'Previous 7 Days', 'Earlier'],
  );
  assert.equal(grouped[0].items[0].id, 'c1');
  assert.equal(grouped[1].items[0].id, 'c2');
  assert.equal(grouped[2].items[0].id, 'c3');
  assert.equal(grouped[3].items[0].id, 'c4');
});

test('validateAttachment enforces supported file kinds and size limits', () => {
  const pdfCheck = validateAttachment({ name: 'notes.pdf', type: 'application/pdf', size: 2048 });
  assert.deepEqual(pdfCheck, { ok: true, kind: 'pdf' });

  const imgCheck = validateAttachment({ name: 'diagram.png', type: 'image/png', size: 1024 });
  assert.deepEqual(imgCheck, { ok: true, kind: 'image' });

  const codeCheck = validateAttachment({ name: 'app.tsx', type: '', size: 512 });
  assert.deepEqual(codeCheck, { ok: true, kind: 'document' });

  const tooBig = validateAttachment({ name: 'video.png', type: 'image/png', size: 15 * 1024 * 1024 });
  assert.equal(tooBig.ok, false);

  const unsupported = validateAttachment({ name: 'archive.zip', type: 'application/zip', size: 1024 });
  assert.equal(unsupported.ok, false);
});

test('extractSvgFromContent returns sanitized svg and strips script tags', () => {
  const md = 'Here is your art:\n```svg\n<svg viewBox="0 0 100 100"><script>alert(1)</script><circle cx="50" cy="50" r="40" onclick="hack()" /></svg>\n```';
  const svg = extractSvgFromContent(md);
  assert.ok(svg);
  assert.equal(svg.includes('<script>'), false);
  assert.equal(svg.includes('onclick='), false);
  assert.equal(svg.includes('<circle'), true);
});

test('MAVI UNLIMITED single-plan helpers, INR formatting, and safeguard calculations work accurately', () => {
  assert.equal(formatInr(199), '₹199');
  assert.equal(formatInr(1499), '₹1,499');

  const safeguard = computeUsageSummary(512, 2048);
  assert.equal(safeguard.remaining, 1536);
  assert.equal(safeguard.percent, 25);
  assert.equal(safeguard.exhausted, false);

  assert.equal(formatStorageSafeguard(2048), '2 GB');
  assert.equal(formatStorageSafeguard(512), '512 MB');
  assert.equal(isSubscriptionActive('active'), true);
  assert.equal(isSubscriptionActive('inactive'), false);

  // All MAVI models are unlocked in the single MAVI UNLIMITED experience
  assert.equal(MAVI_MODELS.length, 3);
  assert.equal(MAVI_MODELS.some((m) => m.badge.includes('PLUS')), false);

  assert.match(getGreetingForHour(9), /morning/i);
  assert.equal(getAccentTokens('indigo').hex, '#4F46E5');
  assert.equal(formatFileSize(1536), '1.5 KB');
});
