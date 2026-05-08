import { CcEmptyState } from '../../components/ui/CcEmptyState';

export function GitHubSurface() {
  return (
    <div data-testid="surface-github" style={{ padding: '40px 32px' }}>
      <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 8 }}>
        GitHub
      </h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 24 }}>
        安全 WebView + 项目 GitHub 仓库映射 — 当前模块尚未接入真实数据
      </p>
      <CcEmptyState icon="🔗" title="GitHub Surface 将在 Stage 4 实现" description="只做安全 WebView 和项目 repo/PR/Issue 映射，不读取 token/cookie" />
    </div>
  );
}
