import { invoke } from '@tauri-apps/api/core';
import type { ErrorSource } from '../stores/errorStore';

export interface InvokeOptions {
  timeoutMs?: number;
  source?: ErrorSource;
  title?: string;
  silent?: boolean;
}

export class CtrlCcCommandTimeout extends Error {
  cmd: string;
  timeoutMs: number;
  constructor(cmd: string, timeoutMs: number) {
    super(`Command "${cmd}" timed out after ${timeoutMs}ms`);
    this.name = 'CtrlCcCommandTimeout';
    this.cmd = cmd;
    this.timeoutMs = timeoutMs;
  }
}

export function warnLog(source: ErrorSource, title: string, detail?: string) {
  console.warn(`[Ctrl-CC] ${source}: ${title}`, detail || '');
  try {
    import('../stores/errorStore').then(({ useErrorStore }) => {
      useErrorStore.getState().addError({
        severity: 'info', source, title: title.slice(0, 100), detail: detail || '',
      });
    }).catch(() => {});
  } catch {}
}

export async function invokeCommand<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions,
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const invokePromise = invoke<T>(cmd, args)
    .then((result) => result)
    .catch((error) => { throw error; });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CtrlCcCommandTimeout(cmd, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([invokePromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function invokeCommandSafe<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: InvokeOptions & { fallback?: T },
): Promise<T> {
  try {
    return await invokeCommand<T>(cmd, args, options);
  } catch (error) {
    const msg = String(error);
    if (!options?.silent) {
      try {
        const { useErrorStore } = await import('../stores/errorStore');
        useErrorStore.getState().addError({
          severity: error instanceof CtrlCcCommandTimeout ? 'warning' : 'error',
          source: options?.source || 'ipc',
          title: options?.title || `IPC command failed: ${cmd}`,
          detail: msg,
          rawError: msg,
        });
      } catch {}
    }
    if ('fallback' in (options ?? {})) return options!.fallback as T;
    throw error;
  }
}

export function runAsyncAction(
  action: () => Promise<void>,
  options?: { source?: ErrorSource; title?: string },
) {
  void action().catch(async (error) => {
    const msg = String(error);
    try {
      const { useErrorStore } = await import('../stores/errorStore');
      useErrorStore.getState().addError({
        severity: 'error',
        source: options?.source || 'unknown',
        title: options?.title || 'Async action failed',
        detail: msg,
        rawError: msg,
      });
    } catch {}
  });
}
