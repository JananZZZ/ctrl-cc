import { create } from "zustand";
import type { RuntimeTraceEvent } from "../types/runtimeTraceTypes";

interface RuntimeTraceState {
  events: RuntimeTraceEvent[];
  append: (event: Omit<RuntimeTraceEvent, "id" | "ts">) => void;
  byTraceId: (traceId: string) => RuntimeTraceEvent[];
  clear: () => void;
}

export const useRuntimeTraceStore = create<RuntimeTraceState>((set, get) => ({
  events: [],

  append: (event) =>
    set((state) => ({
      events: [
        {
          id: crypto.randomUUID(),
          ts: new Date().toISOString(),
          ...event,
        },
        ...state.events,
      ].slice(0, 200),
    })),

  byTraceId: (traceId) => get().events.filter((e) => e.traceId === traceId),

  clear: () => set({ events: [] }),
}));

// Convenience helpers for recording trace events from anywhere
export function recordRuntimeTrace(
  type: string,
  message: string,
  level: RuntimeTraceEvent["level"],
  source: RuntimeTraceEvent["source"],
  uiSessionId: string | null,
  ptySessionId: string | null,
  traceId?: string | null,
  payload?: unknown,
) {
  useRuntimeTraceStore.getState().append({
    traceId: traceId ?? "no-trace",
    level,
    source,
    type,
    message,
    uiSessionId,
    ptySessionId,
    payload,
  });
}

export function recordRuntimeError(
  type: string,
  uiSessionId: string | null,
  ptySessionId: string | null,
  message: string,
  traceId?: string | null,
  payload?: unknown,
) {
  recordRuntimeTrace(type, message, "error", "runtime-bridge", uiSessionId, ptySessionId, traceId, payload);
}

export function recordRuntimeWarning(
  type: string,
  uiSessionId: string | null,
  ptySessionId: string | null,
  message: string,
  traceId?: string | null,
) {
  recordRuntimeTrace(type, message, "warning", "runtime-bridge", uiSessionId, ptySessionId, traceId);
}
