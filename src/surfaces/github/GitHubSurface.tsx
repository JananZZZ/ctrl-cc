import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';

export function GitHubSurface() {
  useRenderLoopGuard('GitHubSurface');
  const { t } = useTranslation();
  const [url, setUrl] = useState('https://github.com');
  const [inputUrl, setInputUrl] = useState('https://github.com');

  return (
    <div data-testid="surface-github" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)', flexShrink: 0 }}>
        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setUrl(inputUrl); }}
          placeholder={t('github.urlPlaceholder')}
          style={{ flex: 1, padding: '4px 10px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)', color: 'var(--cc-text)', outline: 'none' }}
        />
        <button
          onClick={() => setUrl(inputUrl)}
          style={{ padding: '4px 14px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-navy)', color: 'var(--cc-text-on-accent)', cursor: 'pointer', fontWeight: 600 }}
        >
          {t('github.go')}
        </button>
        <button
          onClick={() => { setUrl('https://github.com'); setInputUrl('https://github.com'); }}
          style={{ padding: '4px 10px', fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-surface-solid)', color: 'var(--cc-text)', cursor: 'pointer' }}
        >
          {t('github.title')}
        </button>
      </div>
      <iframe src={url} style={{ flex: 1, border: 'none', width: '100%' }} title="GitHub Browser" />
    </div>
  );
}
