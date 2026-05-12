import { invokeCommand } from '../../../services/invokeCommand';

/** v9.0 Interaction Adapter — wraps PTY data plane commands.
 *  Only runtimeBridge calls these. No surface may import this file.
 *  All commands pass both uiSessionId and ptySessionId for backend ID contract.
 */

export async function startPtyV2ClaudeSession(input: {
  sessionId: string;        // uiSessionId (ses-xxx) — deprecated, use uiSessionId
  uiSessionId?: string;
  ptySessionId?: string;
  traceId?: string;
  projectId: string;
  cwd: string;
  cliPath?: string;
  extraArgs?: string[];
}) {
  return invokeCommand<{ ptySessionId: string; uiSessionId: string }>('pty_start_claude_session', {
    sessionId: input.sessionId,
    uiSessionId: input.uiSessionId ?? input.sessionId,
    ptySessionId: input.ptySessionId ?? null,
    traceId: input.traceId ?? null,
    projectId: input.projectId,
    cwd: input.cwd,
    cliPath: input.cliPath ?? 'claude',
    extraArgs: input.extraArgs ?? [],
  });
}

export async function writePtyV2(sessionId: string, data: string, ptySessionId?: string | null, traceId?: string | null) {
  return invokeCommand('pty_v2_write', {
    sessionId,
    ptySessionId: ptySessionId ?? null,
    uiSessionId: sessionId,
    data,
    traceId: traceId ?? null,
  });
}

export async function resizePtyV2(sessionId: string, cols: number, rows: number, ptySessionId?: string | null) {
  return invokeCommand('pty_v2_resize', {
    sessionId,
    ptySessionId: ptySessionId ?? null,
    cols,
    rows,
  });
}

export async function sendCtrlCPtyV2(sessionId: string, ptySessionId?: string | null) {
  return invokeCommand('pty_send_ctrl_c', {
    sessionId,
    ptySessionId: ptySessionId ?? null,
  });
}

export async function sendCtrlDPtyV2(sessionId: string, ptySessionId?: string | null) {
  return invokeCommand('pty_send_ctrl_d', {
    sessionId,
    ptySessionId: ptySessionId ?? null,
  });
}

export async function stopPtyV2(sessionId: string, ptySessionId?: string | null) {
  return invokeCommand('pty_v2_stop', {
    sessionId,
    ptySessionId: ptySessionId ?? null,
  });
}
