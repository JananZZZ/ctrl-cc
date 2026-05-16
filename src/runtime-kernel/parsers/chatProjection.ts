import type { ChatBlock } from '../types';
import { stripAnsi } from './ansi';

interface ProjectInput {
  sessionId: string;
  raw: string;
  existingBlocks: ChatBlock[];
  activeAssistantBlockId: string | null;
}

interface ProjectOutput {
  blocks: ChatBlock[];
  activeAssistantBlockId: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function looksLikeStatusLine(line: string) {
  const s = line.trim().toLowerCase();
  return (
    s.includes('thinking') ||
    s.includes('cogitated') ||
    s.includes('tool use') ||
    s.includes('permission') ||
    s.includes('running') ||
    s.includes('esc to interrupt')
  );
}

function shouldIgnoreLine(line: string) {
  const s = line.trim();
  if (!s) return true;
  if (/^[>›❯]\s*$/.test(s)) return true;
  return false;
}

export function projectRawToChat(input: ProjectInput): ProjectOutput {
  const clean = stripAnsi(input.raw).replace(/\r/g, '\n');
  const lines = clean.split('\n');

  let blocks = input.existingBlocks;
  let activeAssistantBlockId = input.activeAssistantBlockId;

  for (const line of lines) {
    if (shouldIgnoreLine(line)) continue;

    if (looksLikeStatusLine(line)) {
      blocks = [
        ...blocks,
        {
          id: `status-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          kind: 'status' as const,
          label: 'Claude',
          content: line.trim(),
          createdAt: nowIso(),
        },
      ];
      continue;
    }

    const at = nowIso();

    if (!activeAssistantBlockId) {
      const id = `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeAssistantBlockId = id;
      blocks = [
        ...blocks,
        {
          id,
          kind: 'assistant' as const,
          content: line,
          streaming: true,
          createdAt: at,
          updatedAt: at,
        },
      ];
    } else {
      blocks = blocks.map((b) => {
        if (b.id !== activeAssistantBlockId || b.kind !== 'assistant') return b;
        return {
          ...b,
          content: b.content ? `${b.content}\n${line}` : line,
          updatedAt: at,
        };
      });
    }
  }

  return { blocks, activeAssistantBlockId };
}
