import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { ChatBlockRenderer } from '../../features/chat/ChatBlockRenderer';
import type { RuntimeEvent } from '../../types';

interface Props { events: RuntimeEvent[]; streaming?: boolean }

export function ChatView({ events, streaming }: Props) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events.length]);

  if (events.length === 0) {
    return <div data-testid="chat-view" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CcEmptyState icon="💬" title={t('workspace.startChat')} description={t('workspace.startChatDesc')} /></div>;
  }

  return (
    <div data-testid="chat-view" style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
      {events.map((evt) => <ChatBlockRenderer key={evt.id} event={evt} />)}
      {streaming && <div style={{ padding: '4px 16px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontStyle: 'italic' }}>● {t('workspace.claudeReplying')}</div>}
      <div ref={bottomRef} />
    </div>
  );
}
