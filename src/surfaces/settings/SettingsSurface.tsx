import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useRenderLoopGuard } from '../../debug/useRenderLoopGuard';
import { CcCard } from '../../components/ui/CcCard';
import { CcButton } from '../../components/ui/CcButton';
import { CTRL_CC_THEMES } from '../../design/theme-registry';
import type { CtrlCcTheme } from '../../design/theme-types';
import { RuntimeDiagnosticsPanel } from '../../features/runtime/components/RuntimeDiagnosticsPanel';
import { SurfacePage } from '../../components/layout/SurfacePage';
import { useSetupStore } from '../../features/setup/stores/setupStore';
import { PermissionCenterCard } from './PermissionCenterCard';

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
  const [model, setModel] = useState(() => localStorage.getItem('ctrl-cc-model') || 'sonnet');
  const [effort, setEffort] = useState(() => localStorage.getItem('ctrl-cc-effort') || 'medium');
  const [permMode, setPermMode] = useState(() => localStorage.getItem('ctrl-cc-permMode') || 'default');
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

  // v28: Unified setup snapshot via useSetupStore
  const envSnapshot = useSetupStore((s) => s.snapshot);
  const envChecking = useSetupStore((s) => s.checking);
  const envError = useSetupStore((s) => s.error);
  const refreshEnv = useSetupStore((s) => s.detectAll);
  const loadCachedEnv = useSetupStore((s) => s.hydrate);
  const clearEnv = useSetupStore((s) => s.clearCache);

  useEffect(() => {
    loadCachedEnv();
  }, [loadCachedEnv]);

  useEffect(() => { localStorage.setItem('ctrl-cc-model', model); }, [model]);
  useEffect(() => { localStorage.setItem('ctrl-cc-effort', effort); }, [effort]);
  useEffect(() => { localStorage.setItem('ctrl-cc-permMode', permMode); }, [permMode]);

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
    const diag = { model, effort, permMode, fontSize, theme: currentTheme, lang: i18n.language, time: new Date().toISOString(), env: envSnapshot };
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

  return (
    <SurfacePage variant="diagnostics" testId="surface-settings">
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
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
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
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
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
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
        <div className="cc-card-header">
          <h3 style={sectH3}>{t('settings.environment')}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <CcButton size="sm" variant="ghost" onClick={() => void refreshEnv()} disabled={envChecking}>
              {envChecking ? t('common.detecting') : envSnapshot ? '刷新环境配置' : '检测环境配置'}
            </CcButton>
            {envSnapshot && (
              <CcButton size="sm" variant="ghost" onClick={clearEnv}>
                清除环境缓存
              </CcButton>
            )}
          </div>
        </div>

        {envError && <div className="cc-inline-error">{envError}</div>}

        {!envSnapshot ? (
          <div className="cc-empty-hint">
            尚未检测环境。点击"检测环境配置"后，将统一检测 Claude CLI、认证状态、LaunchPlan、Claude JS 候选路径。
          </div>
        ) : (
          <div className="cc-settings-grid">
            <F label={t('console.claudeCli')} value={envSnapshot?.checks?.claudeCode?.ok ? String(t('common.installed')) : String(t('common.notDetected'))} color={envSnapshot?.checks?.claudeCode?.ok ? 'var(--cc-green)' : 'var(--cc-red)'} />
            <F label={t('console.version')} value={envSnapshot?.checks?.claudeCode?.version || 'N/A'} />
            <F label={t('console.authStatus')} value={envSnapshot?.checks?.claudeAuth?.ok ? 'authenticated' : String(t('common.unknown'))} color={envSnapshot?.checks?.claudeAuth?.ok ? 'var(--cc-green)' : 'var(--cc-amber)'} />
            <F label="LaunchPlan" value={envSnapshot?.selectedChatCommandId ?? 'not selected'} />
            <F label="Claude commands" value={String((envSnapshot?.claudeCommands ?? []).filter((c) => c.printOk).length)} />
            <F label={t('console.checkedAt')} value={fmtTime(envSnapshot.generatedAt)} />
          </div>
        )}
      </CcCard>

      {/* v23.0 Setup Center — 环境配置 */}
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
        <div className="cc-card-header">
          <h3 style={sectH3}>Setup Center</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <CcButton size="sm" variant="primary" onClick={() => {
              const store = useSetupStore.getState();
              store.detectAll().catch(() => {});
            }}>
              一键检测
            </CcButton>
            <CcButton size="sm" variant="ghost" onClick={() => {
              const store = useSetupStore.getState();
              store.resetOnboarding();
            }}>
              重置引导
            </CcButton>
          </div>
        </div>
        <SetupCenterSummary />
      </CcCard>

      {/* v23.0 API 配置 */}
      <SetupApiConfigCard />

      {/* Runtime */}
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.runtime')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--cc-font-sm)' }}>
          <S label={t('settings.defaultModel')} value={model} onChange={setModel} opts={['sonnet', 'opus', 'haiku']} />
          <S label={t('settings.defaultEffort')} value={effort} onChange={setEffort} opts={['low', 'medium', 'high', 'xhigh', 'max']} />
          <S label={t('settings.defaultPermMode')} value={permMode} onChange={setPermMode} opts={['default', 'acceptEdits', 'plan', 'auto', 'dontAsk']} />
        </div>
      </CcCard>

      {/* Permission Center — real backend */}
      <PermissionCenterCard />

      {/* Diagnostics */}
      <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
        <h3 style={sectH3}>{t('settings.diagnostics')}</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <CcButton size="sm" variant="ghost" onClick={exportDiag}>{t('settings.exportDiag')}</CcButton>
          <CcButton size="sm" variant="ghost" onClick={clearCache}>{t('settings.clearCache')}</CcButton>
          <CcButton size="sm" variant="ghost" onClick={() => { try { const el = document.querySelector('[data-error-log]'); if (el) (el as HTMLElement).click(); } catch {} }}>{t('settings.viewErrorLog')}</CcButton>
        </div>
        {/* Runtime Deep Diagnostics */}
        <RuntimeDiagnosticsPanel />
      </CcCard>
    </SurfacePage>
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

