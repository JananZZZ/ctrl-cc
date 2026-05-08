import { CcEmptyState } from '../../components/ui/CcEmptyState';

export function SettingsSurface() {
  return (
    <div data-testid="surface-settings" style={{ padding: '40px 32px' }}>
      <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>
        设置
      </h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 24 }}>
        环境检测、Runtime、外观、安全、诊断 — 当前模块尚未接入真实数据
      </p>
      <CcEmptyState icon="⚙️" title="Settings Surface 将在 Stage 4 完整实现" description="首次引导、环境健康检测、PTY Runtime 配置、AutoTrust 安全策略" />
    </div>
  );
}
