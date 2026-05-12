export type RuntimeTraceLevel = "debug" | "info" | "warning" | "error";

export interface RuntimeTraceEvent {
  id: string;
  traceId: string;
  ts: string;
  level: RuntimeTraceLevel;
  source:
    | "ui"
    | "runtime-bridge"
    | "runtime-kernel"
    | "interaction-adapter"
    | "tauri"
    | "pty"
    | "claude"
    | "composer"
    | "diagnostics";
  type: string;
  message: string;
  uiSessionId?: string | null;
  ptySessionId?: string | null;
  claudeSessionId?: string | null;
  projectId?: string | null;
  payload?: unknown;
}
