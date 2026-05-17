import type { RuntimeKernelEvent } from '../../runtime-kernel/types';

/** 流式数据块，用于合并连续的 raw 数据避免高频 chat block 投影。 */
interface StreamingBlock {
  id: string;
  sessionId: string;
  data: string;
  startTime: number;
}

/**
 * StreamCoalescer — 会话感知的流式去重/合并器。
 * 将连续的 raw channel 事件合并为更大的批处理块，
 * 减少 projectRawToChat 调用频率，避免渲染抖动。
 */
export class StreamCoalescer {
  private streams = new Map<string, StreamingBlock>();

  /**
   * 摄入一个 RuntimeKernelEvent。
   * 对于 raw channel 事件，合并前缀缓冲；对于非 raw 事件，刷新对应会话的缓冲。
   * 返回需要被消费的事件列表（可能是合并后的）。
   */
  feed(event: RuntimeKernelEvent): RuntimeKernelEvent[] {
    if (event.channel === 'raw' && event.data) {
      const key = `raw-${event.guiSessionId}`;
      const existing = this.streams.get(key);
      if (existing) {
        // 合并到现有缓冲
        existing.data += event.data;
        return [];
      }
      // 新建缓冲
      const block: StreamingBlock = {
        id: `coalesced-${Date.now()}`,
        sessionId: event.guiSessionId,
        data: event.data,
        startTime: Date.now(),
      };
      this.streams.set(key, block);
      return [];
    }

    // 非 raw 事件：刷新对应会话的缓冲
    const key = `raw-${event.guiSessionId}`;
    const buffered = this.streams.get(key);
    if (buffered) {
      this.streams.delete(key);
      // 输出合并后的事件
      const coalesced: RuntimeKernelEvent = {
        seq: event.seq,
        traceId: event.traceId,
        guiSessionId: event.guiSessionId,
        runtimeSessionId: event.runtimeSessionId,
        eventType: 'raw',
        channel: 'raw',
        data: buffered.data,
        createdAt: event.createdAt,
      };
      return [coalesced, event];
    }

    return [event];
  }

  /** 强制刷新指定会话的缓冲，返回合并后的事件。 */
  flush(sessionId: string): RuntimeKernelEvent | null {
    const key = `raw-${sessionId}`;
    const existing = this.streams.get(key);
    if (!existing) return null;
    this.streams.delete(key);
    return {
      seq: 0,
      traceId: '',
      guiSessionId: sessionId,
      runtimeSessionId: '',
      eventType: 'raw',
      channel: 'raw',
      data: existing.data,
      createdAt: new Date().toISOString(),
    };
  }

  /** 重置指定会话的缓冲状态。 */
  reset(sessionId: string): void {
    this.streams.delete(`raw-${sessionId}`);
  }

  /** 是否有未刷新的缓冲数据。 */
  isBuffering(sessionId: string): boolean {
    return this.streams.has(`raw-${sessionId}`);
  }
}
