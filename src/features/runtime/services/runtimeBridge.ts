/**
 * RuntimeBridge 8.0 — THE single entry point for all Claude Code CLI operations.
 * Evidence-first: traceId, ptySessionId, ClaudeSessionId on every session.
 * Every surface (Projects, Workspace, Console, AI Dock, Resources) calls ONLY this API.
 */
import { useRuntimeStore } from '../stores/runtimeStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';
import { useSessionStore } from '../../../stores/sessionStore';
import { useOpenSessionStore } from '../../../stores/openSessionStore';
import { useRuntimeTraceStore, recordRuntimeError, recordRuntimeWarning } from '../stores/runtimeTraceStore';
import { SessionIdFactory } from './runtimeContractProbe';
import * as adapter from './interactionAdapter';
import { invokeCommand } from '../../../services/invokeCommand';
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

  // Sync to legacy stores for backward compat
  useSessionStore.getState().addSession({
    id: session.id, projectId: session.projectId, title: session.name,
    runtimeMode: 'pty-interactive', status: 'starting', model: 'sonnet',
    permissionMode: 'default' as const, cwd: session.cwd,
    inputTokens: 0, outputTokens: 0, totalCostUsd: 0,
    fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false,
    createdAt: session.createdAt, updatedAt: session.updatedAt, startedAt: session.startedAt ?? undefined,
  });
  invokeCommand('save_session_to_db', { session: {
    id: session.id, projectId: session.projectId, title: session.name, cwd: session.cwd,
    runtimeMode: 'pty-interactive', status: 'starting', model: 'sonnet',
    permissionMode: 'default', inputTokens: 0, outputTokens: 0, totalCostUsd: 0,
    fileChangeCount: 0, riskCount: 0, auditCount: 0, isPinned: false,
    createdAt: session.createdAt, updatedAt: session.updatedAt, startedAt: session.startedAt ?? undefined,
  } }).catch(() => {});

  useOpenSessionStore.getState().openSession({
    sessionId: session.id, projectId: session.projectId, projectName: input.projectName,
    title: session.name, status: 'starting', viewMode: 'terminal',
    pendingConfirms: 0, riskCount: 0, isPinned: false,
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
    await adapter.writePtyV2(uiSessionId, data, session.ptySessionId, session.traceId);

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
  const s = useRuntimeStore.getState().sessions[sessionId];
  await adapter.sendCtrlCPtyV2(sessionId, s?.ptySessionId ?? null);
}

export async function sendCtrlD(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  await adapter.sendCtrlDPtyV2(sessionId, s?.ptySessionId ?? null);
}

export async function stopInteractiveSession(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  await adapter.stopPtyV2(sessionId, s?.ptySessionId ?? null);
  const state = useRuntimeStore.getState();
  state.patchSession(sessionId, { status: 'killed' });
}

export async function resizeInteractiveSession(sessionId: string, cols: number, rows: number): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  await adapter.resizePtyV2(sessionId, cols, rows, s?.ptySessionId ?? null);
}

export function openRuntimeSessionInWorkspace(_sessionId: string): void {
  useSurfaceStore.getState().navigateTo('workspace');
}

// v9.0: RuntimeBridge namespace object — THE single entry point for all surfaces
export const RuntimeBridge = {
  startInteractiveSession: startInteractiveClaudeSession,
  write,
  resize: resizeInteractiveSession,
  ctrlC: sendCtrlC,
  ctrlD: sendCtrlD,
  stop: stopInteractiveSession,
  discover: async () => invokeCommand('runtime_discover_claude'),
  listBackendSessions: async () => invokeCommand('runtime_list_pty_sessions'),
  probeContract: async () => {
    const { probeRuntimeContract } = await import('./runtimeContractProbe');
    return probeRuntimeContract();
  },
  runContractTest: async (_project: unknown) => {
    // Contract test: create session, check ptySessionId, write echo, verify, stop
    const ids = SessionIdFactory.newSessionIds();
    return { ids, status: 'not-implemented' as const };
  },
};

export function getRuntimeSession(sessionId: string): RuntimeSession | null {
  return useRuntimeStore.getState().sessions[sessionId] ?? null;
}

// ── Internal ───────────────────────────────────────────────────────────

async function startSessionInBackground(session: RuntimeSession, _input: StartInteractiveInput) {
  try {
    // Phase 1: Discovery
    useRuntimeStore.getState().patchSession(session.id, { status: 'discovering' });
    useRuntimeTraceStore.getState().append({
      traceId: session.traceId, source: "runtime-bridge", level: "info",
      type: "discovery.start", message: "Starting Claude discovery",
      uiSessionId: session.id, ptySessionId: session.ptySessionId,
    });

    let selectedStrategy: string | null = null;
    try {
      const discovery = await invokeCommand<{ selectedStrategy?: string; selectedCandidate?: string }>('runtime_discover_claude');
      selectedStrategy = discovery.selectedStrategy ?? discovery.selectedCandidate ?? null;
      useRuntimeStore.getState().patchSession(session.id, {
        shellStrategy: selectedStrategy,
        status: 'pty-starting',
      });
      useRuntimeTraceStore.getState().append({
        traceId: session.traceId, source: "runtime-bridge", level: "info",
        type: "discovery.ok", message: `Selected: ${selectedStrategy || 'default'}`,
        uiSessionId: session.id, ptySessionId: session.ptySessionId,
      });
    } catch (discErr) {
      useRuntimeTraceStore.getState().append({
        traceId: session.traceId, source: "runtime-bridge", level: "warning",
        type: "discovery.failed", message: `Discovery failed: ${String(discErr)}`,
        uiSessionId: session.id, ptySessionId: session.ptySessionId,
      });
      useRuntimeStore.getState().patchSession(session.id, { status: 'pty-starting' });
    }

    // Phase 2: PTY start
    useRuntimeTraceStore.getState().append({
      traceId: session.traceId, source: "runtime-bridge", level: "info",
      type: "pty.start.request", message: "Requesting PTY start",
      uiSessionId: session.id, ptySessionId: session.ptySessionId,
    });

    await adapter.startPtyV2ClaudeSession({
      sessionId: session.id,
      uiSessionId: session.id,
      ptySessionId: session.ptySessionId!,
      traceId: session.traceId,
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
