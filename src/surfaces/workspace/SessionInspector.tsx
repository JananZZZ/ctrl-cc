// SessionInspector — READ-ONLY monitor. React #185 fix:
// NO store writes during render, NO useEffect→patchSession loops,
// NO returning new objects from selectors, tabs ONLY changed by user click.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import { CcBadge } from '../../components/ui/CcBadge';
import type { Session } from '../../types';
import type { ChatBlock } from '../../runtime-kernel/types';
import { useAuditStore } from '../../stores/auditStore';

interface Props {
  session: Session | null;
  events?: ChatBlock[];
  collapsed: boolean;
  expanded: boolean;
  onToggleCollapse: () => void;
  onToggleExpand: () => void;
}

export function SessionInspector({ session, events: rawEvents = [], collapsed, expanded, onToggleCollapse, onToggleExpand }: Props) {
  const { t } = useTranslation();
  const width = collapsed ? 32 : expanded ? 520 : 320;

  const stableEvents = rawEvents;
  const toolEvents = useMemo(() => stableEvents.filter((e) => e.kind === 'tool').slice(-10), [stableEvents]);
  const thinkingEvents = useMemo(() => stableEvents.filter((e) => e.kind === 'status'), [stableEvents]);
  const recentEvents = useMemo(() => stableEvents.slice(-20), [stableEvents]);
  const latestEvent = recentEvents[recentEvents.length - 1];

  // Read-only from auditStore — use getState() to avoid subscription loop
  const auditEntries = useMemo(() => {
    try { return useAuditStore.getState().getBySession(session?.id ?? '').slice(0, 20); } catch { return []; }
  }, [session?.id]);

  if (collapsed) {
    return (
      <div style={{ width: 32, borderLeft: '1px solid var(--cc-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
        <button onClick={onToggleCollapse} style={collapseBtnStyle}>&#x25C0;</button>
        {session && <CcStatusDot status={session.status === 'running' ? 'running' : 'idle'} size={8} pulse={session.status === 'running'} />}
      </div>
    );
  }

  if (!session) {
    return (
      <div data-testid="inspector-panel" style={{ width, flexShrink: 0, borderLeft: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', background: 'var(--cc-surface-solid)' }}>
        <Header onToggle={onToggleCollapse} onExpand={onToggleExpand} expanded={expanded} title={t('sessionInspector.title')} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CcEmptyState icon="🔍" title={t('sessionInspector.noActiveSession')} description={t('sessionInspector.noActiveSessionDesc')} />
        </div>
      </div>
    );
  }

  const isRunning = session.status === 'running' || session.status === 'starting';
  const contextRatio = session.inputTokens > 0 ? Math.round((session.outputTokens / session.inputTokens) * 100) : 0;

  return (
    <div data-testid="inspector-panel" style={{ width, flexShrink: 0, borderLeft: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cc-surface-solid)' }}>
      <Header onToggle={onToggleCollapse} onExpand={onToggleExpand} expanded={expanded} title={t('sessionInspector.title')} />

      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Statusline */}
        <div style={statuslineStyle}>
          <CcStatusDot status={isRunning ? 'running' : 'idle'} size={7} pulse={isRunning} />
          <span style={{ fontWeight: 600, color: 'var(--cc-text)' }}>{session.model}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-text-muted)' }}>{session.permissionMode}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-blue)' }}>&darr;{fmtNum(session.inputTokens)}</span>
          <span style={{ color: 'var(--cc-green)' }}>&uarr;{fmtNum(session.outputTokens)}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-amber)' }}>${session.totalCostUsd.toFixed(4)}</span>
        </div>

        <Card><CardTitle>{t('sessionInspector.session')}</CardTitle>
          <FieldGrid>
            <F label={t('session.status')} value={session.status} />
            <F label={t('session.mode')} value={session.runtimeMode} />
            <F label={t('session.model')} value={session.model} />
            <F label={t('session.permission')} value={session.permissionMode} />
            {session.effort && <F label={t('session.effort')} value={session.effort} />}
          </FieldGrid>
        </Card>

        <Card><CardTitle>{t('sessionInspector.realTimeMetrics')}</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
            <M label={t('session.inputTokens')} value={fmtNum(session.inputTokens)} unit={t('sessionInspector.tokens')} color="var(--cc-blue)" />
            <M label={t('session.outputTokens')} value={fmtNum(session.outputTokens)} unit={t('sessionInspector.tokens')} color="var(--cc-green)" />
            <M label={t('sessionInspector.cost')} value={`$${session.totalCostUsd.toFixed(4)}`} unit="" color="var(--cc-amber)" />
            <M label={t('sessionInspector.files')} value={session.fileChangeCount} unit="" color="var(--cc-purple)" />
            <M label={t('sessionInspector.risks')} value={session.riskCount} unit="" color="var(--cc-red)" />
            <M label={t('sessionInspector.audit')} value={session.auditCount} unit="" color="var(--cc-text-muted)" />
          </div>
        </Card>

        <Card><CardTitle>{t('session.cwd')}</CardTitle>
          <div style={{ fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text-muted)', wordBreak: 'break-all' }}>{session.cwd}</div>
        </Card>

        {expanded && toolEvents.length > 0 && (
          <Card><CardTitle>&#x1F527; {t('sessionInspector.liveFlow')}</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {toolEvents.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--cc-font-xs)', padding: '2px 4px', borderRadius: 'var(--cc-radius-xs)', background: 'var(--cc-bg)' }}>
                  <CcBadge variant="info">{e.kind}</CcBadge>
                  <span style={{ color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blockSummary(e)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {expanded && thinkingEvents.length > 0 && (
          <Card><CardTitle>&#x1F9E0; {t('sessionInspector.thinking')}</CardTitle>
            <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontStyle: 'italic' }}>
              {thinkingEvents.length} {t('sessionInspector.thinkingEventCount')} &middot; {fmtDate(thinkingEvents[thinkingEvents.length - 1].createdAt)}
            </div>
          </Card>
        )}

        {expanded && (
          <Card><CardTitle>{t('sessionInspector.context')}</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', width: 50 }}>Input</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--cc-bg-muted)', overflow: 'hidden' }}><div style={{ width: '100%', height: '100%', borderRadius: 4, background: 'var(--cc-blue)' }} /></div>
                <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text)', fontWeight: 600 }}>{fmtNum(session.inputTokens)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', width: 50 }}>Output</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--cc-bg-muted)', overflow: 'hidden' }}><div style={{ width: Math.min(contextRatio, 100) + '%', height: '100%', borderRadius: 4, background: 'var(--cc-green)' }} /></div>
                <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text)', fontWeight: 600 }}>{fmtNum(session.outputTokens)}</span>
              </div>
              <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', textAlign: 'center', marginTop: 2 }}>{t('sessionInspector.outputInputRatio')}: {contextRatio}%</div>
            </div>
          </Card>
        )}

        <Card><CardTitle>{t('sessionInspector.timeline')}</CardTitle>
          <FieldGrid>
            <F label={t('session.createdAt')} value={fmtDate(session.createdAt)} />
            {session.startedAt && <F label={t('session.startedAt')} value={fmtDate(session.startedAt)} />}
            {session.endedAt && <F label={t('session.endedAt')} value={fmtDate(session.endedAt)} />}
            <F label={t('session.updated')} value={fmtDate(session.updatedAt)} />
          </FieldGrid>
        </Card>

        {session.summary && <Card><CardTitle>{t('session.summary')}</CardTitle><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', lineHeight: 1.5 }}>{session.summary}</div></Card>}

        {expanded && latestEvent && (
          <Card><CardTitle>&#x1F4CB; {t('sessionInspector.rawPayload')}</CardTitle>
            <pre style={{ fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text-muted)', maxHeight: 120, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(latestEvent, null, 2).slice(0, 500)}</pre>
          </Card>
        )}

        {expanded && auditEntries.length > 0 && (
          <Card><CardTitle>{t('sessionInspector.audit')}</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 150, overflow: 'auto' }}>
              {auditEntries.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 'var(--cc-radius-xs)', background: e.level === 'critical' ? 'var(--cc-bg-danger-soft)' : 'var(--cc-bg)', fontSize: 'var(--cc-font-xs)' }}>
                  <CcBadge variant={e.level === 'critical' ? 'danger' : e.level === 'warning' ? 'warning' : 'default'}>{e.level}</CcBadge>
                  <span style={{ color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message}</span>
                  <span style={{ color: 'var(--cc-text-muted)' }}>{e.timestamp.slice(11, 19)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Header({ onToggle, onExpand, expanded, title }: { onToggle: () => void; onExpand: () => void; expanded: boolean; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--cc-border)', minHeight: 32 }}>
      <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)' }}>&#x1F4CA; {title}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onExpand} style={{ ...collapseBtnStyle, fontSize: 'var(--cc-font-xs)' }}>{expanded ? '⊟' : '⊞'}</button>
        <button onClick={onToggle} style={collapseBtnStyle}>&#x25B6;</button>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 8, borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', border: '1px solid var(--cc-border-muted)' }}>{children}</div>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 4 }}>{children}</div>;
}
function M({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return <div><div style={{ fontSize: 'var(--cc-font-md)', fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)' }}>{unit}</div><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{label}</div></div>;
}
function F({ label, value }: { label: string; value: string }) {
  return <div><span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)' }}>{label}</span><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text)' }}>{value}</div></div>;
}
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>{children}</div>;
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString(navigator.language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
function fmtNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function blockSummary(b: ChatBlock): string {
  if (b.kind === 'tool') return b.name;
  if (b.kind === 'status') return b.label;
  if (b.kind === 'thinking') return b.content.slice(0, 60);
  if (b.kind === 'permission') return b.rule;
  if (b.kind === 'file_change') return `${b.action}: ${b.path}`;
  return b.content.slice(0, 60);
}

const statuslineStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-muted)', border: '1px solid var(--cc-border)', fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)' };
const collapseBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', padding: 0 };
