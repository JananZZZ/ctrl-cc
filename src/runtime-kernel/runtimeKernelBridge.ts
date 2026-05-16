import { listen } from '@tauri-apps/api/event';
import { invokeCommand } from '../services/invokeCommand';
import { useRuntimeKernelStore } from './runtimeKernelStore';
import type { KernelChatMessage, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

function trace(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function stripAnsi(s: string) { return s.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '').replace(/\r/g, '\n'); }

function makeAssistantMessage(event: RuntimeKernelEvent): KernelChatMessage | null {
  if (event.eventType !== 'pty.data' || !event.data) return null;
  const text = stripAnsi(event.data);
  if (!text.trim()) return null;
  return { id: `assistant-${event.guiSessionId}-${event.createdAt}-${Math.random().toString(16).slice(2)}`, sessionId: event.guiSessionId, projectId: '', type: /thinking|思考|cogitat/i.test(text) ? 'thinking' : 'assistant_message', content: text, severity: 'low', createdAt: event.createdAt };
}

let installed = false;

export const RuntimeKernelBridge = {
  async install() {
    if (installed) return () => {};
    installed = true;
    const unlisten = await listen<RuntimeKernelEvent>('runtime-kernel://event', (e) => {
      const event = e.payload;
      const store = useRuntimeKernelStore.getState();
      store.applyEvent(event);
      const msg = makeAssistantMessage(event);
      if (msg) store.appendChatMessage(event.guiSessionId, msg);
    });
    return () => { installed = false; unlisten(); };
  },

  async listSessions() {
    const sessions = await invokeCommand<RuntimeKernelSessionSnapshot[]>('runtime_kernel_list_sessions', undefined, { timeoutMs: 30_000, source: 'session', title: 'List runtime kernel sessions failed' });
    sessions.forEach((s) => useRuntimeKernelStore.getState().upsertSession(s));
    return sessions;
  },

  async startSession(input: { guiSessionId: string; projectId: string; cwd: string; model?: string; permissionMode?: string; sessionName?: string; resumeTarget?: string | null }) {
    const snapshot = await invokeCommand<RuntimeKernelSessionSnapshot>('runtime_kernel_start_session', { req: { traceId: trace('runtime-start'), guiSessionId: input.guiSessionId, projectId: input.projectId, cwd: input.cwd, model: input.model ?? null, permissionMode: input.permissionMode ?? null, sessionName: input.sessionName ?? null, resumeTarget: input.resumeTarget ?? null } }, { timeoutMs: 60_000, source: 'session', title: 'Start runtime kernel session failed' });
    useRuntimeKernelStore.getState().upsertSession(snapshot);
    return snapshot;
  },

  async submitUserMessage(input: { guiSessionId: string; projectId: string; text: string }) {
    useRuntimeKernelStore.getState().appendChatMessage(input.guiSessionId, { id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`, sessionId: input.guiSessionId, projectId: input.projectId, type: 'user_message', content: input.text, severity: 'low', createdAt: new Date().toISOString() });
    await invokeCommand('runtime_kernel_submit_user_message', { req: { traceId: trace('runtime-submit'), guiSessionId: input.guiSessionId, text: input.text } }, { timeoutMs: 30_000, source: 'session', title: 'Send user message failed' });
  },

  async writeTerminal(input: { guiSessionId: string; data: string }) {
    await invokeCommand('runtime_kernel_write_terminal', { req: { traceId: trace('runtime-write'), guiSessionId: input.guiSessionId, data: input.data } }, { timeoutMs: 30_000, source: 'pty', title: 'Write terminal failed' });
  },

  async stopSession(guiSessionId: string) {
    await invokeCommand('runtime_kernel_stop_session', { req: { traceId: trace('runtime-stop'), guiSessionId, force: true } }, { timeoutMs: 30_000, source: 'session', title: 'Stop runtime kernel session failed' });
    useRuntimeKernelStore.getState().removeSession(guiSessionId);
  },
};
