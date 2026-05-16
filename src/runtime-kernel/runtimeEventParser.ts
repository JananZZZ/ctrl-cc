import type { KernelChatMessage, RuntimeKernelEvent } from './types';

let lastAssistantBySession: Record<string, string> = {};

export function runtimeKernelEventToChatEvents(event: RuntimeKernelEvent): KernelChatMessage[] {
  const now = event.createdAt || new Date().toISOString();

  if (event.eventType === 'pty.data' && event.data) {
    const text = stripAnsi(event.data);

    if (!text.trim()) return [];

    if (/thinking|cogitat|思考|正在/i.test(text)) {
      return [{
        id: `think-${event.guiSessionId}-${hash(text)}-${Date.now()}`,
        sessionId: event.guiSessionId,
        projectId: '',
        type: 'thinking',
        content: text,
        createdAt: now,
        severity: 'low',
      }];
    }

    const prev = lastAssistantBySession[event.guiSessionId] ?? '';
    if (text === prev) return [];
    lastAssistantBySession[event.guiSessionId] = text;

    return [{
      id: `pty-text-${event.guiSessionId}-${hash(text)}-${Date.now()}`,
      sessionId: event.guiSessionId,
      projectId: '',
      type: 'assistant_message',
      content: text,
      createdAt: now,
      severity: 'low',
    }];
  }

  if (event.eventType.includes('error')) {
    return [{
      id: `err-${event.guiSessionId}-${Date.now()}`,
      sessionId: event.guiSessionId,
      projectId: '',
      type: 'system',
      content: event.message ?? 'Runtime error',
      createdAt: now,
      severity: 'medium',
    }];
  }

  if (event.message) {
    return [{
      id: `sys-${event.guiSessionId}-${event.eventType}-${Date.now()}`,
      sessionId: event.guiSessionId,
      projectId: '',
      type: 'system',
      content: event.message,
      createdAt: now,
      severity: 'low',
    }];
  }

  return [];
}

export function stripAnsi(input: string): string {
  return input
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\r/g, '\n');
}

function hash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(31, h) + input.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(36);
}
