import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import type { Session } from '../../types';

interface Props {
  session: Session | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SessionInspector({ session, collapsed, onToggleCollapse }: Props) {
  if (collapsed) {
    return (
      <div style={{ width: 32, borderLeft: '1px solid var(--cc-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
        <button onClick={onToggleCollapse} style={collapseBtnStyle}>◀</button>
        {session && <CcStatusDot status={session.status === 'running' ? 'running' : 'idle'} size={8} pulse={session.status === 'running'} />}
      </div>
    );
  }

  if (!session) {
    return (
      <div data-testid="inspector-panel" style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', background: 'var(--cc-surface-solid)' }}>
        <Header onToggle={onToggleCollapse} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CcEmptyState icon="🔍" title="无活跃会话" description="打开会话后实时监控" />
        </div>
      </div>
    );
  }

  const isRunning = session.status === 'running' || session.status === 'starting';

  return (
    <div data-testid="inspector-panel" style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--cc-surface-solid)' }}>
      <Header onToggle={onToggleCollapse} />

      <div style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Statusline — Claude Code style */}
        <div style={statuslineStyle}>
          <CcStatusDot status={isRunning ? 'running' : 'idle'} size={7} pulse={isRunning} />
          <span style={{ fontWeight: 600, color: 'var(--cc-text)' }}>{session.model}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-text-muted)' }}>{session.permissionMode}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-blue)' }}>↓{fmtNum(session.inputTokens)}</span>
          <span style={{ color: 'var(--cc-green)' }}>↑{fmtNum(session.outputTokens)}</span>
          <span style={{ color: 'var(--cc-text-soft)' }}>|</span>
          <span style={{ color: 'var(--cc-amber)' }}>${session.totalCostUsd.toFixed(4)}</span>
        </div>

        {/* Session info */}
        <Card>
          <CardTitle>会话</CardTitle>
          <FieldGrid>
            <F label="状态" value={session.status} />
            <F label="模式" value={session.runtimeMode} />
            <F label="模型" value={session.model} />
            <F label="权限" value={session.permissionMode} />
            {session.effort && <F label="Effort" value={session.effort} />}
          </FieldGrid>
        </Card>

        {/* Metrics */}
        <Card>
          <CardTitle>实时指标</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, textAlign: 'center' }}>
            <M label="输入" value={fmtNum(session.inputTokens)} unit="tokens" color="var(--cc-blue)" />
            <M label="输出" value={fmtNum(session.outputTokens)} unit="tokens" color="var(--cc-green)" />
            <M label="费用" value={`$${session.totalCostUsd.toFixed(4)}`} unit="" color="var(--cc-amber)" />
            <M label="文件" value={session.fileChangeCount} unit="个" color="var(--cc-purple)" />
            <M label="风险" value={session.riskCount} unit="" color="var(--cc-red)" />
            <M label="审计" value={session.auditCount} unit="条" color="var(--cc-text-muted)" />
          </div>
        </Card>

        {/* CWD */}
        <Card>
          <CardTitle>工作目录</CardTitle>
          <div style={{ fontSize: 11, fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text-muted)', wordBreak: 'break-all' }}>{session.cwd}</div>
        </Card>

        {/* Timeline */}
        <Card>
          <CardTitle>时间线</CardTitle>
          <FieldGrid>
            <F label="创建" value={fmtDate(session.createdAt)} />
            {session.startedAt && <F label="启动" value={fmtDate(session.startedAt)} />}
            {session.endedAt && <F label="结束" value={fmtDate(session.endedAt)} />}
            <F label="更新" value={fmtDate(session.updatedAt)} />
          </FieldGrid>
        </Card>

        {/* Summary */}
        {session.summary && (
          <Card>
            <CardTitle>摘要</CardTitle>
            <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', lineHeight: 1.5 }}>{session.summary}</div>
          </Card>
        )}

        {session.claudeSessionId && (
          <Card>
            <CardTitle>Claude Session ID</CardTitle>
            <div style={{ fontSize: 10, fontFamily: 'var(--cc-font-mono)', color: 'var(--cc-text-soft)', wordBreak: 'break-all' }}>{session.claudeSessionId}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Header({ onToggle }: { onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--cc-border)', minHeight: 32 }}>
      <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)' }}>📊 实时监控</span>
      <button onClick={onToggle} style={collapseBtnStyle}>▶</button>
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
  return (
    <div>
      <div style={{ fontSize: 'var(--cc-font-md)', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--cc-text-soft)' }}>{unit}</div>
      <div style={{ fontSize: 10, color: 'var(--cc-text-muted)' }}>{label}</div>
    </div>
  );
}
function F({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 10, color: 'var(--cc-text-soft)' }}>{label}</span>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text)' }}>{value}</div>
    </div>
  );
}
function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 10px' }}>{children}</div>;
}
function fmtDate(iso: string) { try { return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; } }
function fmtNum(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

const statuslineStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
  borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg-muted)', border: '1px solid var(--cc-border)',
  fontSize: 'var(--cc-font-xs)', fontFamily: 'var(--cc-font-mono)',
};
const collapseBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--cc-text-muted)', padding: 0 };
