import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useRuntimeFabricStore } from '../stores/runtimeFabricStore';

interface ChatStreamPayload {
  traceId: string;
  sessionId: string;
  channelId: string;
  line: string;
}

interface ChatExitPayload {
  traceId: string;
  sessionId: string;
  channelId: string;
  code: number | null;
}

export async function installRuntimeFabricEventBridge(): Promise<() => void> {
  const unlisten: UnlistenFn[] = [];

  unlisten.push(await listen<ChatStreamPayload>('runtime://chat-stream', (event) => {
    const p = event.payload;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(p.line);
    } catch {
      parsed = { raw: p.line };
    }

    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: 'info',
      type: 'chat.delta',
      message: p.line,
      payload: parsed,
    });
  }));

  unlisten.push(await listen<ChatStreamPayload>('runtime://chat-stderr', (event) => {
    const p = event.payload;
    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: 'warning',
      type: 'chat.failed',
      message: p.line,
    });
  }));

  unlisten.push(await listen<ChatExitPayload>('runtime://chat-exit', (event) => {
    const p = event.payload;
    useRuntimeFabricStore.getState().patchChannel(p.channelId, {
      status: p.code === 0 ? 'stopped' : 'failed',
      exitedAt: new Date().toISOString(),
    });
    useRuntimeFabricStore.getState().patchSession(p.sessionId, {
      status: p.code === 0 ? 'idle' : 'failed',
      error: p.code === 0 ? null : `chat exited with code ${p.code}`,
    });
    useRuntimeFabricStore.getState().appendEvent({
      sessionId: p.sessionId,
      channelId: p.channelId,
      level: p.code === 0 ? 'info' : 'error',
      type: p.code === 0 ? 'chat.done' : 'chat.failed',
      message: `chat exited with code ${p.code}`,
    });
  }));

  return () => unlisten.forEach((fn) => fn());
}
