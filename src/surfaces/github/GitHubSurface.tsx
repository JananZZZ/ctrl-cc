import { useState } from 'react';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcButton } from '../../components/ui/CcButton';

export function GitHubSurface() {
  useRenderLoopGuard('GitHubSurface');
  const [repoUrl, setRepoUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');

  const handleOpenExternal = () => {
    const url = repoUrl || inputUrl;
    if (url) window.open(url, '_blank');
  };

  return (
    <div data-testid="surface-github" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)', flexShrink: 0, alignItems: 'center' }}>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setRepoUrl(inputUrl); }}
          placeholder="https://github.com/owner/repo"
          style={{ flex: 1, padding: '4px 10px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none' }}
        />
        <CcButton variant="primary" size="sm" onClick={() => setRepoUrl(inputUrl)}>Load</CcButton>
        <CcButton variant="ghost" size="sm" onClick={handleOpenExternal}>Open in Browser</CcButton>
      </div>

      {/* Dashboard area — replaces banned iframe */}
      {repoUrl ? (
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <div className="cc-dashboard-grid" style={{ marginBottom: 18 }}>
            <div className="cc-kpi-card">
              <div className="cc-kpi-value">{repoUrl.split('/').slice(-2).join('/')}</div>
              <div className="cc-kpi-label">Repository</div>
              <div className="cc-kpi-sub">Open in browser to view branches, PRs, and issues</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <CcButton variant="primary" onClick={() => window.open(repoUrl, '_blank')}>
              Open Repository
            </CcButton>
            <CcButton variant="ghost" onClick={() => window.open(`${repoUrl}/issues`, '_blank')}>
              Issues
            </CcButton>
            <CcButton variant="ghost" onClick={() => window.open(`${repoUrl}/pulls`, '_blank')}>
              Pull Requests
            </CcButton>
            <CcButton variant="ghost" onClick={() => window.open(`${repoUrl}/actions`, '_blank')}>
              Actions
            </CcButton>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CcEmptyState
            icon="📦"
            title="Repository Dashboard"
            description="GitHub does not allow iframe embedding. Enter a repo URL above to open it in your browser."
          />
        </div>
      )}
    </div>
  );
}
