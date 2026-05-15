export interface ClaudeCodeParsedEvent {
  type: 'session_init' | 'assistant_delta' | 'assistant_message' | 'tool_use' | 'tool_result' | 'turn_result' | 'error' | 'raw';
  claudeSessionId?: string;
  model?: string;
  tools?: string[];
  text?: string;
  message?: unknown;
  result?: unknown;
  raw: Record<string, unknown>;
}

export class ClaudeCodeStreamParser {
  parseLine(line: string): ClaudeCodeParsedEvent {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(line);
    } catch {
      return { type: 'raw', raw: { _unparseable: line } };
    }

    // system/init — extract real session_id from Claude
    if (raw.type === 'system' && raw.subtype === 'init') {
      return {
        type: 'session_init',
        claudeSessionId: raw.session_id as string | undefined,
        model: raw.model as string | undefined,
        tools: raw.tools as string[] | undefined ?? [],
        raw,
      };
    }

    // stream_event + content_block_delta + text_delta → coalesced assistant delta
    if (
      raw.type === 'stream_event' &&
      (raw.event as Record<string, unknown>)?.type === 'content_block_delta' &&
      ((raw.event as Record<string, unknown>)?.delta as Record<string, unknown>)?.type === 'text_delta'
    ) {
      const delta = (raw.event as Record<string, unknown>)?.delta as Record<string, unknown>;
      return {
        type: 'assistant_delta',
        text: delta?.text as string,
        raw,
      };
    }

    // assistant message block
    if (raw.type === 'assistant') {
      return {
        type: 'assistant_message',
        message: raw.message,
        raw,
      };
    }

    // tool_use start
    if (raw.type === 'tool_use') {
      return {
        type: 'tool_use',
        text: raw.name as string,
        raw,
      };
    }

    // tool_result
    if (raw.type === 'tool_result') {
      return {
        type: 'tool_result',
        raw,
      };
    }

    // turn result — contains usage, cost, stop reason
    if (raw.type === 'result') {
      return {
        type: 'turn_result',
        result: raw,
        raw,
      };
    }

    // error event
    if (raw.type === 'error') {
      return {
        type: 'error',
        text: raw.message as string,
        raw,
      };
    }

    return { type: 'raw', raw };
  }
}
