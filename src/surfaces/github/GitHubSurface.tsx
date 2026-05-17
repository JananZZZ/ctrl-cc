import { useEffect, useRef, useState } from 'react';
import { Webview } from '@tauri-apps/api/webview';
import { Window } from '@tauri-apps/api/window';
import { CcButton } from '../../components/ui/CcButton';

const DEFAULT_HOME_KEY = 'ctrlcc.github.home';
const DEFAULT_URL = 'https://github.com';

/**
 * GitHub Surface。
 * 注意：GitHub 不允许 iframe 嵌入，所以这里使用 Tauri Webview。
 * 这不是外部浏览器，而是在应用内部创建一个子 Webview。
 */
export function GitHubSurface() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<Webview | null>(null);

  const [url, setUrl] = useState(() => localStorage.getItem(DEFAULT_HOME_KEY) || DEFAULT_URL);
  const [input, setInput] = useState(url);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  /**
   * 规范化用户输入 URL。
   * 用户输入 github.com 时自动补 https://。
   */
  function normalizeUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return DEFAULT_URL;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  /**
   * 创建或调整内嵌 Webview。
   * Webview 的坐标必须跟随 host 容器。
   */
  async function createOrResizeWebview(nextUrl = url) {
    const host = hostRef.current;
    if (!host) return;

    const rect = host.getBoundingClientRect();

    try {
      setStatus('loading');
      setError(null);

      if (!webviewRef.current) {
        const appWindow = new Window('main');

        const webview = new Webview(appWindow, 'github-browser', {
          url: nextUrl,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          focus: true,
        });

        webviewRef.current = webview;

        await webview.once('tauri://created', () => {
          setStatus('ready');
        });

        await webview.once('tauri://error', (event) => {
          setStatus('error');
          setError(String(event.payload));
        });
      } else {
        await webviewRef.current.setPosition({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
        } as any);

        await webviewRef.current.setSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        } as any);
      }
    } catch (err) {
      setStatus('error');
      setError(String(err));
    }
  }

  /**
   * 打开新 URL。
   * 为了避免旧 Webview 状态残留，这里关闭旧 Webview 后重新创建。
   */
  async function navigate(nextRaw: string) {
    const next = normalizeUrl(nextRaw);

    setUrl(next);
    setInput(next);

    await webviewRef.current?.close().catch(() => {});
    webviewRef.current = null;

    await createOrResizeWebview(next);
  }

  /**
   * 保存默认 GitHub 主页。
   */
  function saveDefault() {
    const next = normalizeUrl(input);
    localStorage.setItem(DEFAULT_HOME_KEY, next);
    setInput(next);
    setUrl(next);
  }

  useEffect(() => {
    void createOrResizeWebview(url);

    const handleResize = () => {
      void createOrResizeWebview(url);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      webviewRef.current?.close().catch(() => {});
      webviewRef.current = null;
    };
  }, []);

  return (
    <div data-testid="surface-github" className="cc-surface-page cc-github-surface">
      <div className="cc-github-toolbar">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void navigate(input);
            }
          }}
          placeholder="https://github.com"
          className="cc-github-address"
        />

        <CcButton variant="primary" onClick={() => void navigate(input)}>
          打开
        </CcButton>

        <CcButton variant="ghost" onClick={saveDefault}>
          设为默认主页
        </CcButton>

        <CcButton variant="ghost" onClick={() => void navigate(DEFAULT_URL)}>
          GitHub 主页
        </CcButton>
      </div>

      <div className="cc-github-browser-shell">
        <div ref={hostRef} className="cc-github-webview-host" />

        {status === 'loading' && (
          <div className="cc-github-overlay">
            正在打开 GitHub...
          </div>
        )}

        {status === 'error' && (
          <div className="cc-github-overlay cc-github-error">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
