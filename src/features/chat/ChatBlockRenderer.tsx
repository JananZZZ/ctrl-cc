import type { ChatBlock } from '../../runtime-kernel/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  block: ChatBlock;
}

export function ChatBlockRenderer({ block }: Props) {
  switch (block.kind) {
    case 'user':
      return <UserBubble content={block.content} />;
    case 'assistant':
      return <AssistantBubble content={block.content} streaming={block.streaming} />;
    case 'status':
      return <StatusBlock label={block.label} content={block.content} />;
    case 'tool':
      return <ToolBlock name={block.name} content={block.content} />;
    case 'error':
      return <ErrorBlock content={block.content} />;
    default:
      return null;
  }
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-user">
      <div className="cc-msg-bubble cc-msg-user">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}

function AssistantBubble({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="cc-msg-row cc-msg-row-assistant">
      <div className="cc-msg-bubble cc-msg-assistant">
        <MarkdownRenderer content={content} />
        {streaming && <div className="cc-msg-streaming">typing...</div>}
      </div>
    </div>
  );
}

function StatusBlock({ label, content }: { label: string; content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-status-chip">
        <span>{label}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}

function ToolBlock({ name, content }: { name: string; content: string }) {
  return (
    <details className="cc-tool-card">
      <summary>{name}</summary>
      <pre>{content}</pre>
    </details>
  );
}

function ErrorBlock({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-error-card">{content}</div>
    </div>
  );
}
