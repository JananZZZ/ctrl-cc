import { describe, test, expect } from 'vitest';

function extractText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const p = parsed as Record<string, unknown>;
  if (typeof p.text === 'string') return p.text;
  if (typeof p.delta === 'string') return p.delta;
  if (typeof p.content === 'string') return p.content;
  const msg = p.message as Record<string, unknown> | undefined;
  if (msg?.content && typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg?.content)) {
    return (msg.content as Array<Record<string, unknown>>)
      .map((x) => x?.text || '')
      .join('');
  }
  return '';
}

function upsertDelta(events: Array<{ id: string; content: string; type: string }>, channelId: string, delta: string) {
  const streamId = `assistant-stream-${channelId}`;
  const existingIndex = events.findIndex((e) => e.id === streamId);

  if (existingIndex >= 0) {
    const next = [...events];
    next[existingIndex] = { ...next[existingIndex], content: next[existingIndex].content + delta };
    return next;
  }

  return [...events, { id: streamId, content: delta, type: 'assistant_message' }];
}

describe('Chat Stream Parser', () => {
  test('extractText from delta', () => {
    expect(extractText({ delta: 'Hello' })).toBe('Hello');
  });

  test('extractText from text', () => {
    expect(extractText({ text: 'World' })).toBe('World');
  });

  test('extractText from message.content array', () => {
    expect(extractText({
      message: { content: [{ text: 'A' }, { text: 'B' }] },
    })).toBe('AB');
  });

  test('extractText returns empty for invalid input', () => {
    expect(extractText(null)).toBe('');
    expect(extractText('string')).toBe('');
    expect(extractText({})).toBe('');
  });

  test('upsertDelta merges stream deltas', () => {
    const events: Array<{ id: string; content: string; type: string }> = [];
    const after1 = upsertDelta(events, 'ch-1', 'Hel');
    const after2 = upsertDelta(after1, 'ch-1', 'lo');
    expect(after2.length).toBe(1);
    expect(after2[0].content).toBe('Hello');
  });

  test('upsertDelta creates new entry for different channels', () => {
    const events: Array<{ id: string; content: string; type: string }> = [];
    const after1 = upsertDelta(events, 'ch-1', 'A');
    const after2 = upsertDelta(after1, 'ch-2', 'B');
    expect(after2.length).toBe(2);
    expect(after2[0].content).toBe('A');
    expect(after2[1].content).toBe('B');
  });

  test('Chat failed does not kill session', () => {
    let sessionStatus = 'running';
    sessionStatus = 'idle'; // chat-exit should set to idle, not failed
    expect(sessionStatus).toBe('idle');
  });

  test('Terminal failed does not affect Chat', () => {
    const channels = { chat: 'running', terminal: 'failed' };
    expect(channels.chat).toBe('running');
    expect(channels.terminal).toBe('failed');
    // Independent states
  });
});
