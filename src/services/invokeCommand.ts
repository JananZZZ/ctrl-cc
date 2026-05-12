import { invoke } from '@tauri-apps/api/core';
import type { ErrorSource } from '../stores/errorStore';

/** Unified warning logger — routes background failures to both console and ErrorStore */
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

export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const TIMEOUT_MS = 60_000;
  try {
    const result = await Promise.race([
      invoke<T>(cmd, args),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Command "${cmd}" timed out`)), TIMEOUT_MS),
      ),
    ]);
    return result as T;
  } catch (error) {
    throw error;
  }
}

export async function invokeCommandSafe<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options?: { silent?: boolean; source?: ErrorSource; title?: string },
): Promise<T> {
  try {
    return await invokeCommand<T>(cmd, args);
  } catch (error) {
    if (!options?.silent) {
      const msg = String(error);
      try {
        const { useErrorStore } = await import('../stores/errorStore');
        useErrorStore.getState().addError({
          severity: 'error',
          source: options?.source || 'ipc',
          title: options?.title || `IPC command failed: ${cmd}`,
          detail: msg,
          rawError: msg,
        });
      } catch {}
    }
    throw error;
  }
}
