import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import type { ChatBlock } from '../../runtime-kernel/types';
import { ChatBlockRenderer } from '../../features/chat/ChatBlockRenderer';

interface Props {
  blocks: ChatBlock[];
  streaming?: boolean;
  rawBuffer?: string;
}

export function ChatView({ blocks, streaming, rawBuffer }: Props) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showRaw, setShowRaw] = useState(false);

  const lastBlockId = blocks[blocks.length - 1]?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [lastBlockId, showRaw, rawBuffer]);

  const renderedBlocks = useMemo(() => blocks, [blocks]);

  if (renderedBlocks.length === 0 && (!rawBuffer || rawBuffer.length === 0)) {
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
      <div className="cc-chat-toolbar" style={{
        display: 'flex', justifyContent: 'flex-end', padding: '4px 8px',
        borderBottom: '1px solid var(--cc-border-soft)',
      }}>
        <button
          className={showRaw ? 'cc-btn cc-btn-soft' : 'cc-btn cc-btn-ghost'}
          onClick={() => setShowRaw(!showRaw)}
          style={{ fontSize: 'var(--cc-font-xs)', minHeight: 26, padding: '0 10px' }}
        >
          {showRaw ? '气泡视图' : '原始输出'}
        </button>
      </div>
      {showRaw ? (
        <pre className="cc-chat-raw" style={{
          flex: 1, overflow: 'auto', margin: 0, padding: '12px 16px',
          fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)',
          color: 'var(--cc-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          lineHeight: 'var(--cc-leading-normal)',
        }}>
          {rawBuffer || '(无原始输出)'}
        </pre>
      ) : (
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
      )}
    </div>
  );
}
