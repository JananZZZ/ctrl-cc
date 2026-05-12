import { invokeCommand } from '../../../services/invokeCommand';

/** P0 Interaction Adapter — wraps PTY data plane commands.
 *  Only this file calls pty_start_claude_session / pty_v2_write / etc.
 *  All other code must go through runtimeBridge, never call these directly. */

export async function startPtyV2ClaudeSession(input: {
  sessionId: string; projectId: string; cwd: string;
  cliPath?: string; extraArgs?: string[];
}) {
  return invokeCommand<{ sessionId: string }>('pty_start_claude_session', {
    sessionId: input.sessionId,
    projectId: input.projectId,
    cwd: input.cwd,
    cliPath: input.cliPath ?? 'claude',
    extraArgs: input.extraArgs ?? [],
  });
}

export async function writePtyV2(sessionId: string, data: string, traceId?: string | null) {
  return invokeCommand('pty_v2_write', { sessionId, data, traceId: traceId ?? null });
}

export async function resizePtyV2(sessionId: string, cols: number, rows: number) {
  return invokeCommand('pty_v2_resize', { sessionId, cols, rows });
}

export async function sendCtrlCPtyV2(sessionId: string) {
  return invokeCommand('pty_send_ctrl_c', { sessionId });
}

export async function sendCtrlDPtyV2(sessionId: string) {
  return invokeCommand('pty_send_ctrl_d', { sessionId });
}

export async function stopPtyV2(sessionId: string) {
  return invokeCommand('pty_v2_stop', { sessionId });
}
