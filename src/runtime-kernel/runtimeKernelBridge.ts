import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useRuntimeKernelStore } from './runtimeKernelStore';
import type { RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

const eventQueue: RuntimeKernelEvent[] = [];
let scheduled = false;
let installed = false;

function enqueue(event: RuntimeKernelEvent) {
  eventQueue.push(event);

  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const batch = eventQueue.splice(0, eventQueue.length);
      useRuntimeKernelStore.getState().ingestEventBatch(batch);
    });
  }
}

export const RuntimeKernelBridge = {
  async install(): Promise<UnlistenFn | undefined> {
    if (installed) return undefined;
    installed = true;

    const unlisten = await listen<RuntimeKernelEvent>('runtime-kernel://event', (evt) => {
      enqueue(evt.payload);
    });

    return () => {
      installed = false;
      unlisten();
    };
  },

  async startSession(input: {
    guiSessionId: string;
    projectId: string;
    cwd: string;
    model: string;
    effort: string;
    permissionMode: string;
  }): Promise<RuntimeKernelSessionSnapshot> {
    const snapshot = await invoke<RuntimeKernelSessionSnapshot>('runtime_kernel_start_session', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId: input.guiSessionId,
        projectId: input.projectId,
        cwd: input.cwd,
        model: input.model,
        effort: input.effort,
        permissionMode: input.permissionMode,
      },
    });

    useRuntimeKernelStore.getState().upsertSession(snapshot);
    return snapshot;
  },

  async submitUserMessage(input: {
    guiSessionId: string;
    projectId: string;
    text: string;
  }): Promise<void> {
    useRuntimeKernelStore.getState().appendUserMessage(input.guiSessionId, input.text);

    await invoke('runtime_kernel_submit_user_message', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId: input.guiSessionId,
        text: input.text,
      },
    });
  },

  async writeTerminal(input: { guiSessionId: string; data: string }): Promise<void> {
    await invoke('runtime_kernel_write_terminal', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId: input.guiSessionId,
        data: input.data,
      },
    });
  },

  async stopSession(guiSessionId: string, force = false): Promise<void> {
    await invoke('runtime_kernel_stop_session', {
      req: {
        traceId: `trace-${crypto.randomUUID()}`,
        guiSessionId,
        force,
      },
    });

    useRuntimeKernelStore.getState().markStopped(guiSessionId);
  },

  async detachSession(guiSessionId: string): Promise<void> {
    await invoke('runtime_kernel_detach_session', { guiSessionId });
  },

  async listSessions(): Promise<RuntimeKernelSessionSnapshot[]> {
    const snapshots = await invoke<RuntimeKernelSessionSnapshot[]>('runtime_kernel_list_sessions');
    for (const s of snapshots) {
      useRuntimeKernelStore.getState().upsertSession(s);
    }
    return snapshots;
  },
};
