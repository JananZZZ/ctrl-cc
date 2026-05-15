import { create } from 'zustand';
import type {
  CtrlCcSession,
  CtrlCcSessionId,
  RuntimeChannel,
  RuntimeChannelId,
  LedgerEvent,
} from '../types/runtimeFabricTypes';
import type { RuntimeEvent } from '../../../types';

interface RuntimeFabricState {
  sessions: Record<CtrlCcSessionId, CtrlCcSession>;
  channels: Record<RuntimeChannelId, RuntimeChannel>;
  ledger: LedgerEvent[];
  chatEvents: Record<string, RuntimeEvent[]>;

  addSession: (session: CtrlCcSession) => void;
  patchSession: (id: CtrlCcSessionId, patch: Partial<CtrlCcSession>) => void;

  addChannel: (channel: RuntimeChannel) => void;
  patchChannel: (id: RuntimeChannelId, patch: Partial<RuntimeChannel>) => void;

  appendEvent: (event: Omit<LedgerEvent, 'id' | 'ts'> & { id?: string; ts?: string }) => void;
  getSessionEvents: (sessionId: CtrlCcSessionId) => LedgerEvent[];
  appendChatEvent: (sessionId: string, event: RuntimeEvent) => void;
  upsertAssistantDelta: (sessionId: string, channelId: string, delta: string) => void;
}

export const useRuntimeFabricStore = create<RuntimeFabricState>((set, get) => ({
  sessions: {},
  channels: {},
  ledger: [],
  chatEvents: {},

  addSession: (session) => {
    set((state) => ({ sessions: { ...state.sessions, [session.id]: session } }));
  },

  patchSession: (id, patch) => {
    set((state) => {
      const prev = state.sessions[id];
      if (!prev) return state;
      return {
        sessions: {
          ...state.sessions,
          [id]: { ...prev, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  addChannel: (channel) => {
    set((state) => ({ channels: { ...state.channels, [channel.id]: channel } }));
  },

  patchChannel: (id, patch) => {
    set((state) => {
      const prev = state.channels[id];
      if (!prev) return state;
      return {
        channels: {
          ...state.channels,
          [id]: { ...prev, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  appendEvent: (event) => {
    const full: LedgerEvent = {
      ...event,
      id: event.id ?? crypto.randomUUID(),
      ts: event.ts ?? new Date().toISOString(),
    };
    set((state) => ({ ledger: [full, ...state.ledger].slice(0, 2000) }));
  },

  getSessionEvents: (sessionId) => {
    return get().ledger.filter((e) => e.sessionId === sessionId);
  },

  appendChatEvent: (sessionId, event) => {
    set((state) => {
      const prev = state.chatEvents[sessionId] ?? [];
      return {
        chatEvents: {
          ...state.chatEvents,
          [sessionId]: [...prev, event].slice(-500),
        },
      };
    });
  },

  upsertAssistantDelta: (sessionId, channelId, delta) => {
    set((state) => {
      const prev = state.chatEvents[sessionId] ?? [];
      const streamId = `assistant-stream-${channelId}`;
      const existingIndex = prev.findIndex((e) => e.id === streamId);

      const now = new Date().toISOString();

      if (existingIndex >= 0) {
        const next = [...prev];
        const old = next[existingIndex];
        next[existingIndex] = {
          ...old,
          content: `${old.content ?? ''}${delta}`,
          createdAt: old.createdAt || now,
        };
        return {
          chatEvents: {
            ...state.chatEvents,
            [sessionId]: next.slice(-500),
          },
        };
      }

      return {
        chatEvents: {
          ...state.chatEvents,
          [sessionId]: [
            ...prev,
            {
              id: streamId,
              sessionId,
              projectId: '',
              type: 'assistant_message',
              content: delta,
              severity: 'low',
              createdAt: now,
            } as RuntimeEvent,
          ].slice(-500),
        },
      };
    });
  },
}));
