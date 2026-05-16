import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import type { ChatBlock } from '../../runtime-kernel/types';
import { ChatBlockRenderer } from '../../features/chat/ChatBlockRenderer';

interface Props {
  blocks: ChatBlock[];
  streaming?: boolean;
}

export function ChatView({ blocks, streaming }: Props) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastBlockId = blocks[blocks.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastBlockId]);

  const renderedBlocks = useMemo(() => blocks, [blocks]);

  if (renderedBlocks.length === 0) {
    return (
      <div className="cc-chat-empty" data-testid="chat-view">
        <CcEmptyState
          icon="💬"
          title={t('workspace.startChat')}
          description={t('workspace.startChatDesc')}
        />
      </div>
    );
  }

  return (
    <div className="cc-chat-view" data-testid="chat-view">
      <div className="cc-chat-timeline">
        {renderedBlocks.map((block) => (
          <ChatBlockRenderer key={block.id} block={block} />
        ))}
        {streaming && (
          <div className="cc-chat-streaming-indicator">
            <span className="cc-pulse-dot" />
            {t('workspace.claudeReplying')}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
