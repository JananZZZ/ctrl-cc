/** Bridges Tauri PTY/structured events into RuntimeStore events.
 *  Only stores event summaries (max 200), never PTY raw output chunks. */

import { useRuntimeStore } from '../stores/runtimeStore';

export function emitRuntimeEvent(type: string, sessionId: string | undefined, message: string) {
  useRuntimeStore.getState().addEvent({ type, sessionId, message });
}

export function emitPtyDataEvent(sessionId: string, tailChunk: string) {
  useRuntimeStore.getState().appendPtyTail(sessionId, tailChunk);
}
