import { create } from 'zustand';
import type { ChatBlock, RuntimeKernelEvent, RuntimeKernelSessionSnapshot } from './types';
import { projectRawToChat } from './parsers/chatProjection';
import { StreamCoalescer } from '../features/chat/StreamCoalescer';

/** 全局 StreamCoalescer 单例，跨批次保持流缓冲状态 */
const coalescer = new StreamCoalescer();

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
      // 只在批处理开始时复制一次顶层对象。
      const sessions = { ...state.sessions };
      const rawEvents = { ...state.rawEvents };
      const terminalBuffers = { ...state.terminalBuffers };
      const chatBlocks = { ...state.chatBlocks };
      const activeAssistantBlockId = { ...state.activeAssistantBlockId };

      // 跟踪本次批量中哪些会话有新的 raw 数据（延迟投影）
      const rawDirty = new Set<string>();

      for (const evt of events) {
        const sid = evt.guiSessionId;

        rawEvents[sid] = [...(rawEvents[sid] ?? []), evt].slice(-2000);

        if (evt.channel === 'raw' && evt.data) {
          // 累积终端缓冲，延迟 chat 投影以避免高频调用 projectRawToChat
          terminalBuffers[sid] = (terminalBuffers[sid] ?? '') + evt.data;
          rawDirty.add(sid);
          // v29: 喂入 StreamCoalescer，合并连续 raw 块（用于跨批次去重）
          coalescer.feed(evt);
        }

        if (evt.channel === 'status' && evt.status) {
          const existing = sessions[sid];
          if (existing) {
            sessions[sid] = {
              ...existing,
              status: evt.status,
              pid: evt.pid ?? existing.pid,
              cwd: evt.cwd ?? existing.cwd,
              updatedAt: evt.createdAt,
            };
          }
        }

        if (evt.channel === 'error') {
          chatBlocks[sid] = [
            ...(chatBlocks[sid] ?? []),
            {
              id: `err-${evt.seq}-${evt.createdAt}`,
              kind: 'error',
              content: evt.data ?? 'Runtime error',
              createdAt: evt.createdAt,
            },
          ];
        }
      }

      // 批量结束时，对每个脏会话只做一次 chat 投影（StreamCoalescer 去重）
      for (const sid of rawDirty) {
        // 尝试冲刷 coalescer 缓冲，获取合并后的 raw 数据
        const flushed = coalescer.flush(sid);
        const projectedRaw = flushed?.data ?? terminalBuffers[sid] ?? '';
        if (projectedRaw) {
          const projected = projectRawToChat({
            sessionId: sid,
            raw: projectedRaw,
            existingBlocks: chatBlocks[sid] ?? [],
            activeAssistantBlockId: activeAssistantBlockId[sid] ?? null,
          });
          chatBlocks[sid] = projected.blocks;
          activeAssistantBlockId[sid] = projected.activeAssistantBlockId;
        }
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
      if (existing.status === 'stopped') return state;
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
