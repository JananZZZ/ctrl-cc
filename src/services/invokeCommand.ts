import { invoke } from '@tauri-apps/api/core';

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
