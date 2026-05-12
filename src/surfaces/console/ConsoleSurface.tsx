import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { invokeCommand } from '../../services/invokeCommand';
import { CcButton } from '../../components/ui/CcButton';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import { CcCard } from '../../components/ui/CcCard';
import { CcBadge } from '../../components/ui/CcBadge';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';

interface Capability { version: string | null; exists: boolean; authStatus: string | null; supportsStreamJson: boolean; checkedAt: string; errors: string[]; }

export function ConsoleSurface() {
  useRenderLoopGuard('ConsoleSurface');
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const projects = useProjectStore((s) => s.projects);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  const [cap, setCap] = useState<Capability | null>(null);
  const [capLoading, setCapLoading] = useState(true);
  const running = sessions.filter((s) => s.status === 'running' || s.status === 'starting').length;
  const today = sessions.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString());
  const costToday = today.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0);
  const totalTokens = sessions.reduce((s, v) => s + v.inputTokens + v.outputTokens, 0);
  const hour = new Date().getHours();
  const greetKey = hour < 6 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 14 ? 'greeting.afternoon' : hour < 18 ? 'greeting.evening' : 'greeting.night';
  const recent = sessions.slice(-6).reverse();

  useEffect(() => {
    const cached = localStorage.getItem('ctrl-cc-capability');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.data) { setCap(parsed.data); setCapLoading(false); return; }
      } catch {}
    }
    invokeCommand<Capability>('claude_check_capability')
      .then((c) => { setCap(c); localStorage.setItem('ctrl-cc-capability', JSON.stringify({ data: c, checkedAt: new Date().toISOString() })); })
      .catch(() => setCap({ version: null, exists: false, authStatus: null, supportsStreamJson: false, checkedAt: new Date().toISOString(), errors: ['Detection failed'] }))
      .finally(() => setCapLoading(false));
  }, []);

  const openWorkspace = (sid: string) => { const s = sessions.find((x) => x.id === sid); if (s) { openSession({ sessionId: s.id, projectId: s.projectId, projectName: s.title, title: s.title, status: s.status, viewMode: 'chat', pendingConfirms: 0, riskCount: s.riskCount, isPinned: false }); navigateTo('workspace'); } };

  return (
    <div data-testid="surface-console" style={{ padding: '28px 36px', maxWidth: 960, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'var(--cc-font-3xl)', fontWeight: 700, color: 'var(--cc-text)', marginBottom: 4 }}>{t(greetKey)}, {t('greeting.developer')}</h1>
        <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-soft)' }}>{t('console.subtitle')}</p>
        <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{t('console.footer')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
        <Stat title={t('console.running')} value={running} color="var(--cc-green)" sub={`${sessions.length} ${t('console.totalSessions')}`} />
        <Stat title={t('console.projects')} value={projects.filter((p) => p.activeSessionCount > 0).length} color="var(--cc-blue)" sub={`${projects.length} ${t('console.total')}`} />
        <Stat title={t('console.costToday')} value={'$' + costToday.toFixed(3)} color="var(--cc-amber)" sub={`${today.length} ${t('console.sessionsToday')}`} />
        <Stat title={t('console.claudeCli')} value={capLoading ? '...' : cap?.exists ? cap?.version || 'OK' : 'N/A'} color={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} sub={cap?.authStatus || t('common.unknown')} />
        <Stat title={t('console.totalTokens')} value={totalTokens >= 1000 ? (totalTokens / 1000).toFixed(1) + 'k' : String(totalTokens)} color="var(--cc-text)" sub={t('console.tokensDesc')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <CcCard style={{ padding: 14 }}><h3 style={st}>{t('console.architecture')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--cc-font-xs)' }}>
            <Plane label={t('console.planeInteraction')} pct={90} color="var(--cc-green)" desc={t('console.planeInteractionDesc')} />
            <Plane label={t('console.planeControl')} pct={80} color="var(--cc-blue)" desc={t('console.planeControlDesc')} />
            <Plane label={t('console.planeTelemetry')} pct={35} color="var(--cc-amber)" desc={t('console.planeTelemetryDesc')} />
            <Plane label={t('console.planeGovernance')} pct={5} color="var(--cc-red)" desc={t('console.planeGovernanceDesc')} />
          </div>
        </CcCard>
        <CcCard style={{ padding: 14 }}><h3 style={st}>{t('console.environment')}</h3>
          {capLoading ? <div style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>{t('common.detecting')}</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--cc-font-xs)' }}>
              <E label={t('console.claudeCli')} value={cap?.exists ? cap?.version || String(t('common.installed')) : String(t('common.notDetected'))} c={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} />
              <E label={t('console.authStatus')} value={cap?.authStatus || String(t('common.unknown'))} c={cap?.authStatus === 'authenticated' ? 'var(--cc-green)' : 'var(--cc-amber)'} />
              <E label={t('console.streamJson')} value={cap?.supportsStreamJson ? String(t('common.supported')) : String(t('common.unknown'))} />
              <E label={t('console.frontend')} value={t('console.techFrontend')} />
              <E label={t('console.backend')} value={t('console.techBackend')} />
              <E label={t('console.terminal')} value={t('console.techTerminal')} />
              <E label={t('console.db')} value={t('console.techDb')} />
            </div>}
        </CcCard>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
        <CcButton variant="primary" onClick={() => navigateTo('workspace')}>{t('nav.workspace')}</CcButton>
        <CcButton onClick={() => navigateTo('projects')}>{t('nav.projects')}</CcButton>
        <CcButton onClick={() => navigateTo('resources')}>{t('nav.resources')}</CcButton>
        <CcButton variant="ghost" onClick={() => navigateTo('settings')}>{t('nav.settings')}</CcButton>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><h3 style={st}>{t('console.recentSessions')}</h3>{sessions.length > 6 && <CcButton size="sm" variant="ghost" onClick={() => navigateTo('projects')}>{t('console.viewAll')}</CcButton>}</div>
        {recent.length === 0 ? <CcCard style={{ textAlign: 'center', padding: 16 }}><span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>{t('console.noSessions')}</span></CcCard> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {recent.map((s) => (
              <div key={s.id} onClick={() => openWorkspace(s.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', cursor: 'pointer', fontSize: 'var(--cc-font-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CcStatusDot status={s.status === 'running' ? 'running' : s.status === 'failed' ? 'error' : 'idle'} size={6} pulse={s.status === 'running'} />
                  <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>{s.title}</span>
                  <CcBadge variant={s.runtimeMode === 'pty-interactive' ? 'info' : 'default'}>{s.runtimeMode === 'pty-interactive' ? 'PTY' : 'CLI'}</CcBadge>
                </div>
                <div style={{ display: 'flex', gap: 10, color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-xs)' }}>
                  <span>{s.model}</span><span>{'$' + s.totalCostUsd.toFixed(3)}</span><span>{fmtDate(s.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>}
      </div>

      <div style={{ borderTop: '1px solid var(--cc-border)', paddingTop: 12, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
        {t('console.footer')}
      </div>
    </div>
  );
}
function Stat({ title, value, color, sub }: { title: string; value: string | number; color: string; sub: string }) { return <div style={{ padding: '12px 14px', borderRadius: 'var(--cc-radius-lg)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)' }}><div style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)', marginTop: 2 }}>{title}</div><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginTop: 2 }}>{sub}</div></div>; }
function Plane({ label, pct, color, desc }: { label: string; pct: number; color: string; desc: string }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--cc-text-soft)', width: 80, fontSize: 'var(--cc-font-2xs)' }}>{label}</span><div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--cc-bg-muted)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: color }} /></div><span style={{ color, fontWeight: 600, fontSize: 'var(--cc-font-2xs)', width: 30 }}>{pct}%</span><span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-3xs)', flex: 1 }}>{desc}</span></div>; }
function E({ label, value, c }: { label: string; value: string; c?: string }) { return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--cc-text-soft)' }}>{label}</span><span style={{ color: c || 'var(--cc-text)', fontWeight: 500 }}>{value}</span></div>; }
const st: React.CSSProperties = { fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 };
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
