import { describe, test, expect } from 'vitest';

interface SetupSnapshot {
  ready: boolean;
  readyForChat: boolean;
  readyForTerminal: boolean;
  readyForApi: boolean;
  readyForProject: boolean;
  checks: Record<string, { ok: boolean }>;
  selectedChatCommandId: string | null;
  selectedTerminalCommandId: string | null;
}

function computeReady(snapshot: Pick<SetupSnapshot, 'checks' | 'selectedChatCommandId' | 'selectedTerminalCommandId'>) {
  const checks = snapshot.checks;
  const claudeCodeOk = checks.claudeCode?.ok ?? false;
  const claudeAuthOk = checks.claudeAuth?.ok ?? false;
  const claudeConfigOk = checks.claudeConfig?.ok ?? false;
  const apiProviderOk = checks.apiProvider?.ok ?? false;
  const workspaceOk = checks.workspace?.ok ?? false;

  return {
    readyForChat: snapshot.selectedChatCommandId !== null && claudeCodeOk && (claudeAuthOk || claudeConfigOk),
    readyForTerminal: snapshot.selectedTerminalCommandId !== null,
    readyForApi: claudeAuthOk || apiProviderOk,
    readyForProject: workspaceOk,
  };
}

describe('SetupSnapshot v25', () => {
  test('readyForChat requires selectedChatCommand + claudeCode + auth/config', () => {
    const snapshot = {
      checks: {
        claudeCode: { ok: true },
        claudeAuth: { ok: true },
        claudeConfig: { ok: false },
      },
      selectedChatCommandId: 'native-cmd',
      selectedTerminalCommandId: 'native-cmd',
    };
    const ready = computeReady(snapshot);
    expect(ready.readyForChat).toBe(true);
  });

  test('readyForChat false without selectedChatCommandId', () => {
    const snapshot = {
      checks: {
        claudeCode: { ok: true },
        claudeAuth: { ok: true },
        claudeConfig: { ok: false },
      },
      selectedChatCommandId: null,
      selectedTerminalCommandId: 'native-cmd',
    };
    const ready = computeReady(snapshot);
    expect(ready.readyForChat).toBe(false);
  });

  test('readyForTerminal only requires selectedTerminalCommandId', () => {
    const snapshot = {
      checks: { claudeCode: { ok: false } },
      selectedChatCommandId: null,
      selectedTerminalCommandId: 'git-bash-cmd',
    };
    const ready = computeReady(snapshot);
    expect(ready.readyForTerminal).toBe(true);
    expect(ready.readyForChat).toBe(false);
  });

  test('readyForApi requires auth or apiProvider', () => {
    expect(computeReady({
      checks: { claudeAuth: { ok: true }, apiProvider: { ok: false } },
      selectedChatCommandId: null, selectedTerminalCommandId: null,
    }).readyForApi).toBe(true);

    expect(computeReady({
      checks: { claudeAuth: { ok: false }, apiProvider: { ok: true } },
      selectedChatCommandId: null, selectedTerminalCommandId: null,
    }).readyForApi).toBe(true);

    expect(computeReady({
      checks: { claudeAuth: { ok: false }, apiProvider: { ok: false } },
      selectedChatCommandId: null, selectedTerminalCommandId: null,
    }).readyForApi).toBe(false);
  });

  test('readyForProject requires workspace ok', () => {
    expect(computeReady({
      checks: { workspace: { ok: true } },
      selectedChatCommandId: null, selectedTerminalCommandId: null,
    }).readyForProject).toBe(true);
  });
});
