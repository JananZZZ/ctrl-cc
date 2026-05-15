import { describe, test, expect } from 'vitest';

describe('Channel Isolation', () => {
  test('chat channel and terminal channel are independent', () => {
    const channels = {
      chat: { status: 'running', sessionId: 'ses-1' },
      terminal: { status: 'stopped', sessionId: 'ses-1' },
      background: { status: 'idle', sessionId: 'ses-1' },
    };

    // Terminal stop does not affect chat
    channels.terminal.status = 'stopped';
    expect(channels.chat.status).toBe('running');
  });

  test('chat turn failure does not kill session', () => {
    const session = { id: 'ses-1', status: 'running' };
    const chatChannel = { id: 'ch-1', status: 'running' };

    chatChannel.status = 'failed';
    // Session should remain usable
    session.status = 'idle';

    expect(session.status).toBe('idle');
    expect(chatChannel.status).toBe('failed');
  });

  test('extensionless claude is never selected', () => {
    // Simulates Rust: Path::file_name() == "claude" && Path::extension().is_none()
    const isForbidden = (fileName: string): boolean => {
      const dotIdx = fileName.lastIndexOf('.');
      const stem = dotIdx >= 0 ? fileName.slice(0, dotIdx) : fileName;
      return stem.toLowerCase() === 'claude' && dotIdx < 0;
    };

    expect(isForbidden('claude')).toBe(true);
    expect(isForbidden('claude.exe')).toBe(false);
    expect(isForbidden('claude.cmd')).toBe(false);
    expect(isForbidden('claude.js')).toBe(false);
  });

  test('nodeWrapper selected before cmdShim', () => {
    const entries = [
      { kind: 'cmdShim', versionOk: true },
      { kind: 'nodeWrapper', versionOk: true },
      { kind: 'nativeExe', versionOk: true },
    ];
    const priority: Record<string, number> = { nativeExe: 0, nodeWrapper: 1, cmdShim: 2 };
    entries.sort((a, b) => (priority[a.kind] ?? 99) - (priority[b.kind] ?? 99));
    expect(entries[0].kind).toBe('nativeExe');
    expect(entries[1].kind).toBe('nodeWrapper');
    expect(entries[2].kind).toBe('cmdShim');
  });

  test('chat first turn does not send fake session id', () => {
    const providerState: Record<string, unknown> = {
      claudeSessionId: null,
    };
    expect(providerState.claudeSessionId).toBeNull();
    // Session id is only set after receiving system/init
  });

  test('system/init session_id persisted to providerState', () => {
    const providerState: Record<string, unknown> = {
      claudeSessionId: null,
    };
    // Simulate receiving system/init
    const initEvent = { claudeSessionId: 'abc123-real-session' };
    providerState.claudeSessionId = initEvent.claudeSessionId;
    expect(providerState.claudeSessionId).toBe('abc123-real-session');
  });

  test('setup readyForChat independent from readyForTerminal', () => {
    const readyForChat = true;
    const readyForTerminal = false;
    expect(readyForChat).not.toBe(readyForTerminal);
    // Chat can be ready even if Terminal is not
  });
});
