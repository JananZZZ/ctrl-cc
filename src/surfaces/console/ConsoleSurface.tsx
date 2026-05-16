import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '../../stores/sessionStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { useOpenSessionStore } from '../../stores/openSessionStore';
import { useRuntimeStore } from '../../features/runtime/stores/runtimeStore';
import { useRuntimeTraceStore } from '../../features/runtime/stores/runtimeTraceStore';
import { useEnvironmentStore } from '../../features/environment/stores/environmentStore';
import { useSetupStore } from '../../features/setup/stores/setupStore';
import { useRuntimeKernelStore } from '../../runtime-kernel/runtimeKernelStore';
import { CcButton } from '../../components/ui/CcButton';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import { CcCard } from '../../components/ui/CcCard';
import { CcBadge } from '../../components/ui/CcBadge';
import { SurfacePage } from '../../components/layout/SurfacePage';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import './console-surface.css';

export function ConsoleSurface() {
  useRenderLoopGuard('ConsoleSurface');
  const { t } = useTranslation();
  const sessions = useSessionStore((s) => s.sessions);
  const projects = useProjectStore((s) => s.projects);
  const { navigateTo } = useSurfaceStore();
  const { openSession } = useOpenSessionStore();
  const runtimeSessions = useRuntimeStore((s) => s.sessions);
  const traceEvents = useRuntimeTraceStore((s) => s.events);
  const running = sessions.filter((s) => s.status === 'running' || s.status === 'starting').length;
  const today = sessions.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString());
  const costToday = today.reduce((sum, s) => sum + (s.totalCostUsd || 0), 0);
  const totalTokens = sessions.reduce((s, v) => s + v.inputTokens + v.outputTokens, 0);
  const hour = new Date().getHours();
  const greetKey = hour < 6 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 14 ? 'greeting.afternoon' : hour < 18 ? 'greeting.evening' : 'greeting.night';
  const recent = sessions.slice(-6).reverse();

  // Runtime health: count sessions with active PTY connections
  const runtimeActiveCount = Object.values(runtimeSessions).filter(s => s.ptySessionId).length;
  const runtimeHealthyCount = Object.values(runtimeSessions).filter(s => s.status === 'claude-active' || s.status === 'pty-ready').length;
  const traceErrorCount = traceEvents.filter(e => e.level === 'error').length;
  const traceWarningCount = traceEvents.filter(e => e.level === 'warning').length;

  // v26.0: RuntimeKernel health
  const kernelSessions = useRuntimeKernelStore((s) => s.sessions);
  const kernelSessionCount = Object.keys(kernelSessions).length;
  const kernelActiveCount = Object.values(kernelSessions).filter(
    s => s.hasWriter && s.readerAlive && !['failed', 'exited', 'stopped'].includes(String(s.status))
  ).length;
  const kernelErrorCount = Object.values(kernelSessions).filter(
    s => s.status === 'failed' || s.lastError
  ).length;
  const kernelOk = kernelErrorCount === 0;

  const envSnapshot = useEnvironmentStore((s) => s.snapshot);
  const envLoading = useEnvironmentStore((s) => s.loading);
  const refreshEnv = useEnvironmentStore((s) => s.refresh);
  const loadCachedEnv = useEnvironmentStore((s) => s.loadCached);

  useEffect(() => {
    loadCachedEnv();
  }, [loadCachedEnv]);

  const cap = envSnapshot?.capability ?? null;
  const hasEnvInfo = Boolean(envSnapshot);
  const selectedLaunchPlan = envSnapshot?.launchPlans?.find((p) => p.selected);

  const openWorkspace = (sid: string) => { const s = sessions.find((x) => x.id === sid); if (s) { openSession({ sessionId: s.id, projectId: s.projectId, projectName: s.title, title: s.title, status: s.status, viewMode: 'chat', pendingConfirms: 0, riskCount: s.riskCount, isPinned: false }); navigateTo('workspace'); } };

  // v23.0: Setup environment incomplete banner
  const setupSnapshot = useSetupStore((s) => s.snapshot);
  const setupDismissedUntil = useSetupStore((s) => s.dismissedUntil);
  const setupDismiss = useSetupStore((s) => s.dismissBanner);
  const showSetupBanner = setupSnapshot && !setupSnapshot.ready
    && (!setupDismissedUntil || Date.now() > setupDismissedUntil);

  return (
    <SurfacePage variant="dashboard" testId="surface-console">
      <div className="console-page">

      {showSetupBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '10px 16px', marginBottom: 16,
          borderRadius: 'var(--cc-radius-md)',
          background: 'var(--cc-amber-soft)', border: '1px solid var(--cc-amber)',
          fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)',
        }}>
          <span style={{ fontWeight: 600, color: 'var(--cc-amber)' }}>⚠️ Claude Code CLI 环境未完成</span>
          <span style={{ color: 'var(--cc-text-muted)', flex: 1 }}>Chat / Terminal 可能不可用。</span>
          <CcButton size="sm" variant="primary" onClick={() => {
            useSurfaceStore.getState().navigateTo('settings');
          }}>立即配置</CcButton>
          <CcButton size="sm" variant="ghost" onClick={() => {
            useSetupStore.getState().detectAll().catch(() => {});
          }}>重新检测</CcButton>
          <CcButton size="sm" variant="ghost" onClick={setupDismiss}>今天不再提醒</CcButton>
        </div>
      )}

      <div className="cc-hero">
        <div>
          <h1 style={{ fontSize: 'var(--cc-font-3xl)', fontWeight: 700, color: 'var(--cc-text)', marginBottom: 4 }}>{t(greetKey)}, {t('greeting.developer')}</h1>
          <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-soft)' }}>{t('console.subtitle')}</p>
          <p style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{t('console.footer')}</p>
        </div>
      </div>

      <div className="console-stat-grid">
        <Stat title={t('console.running')} value={running} color="var(--cc-green)" sub={`${sessions.length} ${t('console.totalSessions')}`} />
        <Stat title={t('console.projects')} value={projects.filter((p) => p.activeSessionCount > 0).length} color="var(--cc-blue)" sub={`${projects.length} ${t('console.total')}`} />
        <Stat title={t('console.costToday')} value={'$' + costToday.toFixed(3)} color="var(--cc-amber)" sub={`${today.length} ${t('console.sessionsToday')}`} />
        <Stat title={t('console.claudeCli')} value={envLoading ? '...' : cap?.exists ? cap?.version || 'OK' : 'N/A'} color={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} sub={cap?.authStatus || t('common.unknown')} />
        <Stat title={t('console.totalTokens')} value={totalTokens >= 1000 ? (totalTokens / 1000).toFixed(1) + 'k' : String(totalTokens)} color="var(--cc-text)" sub={t('console.tokensDesc')} />
      </div>

      {/* Runtime Health Strip — v10 Mission Control */}
      <div style={{
        display: 'flex', gap: 12, padding: '10px 14px', marginBottom: 16,
        borderRadius: 'var(--cc-radius-md)', background: 'var(--cc-surface-solid)',
        border: '1px solid var(--cc-border)', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text-soft)', marginRight: 4 }}>{t('console.runtimeHealth')}:</span>
        <HealthDot label="PTY" ok={runtimeActiveCount > 0} detail={String(runtimeActiveCount)} />
        <HealthDot label="Claude" ok={runtimeHealthyCount > 0} detail={String(runtimeHealthyCount)} />
        <HealthDot label={t('console.errors')} ok={traceErrorCount === 0} detail={String(traceErrorCount)} color="var(--cc-red)" />
        <HealthDot label={t('console.warnings')} ok={traceWarningCount < 5} detail={String(traceWarningCount)} color="var(--cc-amber)" />
        <HealthDot label="Kernel" ok={kernelOk} detail={kernelOk ? 'OK' : String(kernelErrorCount)} />
        <HealthDot label="Bridge" ok={true} detail="OK" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 'var(--cc-font-3xs)', color: 'var(--cc-text-muted)' }}>RuntimeKernel v26 · persistent-pty · {kernelActiveCount}/{kernelSessionCount} active</span>
      </div>

      <div className="console-two-col">
        <CcCard className="cc-section-card console-card"><h3 style={st}>{t('console.architecture')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 'var(--cc-font-xs)' }}>
            <Plane label={t('console.planeInteraction')} pct={90} color="var(--cc-green)" desc={t('console.planeInteractionDesc')} />
            <Plane label={t('console.planeControl')} pct={80} color="var(--cc-blue)" desc={t('console.planeControlDesc')} />
            <Plane label={t('console.planeTelemetry')} pct={35} color="var(--cc-amber)" desc={t('console.planeTelemetryDesc')} />
            <Plane label={t('console.planeGovernance')} pct={5} color="var(--cc-red)" desc={t('console.planeGovernanceDesc')} />
          </div>
        </CcCard>
        <CcCard className="cc-section-card console-card">
          <div className="cc-card-header">
            <h3 style={st}>{t('console.environment')}</h3>
            <CcButton size="sm" variant="ghost" onClick={() => void refreshEnv()} disabled={envLoading}>
              {envLoading ? t('common.detecting') : hasEnvInfo ? '刷新环境配置' : '检测环境配置'}
            </CcButton>
          </div>

          {!hasEnvInfo ? (
            <div className="cc-empty-hint">
              尚未检测环境配置。点击右上角按钮检查 Claude CLI、LaunchPlan、Node.js 与认证状态。
            </div>
          ) : (
            <div className="console-env-grid">
              <E label={t('console.claudeCli')} value={cap?.exists ? cap?.version || String(t('common.installed')) : String(t('common.notDetected'))} c={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} />
              <E label={t('console.authStatus')} value={cap?.authStatus || String(t('common.unknown'))} c={cap?.authStatus === 'authenticated' ? 'var(--cc-green)' : 'var(--cc-amber)'} />
              <E label="LaunchPlan" value={selectedLaunchPlan?.id ?? 'not selected'} c={selectedLaunchPlan ? 'var(--cc-green)' : 'var(--cc-red)'} />
              <E label="Claude JS" value={`${envSnapshot?.jsCandidates?.filter((c: { exists: boolean }) => c.exists).length ?? 0} candidates`} />
              <E label={t('console.streamJson')} value={cap?.supportsStreamJson ? String(t('common.supported')) : String(t('common.unknown'))} />
              <E label={t('console.frontend')} value={t('console.techFrontend')} />
              <E label={t('console.backend')} value={t('console.techBackend')} />
              <E label={t('console.terminal')} value={t('console.techTerminal')} />
              <E label={t('console.db')} value={t('console.techDb')} />
            </div>
          )}
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
                  <CcBadge variant={s.runtimeMode === 'pty-interactive' ? 'info' : s.runtimeMode === 'kernel-persistent' ? 'success' : 'default'}>{s.runtimeMode === 'pty-interactive' ? 'PTY' : s.runtimeMode === 'kernel-persistent' ? 'Kernel' : 'CLI'}</CcBadge>
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
    </SurfacePage>
  );
}
function Stat({ title, value, color, sub }: { title: string; value: string | number; color: string; sub: string }) { return <div style={{ padding: '12px 14px', borderRadius: 'var(--cc-radius-lg)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)' }}><div style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 700, color }}>{value}</div><div style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)', marginTop: 2 }}>{title}</div><div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginTop: 2 }}>{sub}</div></div>; }
function Plane({ label, pct, color, desc }: { label: string; pct: number; color: string; desc: string }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: 'var(--cc-text-soft)', width: 80, fontSize: 'var(--cc-font-2xs)' }}>{label}</span><div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--cc-bg-muted)', overflow: 'hidden' }}><div style={{ width: pct + '%', height: '100%', borderRadius: 3, background: color }} /></div><span style={{ color, fontWeight: 600, fontSize: 'var(--cc-font-2xs)', width: 30 }}>{pct}%</span><span style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-3xs)', flex: 1 }}>{desc}</span></div>; }
function E({ label, value, c }: { label: string; value: string; c?: string }) {
  return (
    <>
      <span style={{ color: 'var(--cc-text-soft)' }}>{label}</span>
      <span className="value" style={{ color: c || 'var(--cc-text)', fontWeight: 500 }}>{value}</span>
    </>
  );
}
const st: React.CSSProperties = { fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 };
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
function HealthDot({ label, ok, detail, color }: { label: string; ok: boolean; detail: string; color?: string }) {
  const c = color || (ok ? 'var(--cc-green)' : 'var(--cc-red)');
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--cc-font-2xs)' }}>
    <span style={{ width: 6, height: 6, borderRadius: 3, background: c, flexShrink: 0 }} />
    <span style={{ color: 'var(--cc-text-soft)' }}>{label}</span>
    <span style={{ color: c, fontWeight: 600 }}>{detail}</span>
  </div>;
}
