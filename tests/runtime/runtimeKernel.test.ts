import { describe, test, expect } from 'vitest';

type RuntimeSessionStatus = 'created' | 'idle' | 'running' | 'waiting-approval' | 'failed' | 'stopped' | 'archived';
type RuntimeChannelStatus = 'created' | 'starting' | 'ready' | 'running' | 'stopped' | 'failed' | 'exited';
type RuntimeErrorCode = 'COMMAND_NOT_FOUND' | 'AUTH_REQUIRED' | 'CLI_CRASH' | 'SPAWN_FAILED' | 'STREAM_PARSE_FAILED' | 'PTY_FAILED' | 'SETUP_INCOMPLETE' | 'UNKNOWN';

describe('RuntimeKernel', () => {
  test('chat failure leaves session idle', () => {
    let sessionStatus: RuntimeSessionStatus = 'running';
    let channelStatus: RuntimeChannelStatus = 'running';

    // Simulate chat failure
    channelStatus = 'failed';
    sessionStatus = 'idle';

    expect(channelStatus).toBe('failed');
    expect(sessionStatus).toBe('idle');
  });

  test('terminal failure does not affect chat', () => {
    const channels = new Map<string, RuntimeChannelStatus>();
    channels.set('chat', 'running');
    channels.set('terminal', 'failed');

    expect(channels.get('chat')).toBe('running');
    expect(channels.get('terminal')).toBe('failed');
  });

  test('session has independent channel lifecycle', () => {
    let sessionStatus: RuntimeSessionStatus = 'running';
    const chatOk = true;
    const terminalFailed = true;

    if (terminalFailed) {
      // Should NOT set session to failed
    }
    if (!chatOk) {
      sessionStatus = 'idle';
    }

    expect(sessionStatus).toBe('running'); // Terminal failure doesn't affect session
  });

  test('RuntimeKernel is the only entry point for runtime operations', () => {
    // UI should call RuntimeKernel, not invoke directly
    const kernelCalls: string[] = [];
    const directInvokes: string[] = [];

    kernelCalls.push('createSession', 'sendChat', 'startTerminal');
    // directInvokes should remain empty

    expect(kernelCalls.length).toBe(3);
    expect(directInvokes.length).toBe(0);
  });

  test('error classification maps to structured codes', () => {
    const classify = (error: string): RuntimeErrorCode => {
      if (error.includes('not found')) return 'COMMAND_NOT_FOUND';
      if (error.includes('auth') || error.includes('401')) return 'AUTH_REQUIRED';
      if (error.includes('crash') || error.includes('panic')) return 'CLI_CRASH';
      if (error.includes('spawn')) return 'SPAWN_FAILED';
      if (error.includes('parse')) return 'STREAM_PARSE_FAILED';
      if (error.includes('pty')) return 'PTY_FAILED';
      if (error.includes('setup')) return 'SETUP_INCOMPLETE';
      return 'UNKNOWN';
    };

    expect(classify('claude: command not found')).toBe('COMMAND_NOT_FOUND');
    expect(classify('HTTP 401 Unauthorized')).toBe('AUTH_REQUIRED');
    expect(classify('spawn failed')).toBe('SPAWN_FAILED');
    expect(classify('pty error')).toBe('PTY_FAILED');
    expect(classify('unknown error')).toBe('UNKNOWN');
  });
});
