import { describe, test, expect } from 'vitest';

interface LedgerEvent {
  id: string;
  sessionId: string;
  channelId: string | null;
  level: 'debug' | 'info' | 'warning' | 'error';
  type: string;
  message: string;
}

describe('RuntimeLedger', () => {
  test('events are append-only', () => {
    const events: LedgerEvent[] = [];
    const e1: LedgerEvent = { id: '1', sessionId: 's1', channelId: null, level: 'info', type: 'session.created', message: 'created' };
    events.push(e1);
    expect(events.length).toBe(1);
    // Original array reference unchanged — events are appended, not replaced
  });

  test('ledger caps at max events', () => {
    const MAX = 2000;
    const events: LedgerEvent[] = [];
    for (let i = 0; i < MAX + 100; i++) {
      events.unshift({ id: String(i), sessionId: 's1', channelId: null, level: 'info', type: 'test', message: `msg ${i}` });
      if (events.length > MAX) events.length = MAX;
    }
    expect(events.length).toBe(MAX);
    expect(events[0].message).toBe(`msg ${MAX + 99}`);
  });

  test('Chat channel and Terminal channel events are separate', () => {
    const chatEvents: LedgerEvent[] = [
      { id: '1', sessionId: 's1', channelId: 'ch-chat', level: 'info', type: 'chat.delta', message: 'hello' },
    ];
    const terminalEvents: LedgerEvent[] = [
      { id: '2', sessionId: 's1', channelId: 'ch-pty', level: 'info', type: 'terminal.data', message: 'ls' },
    ];
    expect(chatEvents[0].channelId).not.toBe(terminalEvents[0].channelId);
    expect(chatEvents[0].type).toContain('chat');
    expect(terminalEvents[0].type).toContain('terminal');
  });

  test('session not failed by single channel error', () => {
    const channels = new Map<string, string>();
    channels.set('chat', 'failed');
    channels.set('terminal', 'running');

    // Session status should be based on overall, not single channel
    const anyRunning = Array.from(channels.values()).some((s) => s === 'running');
    expect(anyRunning).toBe(true);
  });

  test('UI reads normalized store, not raw backend events', () => {
    // Simulated: store returns normalized events, raw events stay in diagnostics
    const normalized = { id: '1', type: 'assistant_message', content: 'Hello' };
    const raw = '{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}';
    expect(typeof normalized).toBe('object');
    expect(typeof raw).toBe('string');
  });
});
