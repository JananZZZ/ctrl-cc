import { useRef, useState } from 'react';
import { CcButton } from '../../components/ui/CcButton';

const DEFAULT_HOME_KEY = 'ctrlcc.github.home';
const DEFAULT_URL = 'https://github.com';

/**
 * GitHub Surface。
 * GitHub 不允许 iframe 嵌入，使用内嵌 Webview 方案。
 * 对于不支持 Webview 的环境，回退到外部浏览器。
 */
export function GitHubSurface() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [url, setUrl] = useState(() => localStorage.getItem(DEFAULT_HOME_KEY) || DEFAULT_URL);
  const [input, setInput] = useState(url);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  function normalizeUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return DEFAULT_URL;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function openExternal(urlToOpen: string) {
    window.open(urlToOpen, '_blank');
  }

  async function navigate(nextRaw: string) {
    const next = normalizeUrl(nextRaw);
    setUrl(next);
    setInput(next);

    // Try Tauri Webview first, fallback to external
    try {
      const { Webview } = await import('@tauri-apps/api/webview');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      setStatus('loading');
      const host = hostRef.current;
      if (!host) return;

      const rect = host.getBoundingClientRect();
      const appWindow = getCurrentWindow();

      new Webview(appWindow, 'github-browser', {
        url: next,
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        focus: true,
      });

      setStatus('ready');
    } catch {
      // Fallback: open in external browser
      setStatus('error');
      setError('Webview 不可用，已在外部浏览器中打开');
      openExternal(next);
    }
  }

  function saveDefault() {
    const next = normalizeUrl(input);
    localStorage.setItem(DEFAULT_HOME_KEY, next);
    setInput(next);
    setUrl(next);
  }

  return (
    <div data-testid="surface-github" className="cc-surface-page">
      <div className="cc-page-inner">
        <div className="cc-page-header">
          <div>
            <h1 className="cc-title-xl">GitHub</h1>
            <p className="cc-body-sm">内置浏览器 — GitHub 不允许 iframe 嵌入</p>
          </div>
          <CcButton variant="primary" onClick={() => navigate(url)}>刷新</CcButton>
        </div>

        <div className="cc-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(input); }}
              placeholder="https://github.com/owner/repo"
              style={{ flex: 1, padding: '6px 12px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none' }}
            />
            <CcButton variant="primary" onClick={() => navigate(input)}>打开</CcButton>
            <CcButton variant="ghost" onClick={saveDefault}>设为默认</CcButton>
          </div>
        </div>

        {status === 'loading' && <div className="cc-card" style={{ textAlign: 'center', padding: 40 }}>正在加载 GitHub...</div>}
        {status === 'error' && <div className="cc-card" style={{ textAlign: 'center', padding: 40, color: 'var(--cc-red)' }}>{error || '加载失败'}</div>}
        {status === 'ready' && (
          <div className="cc-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div ref={hostRef} style={{ width: '100%', minHeight: 500, background: 'var(--cc-bg-muted)' }} />
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <CcButton variant="ghost" onClick={() => openExternal(url + '/issues')}>Issues</CcButton>
          <CcButton variant="ghost" onClick={() => openExternal(url + '/pulls')}>Pull Requests</CcButton>
          <CcButton variant="ghost" onClick={() => openExternal(url + '/actions')}>Actions</CcButton>
          <CcButton variant="ghost" onClick={() => openExternal(url + '/releases')}>Releases</CcButton>
          <CcButton variant="ghost" onClick={() => openExternal(url)}>在浏览器中打开</CcButton>
        </div>
      </div>
    </div>
  );
}
