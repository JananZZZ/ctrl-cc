import { CcEmptyState } from '../../components/ui/CcEmptyState';

export function CanvasSurface() {
  return (
    <div data-testid="surface-canvas" style={{ padding: '40px 32px' }}>
      <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>
        无限画布
      </h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 24 }}>
        项目 / 会话 / 风险 / 资源节点可视化 — 当前模块尚未接入真实数据
      </p>
      <CcEmptyState icon="🎨" title="Canvas Surface 将在 Stage 4 实现" description="只做可视化与导航跳转，不自动执行工作流" />
    </div>
  );
}
