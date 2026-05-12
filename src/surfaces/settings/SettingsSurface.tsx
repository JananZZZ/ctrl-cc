import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { invokeCommand } from '../../services/invokeCommand';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcCard } from '../../components/ui/CcCard';
import { CcButton } from '../../components/ui/CcButton';
import { CTRL_CC_THEMES } from '../../design/theme-registry';
import type { CtrlCcTheme } from '../../design/theme-types';
import { RuntimeDiagnosticsPanel } from '../../features/runtime/components/RuntimeDiagnosticsPanel';

interface Capability { version: string | null; exists: boolean; authStatus: string | null; supportsStreamJson: boolean; supportsMCP: boolean; supportsAgents: boolean; checkedAt: string; errors: string[]; }

const THEME_I18N_KEYS: Record<CtrlCcTheme, string> = {
  'warm-sand': 'theme.warmSand',
  light: 'theme.light',
  'pale-blue': 'theme.paleBlue',
  dark: 'theme.dark',
};
const THEME_DESC_KEYS: Record<CtrlCcTheme, string> = {
  'warm-sand': 'theme.warmSandDesc',
  light: 'theme.lightDesc',
  'pale-blue': 'theme.paleBlueDesc',
  dark: 'theme.darkDesc',
};

export function SettingsSurface() {
  useRenderLoopGuard('SettingsSurface');
  const { t } = useTranslation();
  const [cap, setCap] = useState<Capability | null>(null);
  const [capLoading, setCapLoading] = useState(true);
  const [model, setModel] = useState(() => localStorage.getItem('ctrl-cc-model') || 'sonnet');
  const [effort, setEffort] = useState(() => localStorage.getItem('ctrl-cc-effort') || 'medium');
  const [permMode, setPermMode] = useState(() => localStorage.getItem('ctrl-cc-permMode') || 'default');
  const [autoTrust, setAutoTrust] = useState(() => Number(localStorage.getItem('ctrl-cc-autoTrust')) || 0);
  const [fontSize, setFontSize] = useState(() => {
    const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cc-font-scale').trim()) || 1;
    return Math.round(14 * scale);
  });
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [currentTheme, setCurrentTheme] = useState<CtrlCcTheme>(() => {
    const htmlTheme = document.documentElement.dataset.theme as CtrlCcTheme | undefined;
    if (htmlTheme && ['warm-sand', 'light', 'pale-blue', 'dark'].includes(htmlTheme)) return htmlTheme;
    const stored = localStorage.getItem('ctrl-cc-theme');
    if (stored && ['warm-sand', 'light', 'pale-blue', 'dark'].includes(stored)) return stored as CtrlCcTheme;
    return 'warm-sand';
  });

  const checkCap = () => {
    setCapLoading(true);
    invokeCommand<Capability>('claude_check_capability')
      .then((c) => {
        setCap(c);
        localStorage.setItem('ctrl-cc-capability', JSON.stringify({ data: c, checkedAt: new Date().toISOString() }));
        setStatusMsg(t('settings.envCheckComplete'));
      })
      .catch(() => setCap({ version: null, exists: false, authStatus: null, supportsStreamJson: false, supportsMCP: false, supportsAgents: false, checkedAt: new Date().toISOString(), errors: ['Detection failed'] }))
      .finally(() => setCapLoading(false));
  };

  useEffect(() => {
    // Try cached capability first
    const cached = localStorage.getItem('ctrl-cc-capability');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.data && parsed.checkedAt) {
          const age = Date.now() - new Date(parsed.checkedAt).getTime();
          if (age < 5 * 60 * 1000) { setCap(parsed.data); setCapLoading(false); return; }
        }
      } catch {}
    }
    checkCap();
  }, []);

  useEffect(() => { localStorage.setItem('ctrl-cc-model', model); }, [model]);
  useEffect(() => { localStorage.setItem('ctrl-cc-effort', effort); }, [effort]);
  useEffect(() => { localStorage.setItem('ctrl-cc-permMode', permMode); }, [permMode]);
  useEffect(() => { localStorage.setItem('ctrl-cc-autoTrust', String(autoTrust)); }, [autoTrust]);

  const switchTheme = (themeId: CtrlCcTheme) => {
    setCurrentTheme(themeId);
    localStorage.setItem('ctrl-cc-theme', themeId);
    document.documentElement.dataset.theme = themeId;
  };

  const switchLang = (lang: 'zh' | 'en') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('ctrlcc_lang', lang);
  };

  const exportDiag = () => {
    const diag = { cap, model, effort, permMode, autoTrust, fontSize, theme: currentTheme, lang: i18n.language, time: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'ctrl-cc-diagnostics.json'; a.click();
    URL.revokeObjectURL(url);
    setStatusMsg(t('settings.diagExported'));
  };

  const clearCache = () => {
    try { localStorage.clear(); setStatusMsg(t('settings.cacheCleared')); }
    catch { setStatusMsg(t('settings.cacheClearFailed')); }
  };

  const AUTO_TRUST_DESCS = [
    t('settings.autoTrustLevels.0'), t('settings.autoTrustLevels.1'), t('settings.autoTrustLevels.2'),
    t('settings.autoTrustLevels.3'), t('settings.autoTrustLevels.4'), t('settings.autoTrustLevels.5'),
  ];

  return (
    <div data-testid="surface-settings" style={{ padding: '24px 32px', overflow: 'auto', height: '100%', maxWidth: 900 }}>
      <h1 style={{ fontSize: 'var(--cc-font-2xl)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 4 }}>{t('settings.title')}</h1>
      <p style={{ fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', marginBottom: 24 }}>
        {t('settings.environment')} / {t('settings.runtime')} / {t('settings.appearance')} / {t('settings.security')} / {t('settings.language')} / {t('settings.diagnostics')}
      </p>
      {statusMsg && (
        <div style={{ color: 'var(--cc-green)', fontSize: 'var(--cc-font-xs)', marginBottom: 10, padding: '6px 12px', borderRadius: 'var(--cc-radius-xs)', background: 'var(--cc-bg-success-soft)' }}>
          {statusMsg}
        </div>
      )}

      {/* Language Toggle */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.language')}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => switchLang('zh')}
            style={{
              ...langBtnBase,
              background: i18n.language === 'zh' ? 'var(--cc-navy)' : 'var(--cc-bg)',
              color: i18n.language === 'zh' ? 'var(--cc-text-on-accent)' : 'var(--cc-text)',
              border: i18n.language === 'zh' ? '1px solid var(--cc-navy)' : '1px solid var(--cc-border)',
            }}
          >
            {t('settings.chinese')}
          </button>
          <button
            onClick={() => switchLang('en')}
            style={{
              ...langBtnBase,
              background: i18n.language !== 'zh' ? 'var(--cc-navy)' : 'var(--cc-bg)',
              color: i18n.language !== 'zh' ? 'var(--cc-text-on-accent)' : 'var(--cc-text)',
              border: i18n.language !== 'zh' ? '1px solid var(--cc-navy)' : '1px solid var(--cc-border)',
            }}
          >
            {t('settings.english')}
          </button>
        </div>
      </CcCard>

      {/* Appearance — 4 Theme Cards */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>
          {t('settings.appearance')}
          <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', marginLeft: 8, fontWeight: 400 }}>
            {t(THEME_I18N_KEYS[currentTheme])}
          </span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginBottom: 16 }}>
          {CTRL_CC_THEMES.map((meta) => {
            const selected = meta.id === currentTheme;
            return (
              <button
                key={meta.id}
                onClick={() => switchTheme(meta.id)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  padding: 12, borderRadius: 'var(--cc-radius-lg)',
                  border: selected ? '2px solid var(--cc-brand)' : '2px solid var(--cc-border)',
                  background: selected ? 'var(--cc-brand-soft, var(--cc-bg-muted))' : 'var(--cc-bg)',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {/* 4 Color Swatches */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, borderRadius: 'var(--cc-radius-sm)', overflow: 'hidden' }}>
                  <div style={{ height: 24, borderRadius: 3, background: meta.previewColors.bg, border: '1px solid var(--cc-border-soft)' }} title="bg" />
                  <div style={{ height: 24, borderRadius: 3, background: meta.previewColors.surface, border: '1px solid var(--cc-border)' }} title="surface" />
                  <div style={{ height: 24, borderRadius: 3, background: meta.previewColors.brand }} title="brand" />
                  <div style={{ height: 24, borderRadius: 3, background: meta.previewColors.text }} title="text" />
                </div>

                {/* Label + Recommend badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)' }}>
                    {t(THEME_I18N_KEYS[meta.id])}
                  </span>
                  {meta.id === 'warm-sand' && (
                    <span style={{ fontSize: 'var(--cc-font-3xs)', padding: '1px 6px', borderRadius: 'var(--cc-radius-xs)', background: 'var(--cc-amber)', color: 'var(--cc-text-on-accent)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {t('theme.recommend')}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p style={{ margin: 0, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', lineHeight: 1.4 }}>
                  {t(THEME_DESC_KEYS[meta.id])}
                </p>
              </button>
            );
          })}
        </div>

        {/* Font Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--cc-text-soft)', minWidth: 90, fontSize: 'var(--cc-font-sm)' }}>{t('settings.fontSize')}</span>
          <input type="range" min={10} max={24} value={fontSize} onChange={(e) => { const v = parseInt(e.target.value); setFontSize(v); const scale = v / 14; document.documentElement.style.setProperty('--cc-font-scale', String(scale)); localStorage.setItem('ctrl-cc-font-scale', String(scale)); }} style={{ flex: 1 }} />
          <span style={{ color: 'var(--cc-text)', fontWeight: 600, fontSize: 'var(--cc-font-sm)' }}>{fontSize}px</span>
        </div>
      </CcCard>

      {/* Environment */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.environment')}</h3>
        {capLoading ? (
          <div style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)' }}>{t('common.detecting')}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', fontSize: 'var(--cc-font-sm)' }}>
            <F label={t('console.claudeCli')} value={cap?.exists ? String(t('common.installed')) : String(t('common.notDetected'))} color={cap?.exists ? 'var(--cc-green)' : 'var(--cc-red)'} />
            <F label={t('console.version')} value={cap?.version || 'N/A'} />
            <F label={t('console.authStatus')} value={cap?.authStatus || String(t('common.unknown'))} color={cap?.authStatus === 'authenticated' ? 'var(--cc-green)' : 'var(--cc-amber)'} />
            <F label={t('console.mcp')} value={cap?.supportsMCP ? String(t('common.supported')) : String(t('common.unknown'))} />
            <F label={t('console.agents')} value={cap?.supportsAgents ? String(t('common.supported')) : String(t('common.unknown'))} />
            <F label={t('console.checkedAt')} value={cap?.checkedAt ? fmtTime(cap.checkedAt) : 'N/A'} />
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <CcButton size="sm" variant="ghost" onClick={checkCap}>{t('settings.redetect')}</CcButton>
        </div>
      </CcCard>

      {/* Runtime */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.runtime')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--cc-font-sm)' }}>
          <S label={t('settings.defaultModel')} value={model} onChange={setModel} opts={['sonnet', 'opus', 'haiku']} />
          <S label={t('settings.defaultEffort')} value={effort} onChange={setEffort} opts={['low', 'medium', 'high', 'xhigh', 'max']} />
          <S label={t('settings.defaultPermMode')} value={permMode} onChange={setPermMode} opts={['default', 'acceptEdits', 'plan', 'auto', 'dontAsk']} />
        </div>
      </CcCard>

      {/* Permission Center */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.permissionCenter')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--cc-font-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--cc-text-soft)', minWidth: 100 }}>{t('settings.allowlist')}</span>
            <span style={{ color: 'var(--cc-green)' }}>read, glob, grep, list</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--cc-text-soft)', minWidth: 100 }}>{t('settings.denylist')}</span>
            <span style={{ color: 'var(--cc-red)' }}>rm -rf, git push --force</span>
          </div>
          <CcButton size="sm" variant="ghost" onClick={() => setStatusMsg('Permission Center active')}>{t('settings.manageRules')}</CcButton>
        </div>
      </CcCard>

      {/* AutoTrust Security */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.autoTrustSecurity')}</h3>
        <S label={t('settings.autoTrust')} value={String(autoTrust)} onChange={(v) => setAutoTrust(parseInt(v))} opts={['0', '1', '2', '3', '4', '5']} />
        <div style={{ marginTop: 6, fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
          {t('settings.autoTrustDesc', { level: autoTrust, desc: AUTO_TRUST_DESCS[autoTrust] })}
        </div>
      </CcCard>

      {/* Diagnostics */}
      <CcCard style={{ padding: 16, marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.diagnostics')}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <CcButton size="sm" variant="ghost" onClick={exportDiag}>{t('settings.exportDiag')}</CcButton>
          <CcButton size="sm" variant="ghost" onClick={clearCache}>{t('settings.clearCache')}</CcButton>
          <CcButton size="sm" variant="ghost" onClick={() => { try { const el = document.querySelector('[data-error-log]'); if (el) (el as HTMLElement).click(); } catch {} }}>{t('settings.viewErrorLog')}</CcButton>
        </div>
        {/* Runtime Deep Diagnostics */}
        <RuntimeDiagnosticsPanel />
      </CcCard>
    </div>
  );
}

function F({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--cc-text-soft)' }}>{label}</span>
      <span style={{ color: color || 'var(--cc-text)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function S({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--cc-text-soft)', minWidth: 100, fontSize: 'var(--cc-font-sm)' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selStyle}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString(); } catch { return iso; }
}

const sectH3: React.CSSProperties = { fontSize: 'var(--cc-font-md)', fontWeight: 600, color: 'var(--cc-text)', marginBottom: 12 };
const langBtnBase: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 'var(--cc-radius-sm)', cursor: 'pointer',
  fontSize: 'var(--cc-font-sm)', fontWeight: 500, transition: 'all 0.15s',
};
const selStyle: React.CSSProperties = {
  padding: '4px 8px', fontSize: 'var(--cc-font-sm)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-xs)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)', cursor: 'pointer', minWidth: 140,
};
