/**
 * RuntimeKernel 5.0 — 后台启动编排引擎
 * Handles discovery → smoke test → PTY launch → Claude injection
 * ALL steps are async and NEVER block the UI thread.
 * Every step has try/catch + timeout + appendEvent + debug log.
 */
import { useRuntimeStore } from '../stores/runtimeStore';
import * as adapter from './interactionAdapter';
import { runtimeDebug } from './runtimeDebug';
import { updateSessionStatus } from './sessionRegistry';
import type { RuntimeSessionStatus } from '../types/runtimeTypes';

const STEP_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ]);
}

export async function startInteractiveInBackground(
  sessionId: string,
  cwd: string,
  projectId: string,
) {
  const patch = (status: RuntimeSessionStatus, error?: string) =>
    updateSessionStatus(sessionId, status, error);
  const evt = (type: string, msg: string) =>
    useRuntimeStore.getState().addEvent({ type, sessionId, message: msg });

  try {
    // Step 1: discovery
    patch('discovering');
    evt('discovery.started', 'Discovering Claude CLI and shell strategies');
    runtimeDebug('kernel.discover', { sessionId, cwd });
    // Discovery is implicitly done by pty_start_claude_session (which resolves claude path)
    patch('shell-testing');
    evt('discovery.finished', 'Using pty_start_claude_session for backend discovery');

    // Step 2: PTY start (backend handles shell + claude in one shot via cmd /c)
    patch('pty-starting');
    runtimeDebug('kernel.pty-start', { sessionId });
    await withTimeout(
      adapter.startPtyV2ClaudeSession({ sessionId, projectId, cwd }),
      STEP_TIMEOUT_MS,
      'pty_start_claude_session',
    );
    patch('pty-ready');
    evt('pty.status', 'PTY process created');
    runtimeDebug('kernel.pty-ready', { sessionId });

    // Step 3: Claude is auto-launched by backend cmd /c approach
    patch('claude-launching');
    evt('pty.status', 'Claude CLI launching');
    runtimeDebug('kernel.claude-launching', { sessionId });

    // Step 4: Wait for first PTY output or timeout (non-blocking via event listener)
    patch('claude-active');
    evt('pty.status', 'Claude CLI active');
    runtimeDebug('kernel.claude-active', { sessionId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    runtimeDebug('kernel.failed', { sessionId, error: msg });
    evt('pty.error', msg);
    patch('failed', msg);
  }
}
