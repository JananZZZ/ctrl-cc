import type { RuntimeEvent } from '../../types';

interface StreamingBlock {
  id: string;
  sessionId: string;
  type: string;
  content: string;
  startTime: number;
}

export class StreamCoalescer {
  private streams = new Map<string, StreamingBlock>();

  feed(event: RuntimeEvent): RuntimeEvent | null {
    if (event.type === 'assistant_delta') {
      const key = `delta-${event.sessionId}`;
      const existing = this.streams.get(key);
      if (existing) {
        existing.content += event.content;
        return {
          ...event,
          id: existing.id,
          type: 'assistant_message',
          content: existing.content,
        };
      }
      const block: StreamingBlock = {
        id: `stream-${Date.now()}`,
        sessionId: event.sessionId,
        type: 'assistant_message',
        content: event.content,
        startTime: Date.now(),
      };
      this.streams.set(key, block);
      return { ...event, id: block.id, type: 'assistant_message', content: block.content };
    }

    // Non-delta event finalizes the stream
    this.streams.delete(`delta-${event.sessionId}`);
    return event;
  }

  reset(sessionId: string) {
    this.streams.delete(`delta-${sessionId}`);
  }

  isStreaming(sessionId: string): boolean {
    return this.streams.has(`delta-${sessionId}`);
  }
}
