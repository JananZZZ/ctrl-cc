import { useSessionStore } from '../../stores/sessionStore';
import { useSurfaceStore } from '../../stores/surfaceStore';
import { CcButton } from '../../components/ui/CcButton';

export function ConsoleSurface() {
  const sessions = useSessionStore((s) => s.sessions);
  const runningCount = sessions.filter((s) => s.status === 'running').length;
  const { navigateTo } = useSurfaceStore();
  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

  return (
    <div data-testid="surface-console" style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 'var(--cc-font-3xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>{greet}，开发者</h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 32 }}>Ctrl-CC AI Coding Control Plane — PTY + Stream-JSON 双轨制已就绪</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="运行中会话" value={runningCount} color="var(--cc-green)" />
        <StatCard label="总会话" value={sessions.length} color="var(--cc-text)" />
        <StatCard label="Runtime" value="PTY + Stream-JSON" color="var(--cc-blue)" />
        <StatCard label="Claude CLI" value="已连接" color="var(--cc-purple)" />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
        <CcButton variant="primary" onClick={() => navigateTo('workspace')}>💬 开始对话</CcButton>
        <CcButton onClick={() => navigateTo('projects')}>📁 项目管理</CcButton>
        <CcButton onClick={() => navigateTo('resources')}>📦 资源管理</CcButton>
        <CcButton variant="ghost" onClick={() => navigateTo('settings')}>⚙️ 设置</CcButton>
      </div>

      {sessions.length > 0 && (
        <div>
          <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>最近会话</h3>
          {sessions.slice(-5).reverse().map((s) => (
            <div key={s.id} style={{ padding: '6px 12px', borderBottom: '1px solid var(--cc-border-muted)', fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.title}</span>
              <span>{s.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ padding: '14px 18px', borderRadius: 'var(--cc-radius-lg)', background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)', boxShadow: 'var(--cc-shadow-card)' }}>
      <div style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
