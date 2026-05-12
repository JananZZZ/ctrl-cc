import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { CcStatusDot } from '../ui/CcStatusDot';

interface AIDockProps { onOpenErrorLog?: () => void; errorCount?: number; }

export function AIDock({ onOpenErrorLog, errorCount = 0 }: AIDockProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'quiet' | 'calm' | 'focus'>('quiet');
  const sessions = useSessionStore((s) => s.sessions);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  const running = sessions.filter((s) => s.status === 'running' || s.status === 'starting');
  const risks = sessions.reduce((s, v) => s + v.riskCount, 0);
  const cost = sessions.reduce((s, v) => s + v.totalCostUsd, 0);

  useEffect(() => {
    if (running.length === 0) setMode('quiet');
  }, [running.length]);

  const openWs = (sid: string) => { const s = sessions.find((x) => x.id === sid); if (s) { openSession({ sessionId: s.id, projectId: s.projectId, projectName: s.title, title: s.title, status: s.status, viewMode: 'chat', pendingConfirms: 0, riskCount: s.riskCount, isPinned: false }); navigateTo('workspace'); } };

  const w = mode === 'focus' ? 240 : 44;
  return (
    <div style={{ ...ds, width: w, transition: 'width 0.25s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 6 }}>
        <button onClick={() => setMode(mode === 'quiet' ? 'calm' : mode === 'calm' ? 'focus' : 'quiet')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-2xs)', color: 'var(--cc-text-muted)', padding: 2, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }} title={mode === 'quiet' ? t('dock.expand') : mode === 'calm' ? t('dock.focus') : t('dock.collapse')}>{mode === 'quiet' ? '<' : mode === 'calm' ? '>' : 'x'}</button>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: running.length > 0 ? 'var(--cc-green)' : 'var(--cc-text-muted)', transition: 'background 0.3s' }} />
        {onOpenErrorLog && (
          <button onClick={onOpenErrorLog} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', padding: 2, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, position: 'relative' }} title={t('errorLog.title')}>
            🔔
            {errorCount > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7, background: 'var(--cc-red)', color: 'var(--cc-text-on-accent)', fontSize: 'var(--cc-font-3xs)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {errorCount > 9 ? '!' : errorCount}
              </span>
            )}
          </button>
        )}
        {(mode === 'calm' || mode === 'focus') && <span style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-text-muted)', fontWeight: 600 }}>{running.length} {t('dock.running')}</span>}
        {risks > 0 && (mode === 'calm' || mode === 'focus') && <span style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-red)', fontWeight: 600 }}>{risks} {t('dock.risks')}</span>}
        {(mode === 'calm' || mode === 'focus') && <span style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-amber)' }}>{'$' + cost.toFixed(2)}</span>}
      </div>
      {(mode === 'calm' || mode === 'focus') && (
        <div style={{ flex: 1, overflow: 'auto', padding: 4, opacity: 1, transition: 'opacity 0.3s' }}>
          <div style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-text-soft)', fontWeight: 600, padding: '2px 4px' }}>{t('dock.active')}</div>
          {running.map((s) => (
            <div key={s.id} onClick={() => openWs(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 4px', borderRadius: 'var(--cc-radius-xs)', cursor: 'pointer', fontSize: 'var(--cc-font-3xs)', marginBottom: 1 }}>
              <CcStatusDot status="running" size={4} pulse /><span style={{ color: 'var(--cc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{s.title}</span>
            </div>
          ))}
          {running.length === 0 && <div style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-text-muted)', padding: '4px 6px', fontStyle: 'italic' }}>{t('dock.noActive')}</div>}
        </div>
      )}
    </div>
  );
}
const ds: React.CSSProperties = { position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)', height: '50vh', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', borderRight: 'none', borderRadius: 'var(--cc-radius-lg) 0 0 var(--cc-radius-lg)', display: 'flex', flexDirection: 'column', zIndex: 500, boxShadow: 'var(--cc-shadow-floating)' };
