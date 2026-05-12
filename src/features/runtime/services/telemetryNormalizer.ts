/** Telemetry Normalizer — converts raw hooks/statusLine/structured events into RuntimeEvents.
 *  Does NOT process PTY raw output (that's xterm only). */

import type { RuntimeEvent } from '../types/runtimeTypes';

export function normalizeStatusLine(raw: Record<string, unknown>, sessionId: string): RuntimeEvent {
  return {
    id: crypto.randomUUID(),
    type: 'statusline.snapshot',
    sessionId,
    message: JSON.stringify(raw),
    ts: new Date().toISOString(),
    level: 'info',
  };
}

export function normalizeHook(raw: { hook: string; result: string }, sessionId: string): RuntimeEvent {
  return {
    id: crypto.randomUUID(),
    type: 'hook.event',
    sessionId,
    message: `${raw.hook}: ${raw.result}`,
    ts: new Date().toISOString(),
    level: 'info',
  };
}