function SetupCenterSummary() {
  const snapshot = useSetupStore((s) => s.snapshot);
  const checking = useSetupStore((s) => s.checking);

  if (checking) {
    return <div style={{ color: 'var(--cc-text-muted)', fontSize: 'var(--cc-font-sm)', padding: '20px 0' }}>检测中...</div>;
  }

  if (!snapshot) {
    return <div className="cc-empty-hint">尚未运行环境检测。点击"一键检测"开始。</div>;
  }

  const checks = snapshot.checks;
  const required = Object.values(checks).filter((c) => c.required);
  const missing = required.filter((c) => !c.ok);
  const allOk = missing.length === 0;

  return (
    <div>
      <div style={{
        padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--cc-radius-md)',
        background: allOk ? 'var(--cc-green-soft)' : 'var(--cc-red-soft)',
        border: `1px solid ${allOk ? 'var(--cc-green)' : 'var(--cc-red)'}`,
        fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text)',
      }}>
        <strong style={{ color: allOk ? 'var(--cc-green)' : 'var(--cc-red)' }}>
          {allOk ? '环境就绪' : `缺少 ${missing.length} 个组件`}
        </strong>
        <span style={{ marginLeft: 8, color: 'var(--cc-text-muted)' }}>{snapshot.summary}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
        {required.map((item) => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--cc-font-xs)',
            padding: '4px 8px', borderRadius: 'var(--cc-radius-xs)',
            background: item.ok ? 'var(--cc-green-soft)' : 'var(--cc-red-soft)',
            color: item.ok ? 'var(--cc-green)' : 'var(--cc-red)',
          }}>
            <span>{item.ok ? '✓' : '✗'}</span>
            <span>{item.label}</span>
            {item.version && <span style={{ color: 'var(--cc-text-muted)', marginLeft: 'auto' }}>{item.version}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupApiConfigCard() {
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const PRESETS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    minimax: 'https://api.minimax.chat/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  };

  const handleProviderChange = (id: string) => {
    setProvider(id);
    setBaseUrl(PRESETS[id] || '');
  };

  const handleSave = async () => {
    if (!apiKey.trim()) { setError('请输入 API Key'); return; }
    setSaving(true);
    setError(null);
    try {
      await useSetupStore.getState().writeProviderConfig({
        provider, apiKey: apiKey.trim(),
        baseUrl: baseUrl || undefined,
      });
      setStatus('配置已保存');
      setApiKey('');
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CcCard className="cc-section-card" style={{ marginBottom: 16 }}>
      <h3 style={sectH3}>API 配置</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(PRESETS).map(([id]) => (
          <button key={id} onClick={() => handleProviderChange(id)} style={{
            padding: '5px 14px', fontSize: 'var(--cc-font-xs)',
            border: provider === id ? '2px solid var(--cc-brand)' : '1px solid var(--cc-border)',
            borderRadius: 'var(--cc-radius-sm)',
            background: provider === id ? 'var(--cc-brand-soft)' : 'var(--cc-bg)',
            color: 'var(--cc-text)', cursor: 'pointer',
          }}>
            {id === 'anthropic' ? 'Anthropic' : id === 'deepseek' ? 'DeepSeek' : id === 'zhipu' ? '智谱 GLM' : id === 'minimax' ? 'MiniMax' : '通义千问'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', display: 'block', marginBottom: 2 }}>API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." style={apiInputStyle} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', display: 'block', marginBottom: 2 }}>Base URL</label>
          <input type="text" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={PRESETS[provider] || ''} style={apiInputStyle} />
        </div>
        <CcButton size="sm" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </CcButton>
      </div>
      {error && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-red-soft)', color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)' }}>{error}</div>}
      {status && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-green-soft)', color: 'var(--cc-green)', fontSize: 'var(--cc-font-xs)' }}>{status}</div>}
    </CcCard>
  );
}

const apiInputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  fontSize: 'var(--cc-font-sm)', fontFamily: 'var(--cc-font-mono)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)',
  boxSizing: 'border-box' as const,
};
