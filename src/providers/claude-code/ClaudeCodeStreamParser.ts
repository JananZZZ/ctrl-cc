export interface NormalizedRuntimeEvent {
  id: string;
  sessionId: string;
  type: 'assistant_text' | 'assistant_delta' | 'tool_call' | 'tool_result' | 'usage' | 'error' | 'result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  usage?: { inputTokens: number; outputTokens: number };
  createdAt: string;
}

export class ClaudeCodeStreamParser {
  parseLine(line: string): NormalizedRuntimeEvent | null {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      return null;
    }

    const type = this.classify(parsed);
    if (!type) return null;

    return {
      id: `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sessionId: '',
      type,
      content: this.extractText(parsed),
      toolName: parsed.tool as string | undefined,
      toolInput: parsed.input as Record<string, unknown> | undefined,
      usage: parsed.usage as { inputTokens: number; outputTokens: number } | undefined,
      createdAt: new Date().toISOString(),
    };
  }

  private classify(parsed: Record<string, unknown>): NormalizedRuntimeEvent['type'] | null {
    if (parsed.type === 'assistant') return 'assistant_text';
    if (parsed.type === 'content_block_delta') return 'assistant_delta';
    if (parsed.type === 'tool_use') return 'tool_call';
    if (parsed.type === 'tool_result') return 'tool_result';
    if (parsed.type === 'error') return 'error';
    if (parsed.type === 'result') return 'result';
    if (parsed.delta || parsed.text || parsed.content) return 'assistant_delta';
    return null;
  }

  private extractText(parsed: Record<string, unknown>): string {
    if (typeof parsed.text === 'string') return parsed.text;
    if (typeof parsed.delta === 'string') return parsed.delta;
    if (typeof parsed.content === 'string') return parsed.content;
    const msg = parsed.message as Record<string, unknown> | undefined;
    if (msg?.content && typeof msg.content === 'string') return msg.content;
    return '';
  }
}
