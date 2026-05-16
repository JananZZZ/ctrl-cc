import { create } from 'zustand';
import type { KernelChatMessage, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';

interface RuntimeKernelState {
  sessions: Record<string, RuntimeKernelSessionSnapshot>;
  rawOutput: Record<string, string>;
  chatMessages: Record<string, KernelChatMessage[]>;
  lastEvent: Record<string, RuntimeKernelEvent>;
  upsertSession: (snapshot: RuntimeKernelSessionSnapshot) => void;
  appendChatMessage: (sessionId: string, msg: KernelChatMessage) => void;
  applyEvent: (event: RuntimeKernelEvent) => void;
  removeSession: (sessionId: string) => void;
}

export const useRuntimeKernelStore = create<RuntimeKernelState>((set) => ({
  sessions: {}, rawOutput: {}, chatMessages: {}, lastEvent: {},
  upsertSession: (snapshot) => set((s) => ({ sessions: { ...s.sessions, [snapshot.guiSessionId]: snapshot } })),
  appendChatMessage: (sessionId, msg) => set((s) => {
    const old = s.chatMessages[sessionId] ?? [];
    if (old.some((x) => x.id === msg.id)) return s;
    return { chatMessages: { ...s.chatMessages, [sessionId]: [...old, msg].slice(-1000) } };
  }),
  applyEvent: (event) => set((s) => {
    const old = s.sessions[event.guiSessionId];
    const patched = old && event.status ? { ...old, status: event.status, pid: event.pid ?? old.pid, cwd: event.cwd ?? old.cwd, updatedAt: event.createdAt, lastError: event.eventType.includes('error') ? (event.message ?? old.lastError) : old.lastError } : old;
    return {
      sessions: patched ? { ...s.sessions, [event.guiSessionId]: patched } : s.sessions,
      lastEvent: { ...s.lastEvent, [event.guiSessionId]: event },
      rawOutput: event.eventType === 'pty.data' && event.data ? { ...s.rawOutput, [event.guiSessionId]: ((s.rawOutput[event.guiSessionId] ?? '') + event.data).slice(-300_000) } : s.rawOutput,
    };
  }),
  removeSession: (sessionId) => set((s) => {
    const sessions = { ...s.sessions }; const rawOutput = { ...s.rawOutput }; const chatMessages = { ...s.chatMessages }; const lastEvent = { ...s.lastEvent };
    delete sessions[sessionId]; delete rawOutput[sessionId]; delete chatMessages[sessionId]; delete lastEvent[sessionId];
    return { sessions, rawOutput, chatMessages, lastEvent };
  }),
}));
