/**
 * RuntimeDiagnostics 5.0 — 诊断工具箱
 * Collects: React last error, runtime sessions, shell strategies, PTY status, orphan processes
 * Output: JSON diagnostic bundle for debugging when GUI is frozen
 */
import { useRuntimeStore } from '../stores/runtimeStore';

export interface RuntimeDiagnosticsBundle {
  ts: string;
  reactLastError: unknown;
  sessions: unknown;
  events: unknown[];
  ptyTails: Record<string, string>;
}

export function collectDiagnosticsBundle(): RuntimeDiagnosticsBundle {
  let reactLastError: unknown = null;
  try {
    const raw = localStorage.getItem('ctrlcc:last-react-error');
    if (raw) reactLastError = JSON.parse(raw);
  } catch {}

  const state = useRuntimeStore.getState();

  return {
    ts: new Date().toISOString(),
    reactLastError,
    sessions: Object.values(state.sessions),
    events: state.events.slice(0, 200),
    ptyTails: state.ptyTail,
  };
}

export function getDiagnosticsJSON(): string {
  return JSON.stringify(collectDiagnosticsBundle(), null, 2);
}

export function getDebugLogPath(): string {
  return '%TEMP%/ctrl-cc-runtime-debug.log';
}

export function downloadDiagnosticsBundle(): void {
  const json = getDiagnosticsJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ctrl-cc-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
