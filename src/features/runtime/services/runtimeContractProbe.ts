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

  const mismatches: Array<{ uiSessionId: string; ptySessionId: string | null; reason: string }> = [];
  for (const s of frontendSessions) {
    if (!s.ptySessionId) {
      mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: null, reason: "frontend session has no ptySessionId" });
    } else if (!backendIds.has(s.ptySessionId)) {
      mismatches.push({ uiSessionId: s.uiSessionId, ptySessionId: s.ptySessionId, reason: "backend registry missing ptySessionId" });
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
