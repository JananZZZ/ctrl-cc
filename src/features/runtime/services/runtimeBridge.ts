/**
 * RuntimeBridge 8.0 — THE single entry point for all Claude Code CLI operations.
 * Evidence-first: traceId, ptySessionId, ClaudeSessionId on every session.
 * Every surface (Projects, Workspace, Console, AI Dock, Resources) calls ONLY this API.
 */
import { useRuntimeStore } from '../stores/runtimeStore';
import { useWorkspaceStore } from '../../workspace/stores/workspaceStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useRuntimeTraceStore, recordRuntimeError, recordRuntimeWarning } from '../stores/runtimeTraceStore';
import { SessionIdFactory } from './runtimeContractProbe';
import * as adapter from './interactionAdapter';
import type { RuntimeSession, StartInteractiveInput } from '../types/runtimeTypes';
import { isRuntimeWritable } from '../types/runtimeTypes';

function createPendingSession(input: StartInteractiveInput): RuntimeSession {
  const now = new Date().toISOString();
  const ids = SessionIdFactory.newSessionIds();
  return {
    id: ids.uiSessionId,
    ptySessionId: ids.ptySessionId,
    claudeSessionId: null,
    traceId: ids.traceId,
    projectId: input.projectId,
    projectName: input.projectName,
    name: input.sessionName ?? `${input.projectName}-${now.slice(0, 16).replace(/[:T]/g, '-')}`,
    cwd: input.cwd,
    mode: 'interactive-pty' as const,
    status: 'workspace-opened' as const,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
  };
}

// ── Public API ─────────────────────────────────────────────────────────

export async function startInteractiveClaudeSession(input: StartInteractiveInput): Promise<RuntimeSession> {
  const session = createPendingSession(input);

  useRuntimeTraceStore.getState().append({
    traceId: session.traceId,
    source: "ui",
    level: "info",
    type: "ui.click.newSession",
    message: "New session requested",
    uiSessionId: session.id,
    ptySessionId: session.ptySessionId,
    projectId: session.projectId,
  });

  useRuntimeStore.getState().addSession(session);

  // Open workspace tab immediately — do NOT await PTY
  useWorkspaceStore.getState().openSessionTab({
    id: `tab_${session.id}`,
    sessionId: session.id,
    projectId: session.projectId,
    title: session.name,
  });

  useSurfaceStore.getState().navigateTo('workspace');

  // Background PTY start — non-blocking
  void startSessionInBackground(session, input);
  return session;
}

/** RuntimeBridge.write — the ONLY send path. Contract-verified. */
export async function write(uiSessionId: string, data: string): Promise<void> {
  const state = useRuntimeStore.getState();
  const session = state.sessions[uiSessionId];

  if (!session) {
    recordRuntimeError("runtime.write.ui_session_missing", uiSessionId, null, "UI session not found");
    throw new Error(`UI session not found: ${uiSessionId}`);
  }

  if (!session.ptySessionId) {
    recordRuntimeError("runtime.write.pty_session_missing", uiSessionId, null, "PTY session not attached");
    throw new Error(`PTY session not attached: ${uiSessionId}`);
  }

  if (!isRuntimeWritable(session.status)) {
    recordRuntimeWarning("runtime.write.not_ready", uiSessionId, session.ptySessionId, `Runtime not ready: ${session.status}`, session.traceId);
    throw new Error(`Runtime not ready: ${session.status}`);
  }

  useRuntimeTraceStore.getState().append({
    traceId: session.traceId,
    source: "runtime-bridge",
    level: "info",
    type: "runtime.write.resolve",
    message: "Resolved UI session to PTY session",
    uiSessionId,
    ptySessionId: session.ptySessionId,
    payload: { status: session.status },
  });

  try {
    await adapter.writePtyV2(uiSessionId, data, session.traceId);

    useRuntimeTraceStore.getState().append({
      traceId: session.traceId,
      source: "runtime-bridge",
      level: "info",
      type: "runtime.write.ok",
      message: "Write succeeded",
      uiSessionId,
      ptySessionId: session.ptySessionId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    recordRuntimeError("runtime.write.backend_failed", uiSessionId, session.ptySessionId, msg, session.traceId);
    throw error;
  }
}

export async function sendCtrlC(sessionId: string): Promise<void> {
  await adapter.sendCtrlCPtyV2(sessionId);
}

export async function sendCtrlD(sessionId: string): Promise<void> {
  await adapter.sendCtrlDPtyV2(sessionId);
}

export async function stopInteractiveSession(sessionId: string): Promise<void> {
  await adapter.stopPtyV2(sessionId);
  const state = useRuntimeStore.getState();
  state.patchSession(sessionId, { status: 'killed' });
}

export async function resizeInteractiveSession(sessionId: string, cols: number, rows: number): Promise<void> {
  await adapter.resizePtyV2(sessionId, cols, rows);
}

export function openRuntimeSessionInWorkspace(_sessionId: string): void {
  useSurfaceStore.getState().navigateTo('workspace');
}

export function getRuntimeSession(sessionId: string): RuntimeSession | null {
  return useRuntimeStore.getState().sessions[sessionId] ?? null;
}

// ── Internal ───────────────────────────────────────────────────────────

async function startSessionInBackground(session: RuntimeSession, _input: StartInteractiveInput) {
  try {
    useRuntimeStore.getState().patchSession(session.id, { status: 'pty-starting' });

    useRuntimeTraceStore.getState().append({
      traceId: session.traceId, source: "runtime-bridge", level: "info",
      type: "pty.start.request", message: "Requesting PTY start",
      uiSessionId: session.id, ptySessionId: session.ptySessionId,
    });

    await adapter.startPtyV2ClaudeSession({
      sessionId: session.id,
      projectId: session.projectId,
      cwd: session.cwd,
    });

    useRuntimeStore.getState().patchSession(session.id, { status: 'claude-active' });

    useRuntimeTraceStore.getState().append({
      traceId: session.traceId, source: "runtime-bridge", level: "info",
      type: "pty.backend.registered", message: "PTY session registered in backend",
      uiSessionId: session.id, ptySessionId: session.ptySessionId,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    recordRuntimeError("pty.start.failed", session.id, session.ptySessionId, msg, session.traceId);
    useRuntimeStore.getState().patchSession(session.id, { status: 'failed', error: msg });
    useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
  }
}
