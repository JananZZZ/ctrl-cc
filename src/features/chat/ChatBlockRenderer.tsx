import { useTranslation } from 'react-i18next';
import type { RuntimeEvent } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props { event: RuntimeEvent; onConfirm?: () => void; onReject?: () => void }

export function ChatBlockRenderer({ event, onConfirm, onReject }: Props) {
  switch (event.type) {
    case 'user_message': return <UserBubble content={event.content} />;
    case 'assistant_message':
    case 'assistant_delta': return <AssistantBubble content={event.content} tokens={event.inputTokens ?? event.outputTokens} />;
    case 'tool_use': return <ToolCard name={event.toolName ?? 'Tool'} input={event.toolInput} />;
    case 'tool_result': return <ToolResultCard content={event.content} isError={event.isError} />;
    case 'thinking':
    case 'thinking_delta': return <ThinkingBlock content={event.content} />;
    case 'permission_requested': return <PermissionCard content={event.content} onConfirm={onConfirm} onReject={onReject} />;
    case 'file_edited':
    case 'file_diff':
    case 'file_created':
    case 'file_deleted': return <FileChangeCard type={event.type} filePath={event.content} />;
    case 'command_started':
    case 'command_output':
    case 'command_completed': return <CommandCard content={event.content} title={event.title} />;
    case 'error': return <ErrorCard content={event.content} />;
    case 'summary': return <SummaryCard content={event.content} tokens={event.inputTokens ?? event.outputTokens} cost={event.totalCostUsd} duration={event.durationMs} />;
    case 'token_usage': return <TokenLine input={event.inputTokens ?? 0} output={event.outputTokens ?? 0} />;
    case 'cost_update': return <CostLine cost={event.totalCostUsd} />;
    case 'system_init': return <SystemNotice content={event.content} />;
    default: return <SystemNotice content={`[${event.type}] ${event.content.slice(0, 200)}`} />;
  }
}

function UserBubble({ content }: { content: string }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 16px' }}><div style={{ maxWidth: '72%', padding: '8px 14px', borderRadius: 'var(--cc-radius-lg) var(--cc-radius-lg) 4px var(--cc-radius-lg)', background: 'var(--cc-brand-soft)', fontSize: 'var(--cc-font-sm)', lineHeight: 1.55, color: 'var(--cc-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><MarkdownRenderer content={content} /></div></div>;
}

function AssistantBubble({ content, tokens }: { content: string; tokens?: number }) {
  return <div style={{ padding: '4px 16px' }}><div style={{ maxWidth: '85%', padding: '8px 14px', borderRadius: 'var(--cc-radius-lg) var(--cc-radius-lg) var(--cc-radius-lg) 4px', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', boxShadow: 'var(--cc-shadow-card)', fontSize: 'var(--cc-font-sm)', lineHeight: 1.55, color: 'var(--cc-text)' }}><MarkdownRenderer content={content} />{tokens != null && <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', marginTop: 4 }}>{tokens} tokens</div>}</div></div>;
}

