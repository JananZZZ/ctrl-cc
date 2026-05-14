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
import { invokeCommand } from '../../../services/invokeCommand';
// v14.0: Rate-limit blocked write traces to 1 per 5 seconds per session+status
const blockedWriteTraceAt = new Map<string, number>();

function shouldTraceBlockedWrite(uiSessionId: string, status: string): boolean {
  const key = `${uiSessionId}:${status}`;
  const now = Date.now();
  const last = blockedWriteTraceAt.get(key) ?? 0;
  if (now - last < 3000) return false;
  blockedWriteTraceAt.set(key, now);
  return true;
}

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
    if (shouldTraceBlockedWrite(uiSessionId, session.status)) {
    }
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

  // Phase C: Call runtime_v2 directly
  try {
    await invokeCommand('runtime_write_v2', {
      req: {
        traceId: session.traceId,
        uiSessionId: session.id,
        ptySessionId: session.ptySessionId,
        data,
      },
    });

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
  if (!s?.ptySessionId || !isRuntimeWritable(s.status)) return;
  await invokeCommand('runtime_write_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId, data: '\x03' },
  });
}

export async function sendCtrlD(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  if (!s?.ptySessionId || !isRuntimeWritable(s.status)) return;
  await invokeCommand('runtime_write_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId, data: '\x04' },
  });
}

export async function stopInteractiveSession(sessionId: string): Promise<void> {
  const s = useRuntimeStore.getState().sessions[sessionId];
  if (!s?.ptySessionId || !isRuntimeWritable(s.status)) return;
  await invokeCommand('runtime_stop_v2', {
    req: { traceId: s.traceId, uiSessionId: s.id, ptySessionId: s.ptySessionId },
  });
  useRuntimeStore.getState().patchSession(sessionId, { status: 'killed' });
}

export async function resizeInteractiveSession(sessionId: string, cols: number, rows: number): Promise<void> {
  void sessionId; void cols; void rows;
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
  discover: async () => invokeCommand('runtime_discover_claude_v2'),
  listBackendSessions: async () => invokeCommand('runtime_list_sessions_v2'),
  probeContract: async () => {
    const { probeRuntimeContract } = await import('./runtimeContractProbe');
    return probeRuntimeContract();
  },
  runContractTest: async (project: { projectId?: string; projectName?: string; cwd?: string }) => {
    const session = await startInteractiveClaudeSession({
      projectId: project.projectId ?? 'diagnostic',
      projectName: project.projectName ?? 'Runtime Diagnostic',
      cwd: project.cwd ?? '.',
      mode: 'new',
      sessionName: 'runtime-contract-test',
    });

    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const s = useRuntimeStore.getState().sessions[session.id];
      if (s?.status === 'pty-ready' || s?.status === 'claude-active') break;
      if (s?.status === 'failed' || s?.status === 'exited' || s?.status === 'discovery-failed') {
        throw new Error(`Contract test failed during start: ${s.status} ${s.error ?? ''}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const backend = await invokeCommand<Array<{
      ptySessionId: string;
      uiSessionId?: string | null;
      status: string;
      hasWriter: boolean;
      readerAlive?: boolean;
    }>>('runtime_list_sessions_v2');

    const found = backend.find((b) => b.ptySessionId === session.ptySessionId);
    if (!found) throw new Error(`Contract failed: backend missing ${session.ptySessionId}`);
    if (found.status === 'exited' || found.status === 'failed') throw new Error(`Contract failed: backend status=${found.status}`);
    if (!found.readerAlive) throw new Error('Contract failed: backend readerAlive=false');
    if (!found.hasWriter) throw new Error('Contract failed: backend hasWriter=false');

    await write(session.id, '\r');
    return { ok: true as const, session, backend: found };
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
      const discovery = await invokeCommand<{
        selected?: { id: string; label: string; program: string; argsPrefix?: string[]; canaryOk?: boolean; versionOk?: boolean; error?: string | null } | null;
        plans?: Array<{ id: string; canaryOk: boolean; versionOk: boolean; error?: string | null }>;
        errors?: string[];
      }>('runtime_discover_claude_v2');

      if (!discovery.selected) {
        const detail = discovery.errors?.join('\n') || 'No runnable Claude launch plan.';
        throw new Error(detail);
      }

      selectedStrategy = discovery.selected.id;

      useRuntimeStore.getState().patchSession(session.id, {
        shellStrategy: selectedStrategy,
        claudeCommand: discovery.selected.program,
        status: 'pty-starting',
      });

      useRuntimeTraceStore.getState().append({
        traceId: session.traceId,
        source: 'runtime-bridge',
        level: 'info',
        type: 'discovery.ok',
        message: `Selected: ${selectedStrategy}`,
        uiSessionId: session.id,
        ptySessionId: session.ptySessionId,
      });
    } catch (discErr) {
      const msg = String(discErr);
      useRuntimeTraceStore.getState().append({
        traceId: session.traceId,
        source: 'runtime-bridge',
        level: 'error',
        type: 'discovery.failed',
        message: msg,
        uiSessionId: session.id,
        ptySessionId: session.ptySessionId,
      });
      useRuntimeStore.getState().patchSession(session.id, { status: 'discovery-failed', error: msg });
      useSessionStore.getState().updateSession(session.id, { status: 'failed' as const });
      useOpenSessionStore.getState().patchTab?.(session.id, { status: 'failed', ptyStatus: 'failed' });
      return;
    }

    // Phase 2: PTY start
    useRuntimeTraceStore.getState().append({
      traceId: session.traceId, source: "runtime-bridge", level: "info",
      type: "pty.start.request", message: "Requesting PTY start",
      uiSessionId: session.id, ptySessionId: session.ptySessionId,
    });

    // Phase C: Call runtime_v2 directly
    await invokeCommand('runtime_start_interactive_v2', {
      req: {
        traceId: session.traceId,
        uiSessionId: session.id,
        ptySessionId: session.ptySessionId,
        projectId: session.projectId,
        cwd: session.cwd,
        model: null,
        permissionMode: 'default',
        mode: 'new',
        sessionName: session.name,
        resumeTarget: null,
        initialPrompt: null,
      },
    });

    useRuntimeStore.getState().patchSession(session.id, { status: 'pty-ready' });

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
      useOpenSessionStore.getState().patchTab?.(session.id, { status: 'failed', ptyStatus: 'failed' });
  }
}
