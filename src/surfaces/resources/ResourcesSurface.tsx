import { CcEmptyState } from '../../components/ui/CcEmptyState';

export function ResourcesSurface() {
  return (
    <div data-testid="surface-resources" style={{ padding: '40px 32px' }}>
      <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>
        资源区
      </h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 24 }}>
        Skills / Agents / MCP / Hooks / Plugins — 当前模块尚未接入真实数据
      </p>
      <CcEmptyState icon="📦" title="Resources Surface 将在 Stage 4 接入真实数据" description="管理所有 Claude Code 资源，包括 CLAUDE.md、Memory、Slash Commands、Permission Rules" />
    </div>
  );
}