function ToolCard({ name, input }: { name: string; input?: unknown }) {
  const inputStr = input ? JSON.stringify(input).slice(0, 200) : '';
  return <div style={{ margin: '2px 16px', padding: '6px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-subtle)', border: '1px solid var(--cc-border-soft)', fontSize: 'var(--cc-font-xs)', display: 'flex', alignItems: 'center', gap: 6 }}><span>🔧</span><span style={{ fontWeight: 600, color: 'var(--cc-blue)' }}>{name}</span><span style={{ color: 'var(--cc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inputStr}</span></div>;
}

function ToolResultCard({ content, isError }: { content: string; isError?: boolean }) {
  const { t } = useTranslation();
  return <details style={{ margin: '2px 16px', padding: '4px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-subtle)', border: `1px solid ${isError ? 'var(--cc-red)' : 'var(--cc-border-soft)'}`, fontSize: 'var(--cc-font-xs)' }}><summary style={{ cursor: 'pointer', color: isError ? 'var(--cc-red)' : 'var(--cc-text-secondary)' }}>📋 {t('chat.toolOutput')}</summary><pre style={{ margin: '4px 0', fontSize: 'var(--cc-font-xs)', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto', color: 'var(--cc-text)' }}>{content.slice(0, 3000)}</pre></details>;
}

function ThinkingBlock({ content }: { content: string }) {
  const { t } = useTranslation();
  return <details style={{ margin: '4px 16px', padding: '4px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-subtle)', border: '1px solid var(--cc-border-soft)', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}><summary style={{ cursor: 'pointer' }}>💭 {t('chat.thinkingProcess')}</summary><div style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>{content}</div></details>;
}

function PermissionCard({ content, onConfirm, onReject }: { content: string; onConfirm?: () => void; onReject?: () => void }) {
  const { t } = useTranslation();
  return <div style={{ margin: '4px 16px', padding: '10px 14px', borderRadius: 'var(--cc-radius-md)', background: 'var(--cc-amber-soft)', border: '1px solid var(--cc-amber)' }}><div style={{ fontWeight: 600, fontSize: 'var(--cc-font-sm)', marginBottom: 4 }}>⚠️ {t('chat.permissionRequest')}</div><div style={{ fontSize: 'var(--cc-font-sm)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{content}</div><div style={{ display: 'flex', gap: 8 }}>{onConfirm && <button onClick={onConfirm} style={btn(true)}>{t('chat.approve')}</button>}{onReject && <button onClick={onReject} style={btn(false)}>{t('chat.reject')}</button>}</div></div>;
}

function FileChangeCard({ type, filePath }: { type: string; filePath: string }) {
  const icon = type === 'file_edited' ? '✏️' : type === 'file_created' ? '➕' : '🗑️';
  return <div style={{ margin: '2px 16px', padding: '4px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-subtle)', border: '1px solid var(--cc-border-soft)', fontSize: 'var(--cc-font-xs)', display: 'flex', alignItems: 'center', gap: 6 }}><span>{icon}</span><span style={{ fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text)' }}>{filePath}</span></div>;
}

function CommandCard({ content, title }: { content: string; title?: string }) {
  return <div style={{ margin: '2px 16px', padding: '6px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-subtle)', fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--cc-green)' }}>$</span><span>{title ?? content}</span></div>;
}

function ErrorCard({ content }: { content: string }) {
  return <div style={{ margin: '4px 16px', padding: '8px 14px', borderRadius: 'var(--cc-radius-md)', background: 'var(--cc-red-soft)', border: '1px solid var(--cc-red)', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-red)' }}><span>❌</span> {content.slice(0, 300)}</div>;
}

function SummaryCard({ content, tokens, cost, duration }: { content: string; tokens?: number; cost?: number; duration?: number }) {
  return <div style={{ margin: '6px 16px', padding: '8px 14px', borderRadius: 'var(--cc-radius-md)', background: 'var(--cc-green-soft)', border: '1px solid var(--cc-green)', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span>✅</span><span>{content.slice(0, 200)}</span>{tokens != null && <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>{tokens} tokens</span>}{cost != null && <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>${cost.toFixed(4)}</span>}{duration != null && <span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>{duration}ms</span>}</div>;
}

function TokenLine({ input, output }: { input: number; output: number }) {
  return <div style={{ textAlign: 'center', padding: '2px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontStyle: 'italic' }}>📊 Tokens: {input} in / {output} out</div>;
}

function CostLine({ cost }: { cost?: number }) {
  if (cost == null) return null;
  return <div style={{ textAlign: 'center', padding: '2px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>💰 ${cost.toFixed(4)}</div>;
}

function SystemNotice({ content }: { content: string }) {
  return <div style={{ textAlign: 'center', padding: '4px 16px' }}><span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', padding: '2px 12px', borderRadius: 'var(--cc-radius-full)', background: 'var(--cc-bg-muted)', border: '1px solid var(--cc-border-muted)' }}>{content.slice(0, 150)}</span></div>;
}

const btn = (approve: boolean): React.CSSProperties => ({ padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: 600, border: 'none', borderRadius: 'var(--cc-radius-xs)', cursor: 'pointer', background: approve ? 'var(--cc-green)' : 'var(--cc-red)', color: 'var(--cc-text-on-accent)' });
