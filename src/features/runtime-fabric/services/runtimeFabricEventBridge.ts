import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useRuntimeFabricStore } from '../stores/runtimeFabricStore';
import type { RuntimeEvent } from '../../../types';

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

function extractText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const p = parsed as Record<string, unknown>;
  if (typeof p.text === 'string') return p.text;
  if (typeof p.delta === 'string') return p.delta;
  if (typeof p.result === 'string') return p.result;
  const content = (p.message as Record<string, unknown>)?.content ?? p.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as Array<Record<string, unknown>>)
      .map((x) => x?.text || x?.content || '')
      .join('');
  }
  return '';
}

function makeRuntimeEvent(sessionId: string, type: string, content: string): RuntimeEvent {
  return {
    id: `fabric-${sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sessionId,
    projectId: '',
    type: type as RuntimeEvent['type'],
    content,
    severity: 'low',
    createdAt: new Date().toISOString(),
  };
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

    const text = extractText(parsed);
    if (text) {
      useRuntimeFabricStore.getState().appendChatEvent(
        p.sessionId,
        makeRuntimeEvent(p.sessionId, 'assistant_delta', text)
      );
    }
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
    useRuntimeFabricStore.getState().appendChatEvent(
      p.sessionId,
      makeRuntimeEvent(p.sessionId, 'system', p.line)
    );
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
