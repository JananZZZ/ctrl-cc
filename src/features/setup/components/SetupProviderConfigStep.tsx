import { useState, useEffect } from 'react';
import { useSetupStore } from '../stores/setupStore';

interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', haikuModel: 'deepseek-chat', sonnetModel: 'deepseek-reasoner', opusModel: 'deepseek-reasoner' },
  { id: 'zhipu', label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', haikuModel: 'glm-4-flash', sonnetModel: 'glm-4-plus', opusModel: 'glm-4-plus' },
  { id: 'minimax', label: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', haikuModel: 'abab6.5s-chat', sonnetModel: 'abab7-chat', opusModel: 'abab7-chat' },
  { id: 'mimo', label: '小米 MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', haikuModel: 'mimo-lite', sonnetModel: 'mimo-plus', opusModel: 'mimo-max' },
  { id: 'qwen', label: '通义千问 Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', haikuModel: 'qwen-turbo', sonnetModel: 'qwen-plus', opusModel: 'qwen-max' },
  { id: 'custom', label: 'Custom', baseUrl: '', haikuModel: '', sonnetModel: '', opusModel: '' },
];

export function SetupProviderConfigStep() {
  const writeConfig = useSetupStore((s) => s.writeProviderConfig);
  const readConfig = useSetupStore((s) => s.readProviderConfigSafe);
  const [provider, setProvider] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [haikuModel, setHaikuModel] = useState('');
  const [sonnetModel, setSonnetModel] = useState('');
  const [opusModel, setOpusModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<{
    configured: boolean;
    provider: string;
    baseUrl: string;
    apiKeyMasked: string;
  } | null>(null);

  useEffect(() => {
    readConfig().then(setCurrentConfig).catch(() => {});
  }, []);

  const handleProviderChange = (presetId: string) => {
    setProvider(presetId);
    const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (preset && presetId !== 'custom') {
      setBaseUrl(preset.baseUrl);
      setHaikuModel(preset.haikuModel);
      setSonnetModel(preset.sonnetModel);
      setOpusModel(preset.opusModel);
    } else {
      setBaseUrl('');
      setHaikuModel('');
      setSonnetModel('');
      setOpusModel('');
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await writeConfig({
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl || undefined,
        haikuModel: haikuModel || undefined,
        sonnetModel: sonnetModel || undefined,
        opusModel: opusModel || undefined,
      });
      setStatus('配置已保存');
      setApiKey('');
      const config = await readConfig();
      setCurrentConfig(config);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Current config status */}
      {currentConfig?.configured && (
        <div style={{
          padding: '10px 14px', marginBottom: 16,
          borderRadius: 'var(--cc-radius-md)',
          background: 'var(--cc-green-soft)', border: '1px solid var(--cc-green)',
          fontSize: 'var(--cc-font-sm)',
        }}>
          <strong>当前已配置:</strong> {currentConfig.provider} | Key: {currentConfig.apiKeyMasked}
        </div>
      )}

      {/* Provider selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', display: 'block', marginBottom: 6 }}>
          API Provider
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              style={{
                padding: '5px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: 500,
                border: provider === p.id ? '2px solid var(--cc-brand)' : '1px solid var(--cc-border)',
                borderRadius: 'var(--cc-radius-sm)',
                background: provider === p.id ? 'var(--cc-brand-soft)' : 'var(--cc-bg)',
                color: 'var(--cc-text)', cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', display: 'block', marginBottom: 4 }}>
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          style={inputStyle}
        />
      </div>

      {/* Base URL (for custom only) */}
      {(provider === 'custom' || baseUrl) && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)', display: 'block', marginBottom: 4 }}>
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            style={inputStyle}
          />
        </div>
      )}

      {/* Model fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', display: 'block', marginBottom: 2 }}>Haiku Model</label>
          <input type="text" value={haikuModel} onChange={(e) => setHaikuModel(e.target.value)} style={inputStyle} placeholder="可选" />
        </div>
        <div>
          <label style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', display: 'block', marginBottom: 2 }}>Sonnet Model</label>
          <input type="text" value={sonnetModel} onChange={(e) => setSonnetModel(e.target.value)} style={inputStyle} placeholder="可选" />
        </div>
        <div>
          <label style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', display: 'block', marginBottom: 2 }}>Opus Model</label>
          <input type="text" value={opusModel} onChange={(e) => setOpusModel(e.target.value)} style={inputStyle} placeholder="可选" />
        </div>
      </div>

      {error && (
        <div style={{ padding: '6px 10px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-red-soft)', color: 'var(--cc-red)', fontSize: 'var(--cc-font-xs)', marginBottom: 10 }}>
          {error}
        </div>
      )}
      {status && (
        <div style={{ padding: '6px 10px', borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-green-soft)', color: 'var(--cc-green)', fontSize: 'var(--cc-font-xs)', marginBottom: 10 }}>
          {status}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
        {saving ? '保存中...' : '保存 API 配置'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  fontSize: 'var(--cc-font-sm)', fontFamily: 'var(--cc-font-mono)',
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)',
  boxSizing: 'border-box' as const,
};

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 24px', fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: 'none', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)', color: 'var(--cc-text-inverse)', cursor: 'pointer',
};
