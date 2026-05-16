import { useMemo, useState } from 'react';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcEmptyState } from '../../components/ui/CcEmptyState';
import { CcButton } from '../../components/ui/CcButton';

const DEFAULT_HOME_KEY = 'ctrlcc.github.home';

export function GitHubSurface() {
  useRenderLoopGuard('GitHubSurface');
  const [home, setHome] = useState(
    () => localStorage.getItem(DEFAULT_HOME_KEY) || 'https://github.com'
  );
  const [input, setInput] = useState(home);

  const repo = useMemo(() => parseGitHubRepo(input), [input]);

  function saveHome() {
    localStorage.setItem(DEFAULT_HOME_KEY, input);
    setHome(input);
  }

  function openUrl(url: string) {
    window.open(url, '_blank');
  }

  return (
    <div data-testid="surface-github" className="cc-surface-page">
      <div className="cc-page-inner">
        <div className="cc-page-header">
          <div>
            <h1 className="cc-title-xl">GitHub</h1>
            <p className="cc-body-sm">Repository dashboard and quick links</p>
          </div>
          <CcButton variant="primary" onClick={() => openUrl(home)}>
            Open Default Home
          </CcButton>
        </div>

        <div className="cc-card" style={{ marginBottom: 16 }}>
          <div className="cc-card-title">Default Home</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://github.com/owner/repo"
              style={{ flex: 1, padding: '6px 12px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none' }}
            />
            <CcButton variant="ghost" onClick={saveHome}>Set Default</CcButton>
            <CcButton variant="ghost" onClick={() => openUrl(input)}>Open</CcButton>
          </div>
        </div>

        {repo ? (
          <div className="cc-card">
            <div className="cc-card-title">{repo.owner}/{repo.name}</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <CcButton variant="primary" onClick={() => openUrl(repo.url)}>Open</CcButton>
              <CcButton variant="ghost" onClick={() => openUrl(`${repo.url}/issues`)}>Issues</CcButton>
              <CcButton variant="ghost" onClick={() => openUrl(`${repo.url}/pulls`)}>Pull Requests</CcButton>
              <CcButton variant="ghost" onClick={() => openUrl(`${repo.url}/actions`)}>Actions</CcButton>
              <CcButton variant="ghost" onClick={() => openUrl(`${repo.url}/releases`)}>Releases</CcButton>
            </div>
          </div>
        ) : (
          <div className="cc-card" style={{ opacity: 0.6 }}>
            <CcEmptyState
              icon="📦"
              title="Repository Dashboard"
              description="Enter a GitHub repo URL above to see quick links. GitHub does not allow iframe embedding."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function parseGitHubRepo(url: string): null | { owner: string; name: string; url: string } {
  const match = url.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (!match) return null;
  const owner = match[1];
  const name = match[2].replace(/\.git$/, '');
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}
