import { useEffect, useRef } from 'react';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { ChatBlockRenderer } from '../../features/chat/ChatBlockRenderer';
import type { RuntimeEvent } from '../../types';

interface Props { events: RuntimeEvent[]; streaming?: boolean }

export function ChatView({ events, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events.length]);

  if (events.length === 0) {
    return <div data-testid="chat-view" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CcEmptyState icon="💬" title="开始对话" description="在下方输入消息，Claude Code 将通过 stream-json 控制面实时回复" /></div>;
  }

  return (
    <div data-testid="chat-view" style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
      {events.map((evt) => <ChatBlockRenderer key={evt.id} event={evt} />)}
      {streaming && <div style={{ padding: '4px 16px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontStyle: 'italic' }}>● Claude 正在回复...</div>}
      <div ref={bottomRef} />
    </div>
  );
}
