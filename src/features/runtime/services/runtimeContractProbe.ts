import { invoke } from "@tauri-apps/api/core";
import { useRuntimeStore } from "../stores/runtimeStore";
import { useRuntimeTraceStore } from "../stores/runtimeTraceStore";

export interface RuntimeContractProbeResult {
  frontendSessions: Array<{
    uiSessionId: string;
    ptySessionId: string | null;
    claudeSessionId: string | null;
    status: string;
    cwd: string;
    projectId: string;
    traceId: string;
    error?: string | null;
  }>;
  backendPtySessions: Array<{
    ptySessionId: string;
    uiSessionId?: string | null;
    cwd: string;
    pid?: number | null;
    status: string;
    hasWriter: boolean;
    readerAlive?: boolean;
    createdAt?: string;
    lastError?: string | null;
  }>;
  mismatches: Array<{
    uiSessionId: string;
    ptySessionId: string | null;
    reason: string;
  }>;
  traceEvents: Array<{
    id: string;
    traceId: string;
    type: string;
    message: string;
    source: string;
    level: string;
  }>;
}

export async function probeRuntimeContract(): Promise<RuntimeContractProbeResult> {
  const runtimeState = useRuntimeStore.getState();
  const frontendSessions = Object.values(runtimeState.sessions).map((s) => ({
    uiSessionId: s.id,
    ptySessionId: s.ptySessionId ?? null,
    claudeSessionId: s.claudeSessionId ?? null,
    status: s.status,
    cwd: s.cwd,
    projectId: s.projectId,
    traceId: s.traceId ?? "no-trace",
    error: s.error ?? null,
  }));

  let backendPtySessions: RuntimeContractProbeResult["backendPtySessions"] = [];
  try {
    backendPtySessions = await invoke<RuntimeContractProbeResult["backendPtySessions"]>("runtime_list_sessions_v2");
  } catch {
    // backend may not have command yet — show empty
  }

  const backendIds = new Set(backendPtySessions.map((s) => s.ptySessionId));

  const preBackendStatuses = new Set(['created','workspace-opened','discovering','discovery-failed','pty-starting','failed']);
  const requiresBackend = new Set(['pty-ready','claude-launching','claude-active','idle','waiting-permission']);

  const mismatches: Array<{ uiSessionId: string; ptySessionId: string | null; reason: string }> = [];
  for (const s of frontendSessions) {
    if (!s.ptySessionId) {
      if (requiresBackend.has(s.status)) {
        mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: null, reason: `frontend status=${s.status} requires PTY but ptySessionId is missing` });
      }
      continue;
    }
    if (preBackendStatuses.has(s.status) && !backendIds.has(s.ptySessionId)) continue;
    if (requiresBackend.has(s.status) && !backendIds.has(s.ptySessionId)) {
      mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend registry missing ptySessionId" });
      continue;
    }
    const backend = backendPtySessions.find((b) => b.ptySessionId === s.ptySessionId);
    if (!backend) continue;
    if (requiresBackend.has(s.status)) {
      if (backend.status === 'exited' || backend.status === 'failed' || backend.status === 'killed') {
        mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: `backend PTY is not alive: status=${backend.status}` });
      }
      if (backend.readerAlive === false) {
        mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend readerAlive=false" });
      }
      if (!backend.hasWriter) {
        mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend hasWriter=false" });
      }
    }
  }

  const traceEvents = useRuntimeTraceStore.getState().events.slice(0, 100).map((e) => ({
    id: e.id,
    traceId: e.traceId,
    type: e.type,
    message: e.message,
    source: e.source,
    level: e.level,
  }));

  return { frontendSessions, backendPtySessions, mismatches, traceEvents };
}

export const SessionIdFactory = {
  generateTraceId: (): string => `trace-${crypto.randomUUID()}`,
  generatePtySessionId: (): string => `pty-${crypto.randomUUID()}`,
  generateUiSessionId: (): string => `ses-${Date.now()}`,
  newSessionIds: (): { uiSessionId: string; ptySessionId: string; traceId: string } => ({
    uiSessionId: `ses-${Date.now()}`,
    ptySessionId: `pty-${crypto.randomUUID()}`,
    traceId: `trace-${crypto.randomUUID()}`,
  }),
};
