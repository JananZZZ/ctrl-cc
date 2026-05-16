import { create } from 'zustand';
import type { ChatBlock, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';
import { projectRawToChat } from './parsers/chatProjection';

interface RuntimeKernelState {
  sessions: Record<string, RuntimeKernelSessionSnapshot>;
  rawEvents: Record<string, RuntimeKernelEvent[]>;
  terminalBuffers: Record<string, string>;
  chatBlocks: Record<string, ChatBlock[]>;
  activeAssistantBlockId: Record<string, string | null>;

  upsertSession: (snapshot: RuntimeKernelSessionSnapshot) => void;
  ingestEventBatch: (events: RuntimeKernelEvent[]) => void;
  appendUserMessage: (sessionId: string, text: string) => void;
  detachView: (sessionId: string) => void;
  markStopped: (sessionId: string) => void;
}

export const useRuntimeKernelStore = create<RuntimeKernelState>((set) => ({
  sessions: {},
  rawEvents: {},
  terminalBuffers: {},
  chatBlocks: {},
  activeAssistantBlockId: {},

  upsertSession: (snapshot) => {
    set((state) => {
      const existing = state.sessions[snapshot.guiSessionId];
      // Idempotent guard: if snapshot identical to existing, return state unchanged
      if (
        existing &&
        existing.traceId === snapshot.traceId &&
        existing.runtimeSessionId === snapshot.runtimeSessionId &&
        existing.claudeSessionId === snapshot.claudeSessionId &&
        existing.projectId === snapshot.projectId &&
        existing.cwd === snapshot.cwd &&
        existing.pid === snapshot.pid &&
        existing.status === snapshot.status &&
        existing.hasWriter === snapshot.hasWriter &&
        existing.readerAlive === snapshot.readerAlive &&
        existing.createdAt === snapshot.createdAt &&
        existing.updatedAt === snapshot.updatedAt &&
        existing.lastError === snapshot.lastError
      ) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [snapshot.guiSessionId]: snapshot,
        },
      };
    });
  },

  appendUserMessage: (sessionId, text) => {
    const now = new Date().toISOString();
    const block: ChatBlock = {
      id: `user-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind: 'user',
      content: text,
      createdAt: now,
    };

    set((state) => ({
      chatBlocks: {
        ...state.chatBlocks,
        [sessionId]: [...(state.chatBlocks[sessionId] ?? []), block],
      },
      activeAssistantBlockId: {
        ...state.activeAssistantBlockId,
        [sessionId]: null,
      },
    }));
  },

  ingestEventBatch: (events) => {
    if (events.length === 0) return;

    set((state) => {
      let sessions = state.sessions;
      let rawEvents = state.rawEvents;
      let terminalBuffers = state.terminalBuffers;
      let chatBlocks = state.chatBlocks;
      let activeAssistantBlockId = state.activeAssistantBlockId;

      for (const evt of events) {
        const sid = evt.guiSessionId;

        rawEvents = {
          ...rawEvents,
          [sid]: [...(rawEvents[sid] ?? []), evt].slice(-2000),
        };

        if (evt.channel === 'raw' && evt.data) {
          terminalBuffers = {
            ...terminalBuffers,
            // v29: Enforce 32KB PTY tail cap per session
            [sid]: ((terminalBuffers[sid] ?? '') + evt.data).slice(-32768),
          };

          const projected = projectRawToChat({
            sessionId: sid,
            raw: evt.data,
            existingBlocks: chatBlocks[sid] ?? [],
            activeAssistantBlockId: activeAssistantBlockId[sid] ?? null,
          });

          // v29: Cap chat blocks at 500 per session
          chatBlocks = {
            ...chatBlocks,
            [sid]: projected.blocks.slice(-500),
          };

          activeAssistantBlockId = {
            ...activeAssistantBlockId,
            [sid]: projected.activeAssistantBlockId,
          };
        }

        if (evt.channel === 'status' && evt.status) {
          const existing = sessions[sid];
          if (existing) {
            sessions = {
              ...sessions,
              [sid]: {
                ...existing,
                status: evt.status,
                pid: evt.pid ?? existing.pid,
                cwd: evt.cwd ?? existing.cwd,
                updatedAt: evt.createdAt,
              },
            };
          }
        }

        if (evt.channel === 'error') {
          const block: ChatBlock = {
            id: `err-${evt.seq}-${evt.createdAt}`,
            kind: 'error',
            content: evt.data ?? 'Runtime error',
            createdAt: evt.createdAt,
          };

          chatBlocks = {
            ...chatBlocks,
            [sid]: [...(chatBlocks[sid] ?? []), block],
          };
        }
      }

      // Idempotent guard: if nothing changed, return previous state
      if (
        sessions === state.sessions &&
        rawEvents === state.rawEvents &&
        terminalBuffers === state.terminalBuffers &&
        chatBlocks === state.chatBlocks &&
        activeAssistantBlockId === state.activeAssistantBlockId
      ) {
        return state;
      }

      return {
        sessions,
        rawEvents,
        terminalBuffers,
        chatBlocks,
        activeAssistantBlockId,
      };
    });
  },

  detachView: (_sessionId) => {
    // no-op for backend; App tab store handles UI removal
  },

  markStopped: (sessionId) => {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            status: 'stopped' as const,
            hasWriter: false,
            readerAlive: false,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },
}));
