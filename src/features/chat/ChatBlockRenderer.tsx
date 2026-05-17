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
    case 'thinking':
      return <ThinkingBlock content={block.content} />;
    case 'permission':
      return <PermissionBlock rule={block.rule} approved={block.approved} />;
    case 'file_change':
      return <FileChangeBlock path={block.path} action={block.action} diff={block.diff} />;
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
    <div className="cc-msg-row cc-msg-row-system">
      <details className="cc-tool-card">
        <summary>{name}</summary>
        <pre>{content}</pre>
      </details>
    </div>
  );
}

function ErrorBlock({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-error-card">{content}</div>
    </div>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <details className="cc-tool-card" style={{ borderColor: 'var(--cc-purple)', background: 'var(--cc-purple-soft)' }}>
        <summary style={{ color: 'var(--cc-purple)', fontWeight: 500 }}>Thinking</summary>
        <pre style={{ fontSize: 'var(--cc-font-xs)', whiteSpace: 'pre-wrap' }}>{content}</pre>
      </details>
    </div>
  );
}

function PermissionBlock({ rule, approved }: { rule: string; approved?: boolean }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <div className="cc-status-chip" style={{
        borderColor: approved ? 'var(--cc-green)' : approved === false ? 'var(--cc-red)' : 'var(--cc-amber)',
        background: approved ? 'var(--cc-green-soft)' : approved === false ? 'var(--cc-red-soft)' : 'var(--cc-amber-soft)',
        color: approved ? 'var(--cc-green)' : approved === false ? 'var(--cc-red)' : 'var(--cc-amber)',
      }}>
        <span>Permission</span>
        <span>{rule}{approved === undefined ? ' (待确认)' : approved ? ' (已批准)' : ' (已拒绝)'}</span>
      </div>
    </div>
  );
}

function FileChangeBlock({ path, action, diff }: { path: string; action: string; diff?: string }) {
  return (
    <div className="cc-msg-row cc-msg-row-system">
      <details className="cc-tool-card" style={{ borderColor: 'var(--cc-blue)', background: 'var(--cc-blue-soft)' }}>
        <summary style={{ color: 'var(--cc-blue)', fontWeight: 500 }}>
          {action}: {path}
        </summary>
        {diff && <pre style={{ fontSize: 'var(--cc-font-xs)', whiteSpace: 'pre-wrap' }}>{diff}</pre>}
      </details>
    </div>
  );
}
