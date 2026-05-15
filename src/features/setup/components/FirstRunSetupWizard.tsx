import { useState } from 'react';
import { useSetupStore } from '../stores/setupStore';
import { SetupCheckList } from './SetupCheckList';
import { SetupRepairPanel } from './SetupRepairPanel';
import { SetupProviderConfigStep } from './SetupProviderConfigStep';
import { SetupCommandPreview } from './SetupCommandPreview';
import '../styles/first-run-setup.css';

type Step = 'welcome' | 'check' | 'repair' | 'config' | 'verify' | 'done';

const STEPS: { id: Step; label: string; icon: string }[] = [
  { id: 'welcome', label: '欢迎', icon: '👋' },
  { id: 'check', label: '环境检测', icon: '🔍' },
  { id: 'repair', label: '修复依赖', icon: '🔧' },
  { id: 'config', label: 'API 配置', icon: '🔑' },
  { id: 'verify', label: '验证', icon: '✅' },
  { id: 'done', label: '完成', icon: '🚀' },
];

export function FirstRunSetupWizard() {
  const [step, setStep] = useState<Step>('welcome');
  const snapshot = useSetupStore((s) => s.snapshot);
  const checking = useSetupStore((s) => s.checking);
  const detectAll = useSetupStore((s) => s.detectAll);
  const markDone = useSetupStore((s) => s.markOnboardingCompleted);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const handleStartCheck = async () => {
    setStep('check');
    await detectAll();
  };

  const handleFinish = () => {
    markDone();
    setStep('done');
  };

  const handleVerify = async () => {
    setVerifyResult(null);
    setVerifyError(null);
    setStep('verify');
    const result = await detectAll();
    if (result.ready) {
      setVerifyResult('环境检测通过！所有必需组件已就绪。');
    } else {
      setVerifyError(`环境未完成: ${result.summary}`);
    }
  };

  return (
    <div className="setup-v23-shell">
      <div className="setup-v23-card">
        {/* Stepper */}
        <nav className="setup-v23-stepper">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const completed = i < stepIndex;
            return (
              <button
                key={s.id}
                onClick={() => {
                  if (completed || (i <= stepIndex + 1 && snapshot)) setStep(s.id);
                }}
                disabled={!completed && i > stepIndex + 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)',
                  border: 'none', background: active ? 'var(--cc-surface-solid)' : 'transparent',
                  color: active ? 'var(--cc-text)' : completed ? 'var(--cc-text-muted)' : 'var(--cc-text-soft)',
                  fontWeight: active ? 600 : 400,
                  fontSize: 'var(--cc-font-sm)', cursor: completed || i <= stepIndex + 1 ? 'pointer' : 'default',
                  width: '100%', textAlign: 'left',
                  opacity: completed || active || i <= stepIndex + 1 ? 1 : 0.4,
                }}
              >
                <span>{completed ? '✓' : s.icon}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Main Content */}
        <div className="setup-v23-main">
          {step === 'welcome' && (
            <div>
              <h1>欢迎使用 Ctrl-CC</h1>
              <p className="cc-caption" style={{ marginBottom: 20 }}>
                Ctrl-CC 是 Claude Code CLI 的可视化操作平台，不是 Claude 桌面端应用。
                首次使用前，请完成环境配置向导。
              </p>
              <div style={{
                padding: '16px 20px', borderRadius: 'var(--cc-radius-lg)',
                background: 'var(--cc-surface-solid)', border: '1px solid var(--cc-border)',
                marginBottom: 24,
              }}>
                <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, marginBottom: 8 }}>
                  配置向导将帮助您：
                </h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--cc-font-sm)', color: 'var(--cc-text-muted)', lineHeight: 1.8 }}>
                  <li>检测已有的 Node.js / npm / Git / Claude Code CLI</li>
                  <li>安全安装缺失的依赖</li>
                  <li>配置 API Provider（DeepSeek / 智谱 / MiniMax / 通义千问等）</li>
                  <li>验证 Claude Code CLI 可用性</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleStartCheck} disabled={checking} style={primaryBtnStyle}>
                  {checking ? '检测中...' : '开始配置'}
                </button>
                <button onClick={handleFinish} style={skipBtnStyle}>跳过，稍后配置</button>
              </div>
            </div>
          )}

          {step === 'check' && (
            <div>
              <h1>环境检测</h1>
              <p className="cc-caption" style={{ marginBottom: 20 }}>
                正在检测您的系统环境...
              </p>
              {checking ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--cc-text-muted)' }}>
                  检测中...
                </div>
              ) : snapshot ? (
                <>
                  <SetupCheckList checks={snapshot.checks} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button onClick={() => setStep('repair')} style={primaryBtnStyle}>继续修复</button>
                    {snapshot.ready && <button onClick={() => setStep('config')} style={secondaryBtnStyle}>跳过修复，配置 API</button>}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--cc-red)' }}>检测失败，请重试</div>
              )}
            </div>
          )}

          {step === 'repair' && (
            <div>
              <h1>修复依赖</h1>
              <p className="cc-caption" style={{ marginBottom: 20 }}>
                安装或修复缺失的环境组件。所有操作需要您确认后执行。
              </p>
              <SetupRepairPanel onDone={() => detectAll()} />
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep('check')} style={secondaryBtnStyle}>返回检测</button>
                <button onClick={() => setStep('config')} style={primaryBtnStyle}>继续配置 API</button>
              </div>
            </div>
          )}

          {step === 'config' && (
            <div>
              <h1>API Provider 配置</h1>
              <p className="cc-caption" style={{ marginBottom: 20 }}>
                配置 Claude Code CLI 使用的 API Provider。支持 DeepSeek、智谱 GLM、MiniMax、小米 MiMo、通义千问等。
                API Key 存储在 ~/.claude/settings.json 中。
              </p>
              <SetupProviderConfigStep />
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep('repair')} style={secondaryBtnStyle}>返回修复</button>
                <button onClick={handleVerify} style={primaryBtnStyle}>保存并验证</button>
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div>
              <h1>验证环境</h1>
              <p className="cc-caption" style={{ marginBottom: 20 }}>
                验证 Claude Code CLI 是否可用。
              </p>
              {verifyResult && (
                <div style={{
                  padding: '16px 20px', borderRadius: 'var(--cc-radius-lg)',
                  background: 'var(--cc-green-soft)', border: '1px solid var(--cc-green)',
                  color: 'var(--cc-green)', fontSize: 'var(--cc-font-md)', fontWeight: 600,
                  marginBottom: 16,
                }}>
                  {verifyResult}
                </div>
              )}
              {verifyError && (
                <div style={{
                  padding: '16px 20px', borderRadius: 'var(--cc-radius-lg)',
                  background: 'var(--cc-red-soft)', border: '1px solid var(--cc-red)',
                  color: 'var(--cc-red)', fontSize: 'var(--cc-font-sm)',
                  marginBottom: 16,
                }}>
                  {verifyError}
                  <p style={{ marginTop: 8, color: 'var(--cc-text)' }}>
                    请返回「修复依赖」步骤安装缺失组件，或手动运行以下命令排查：
                  </p>
                  <SetupCommandPreview command="claude --version" label="版本检查" />
                  <div style={{ marginTop: 6 }}>
                    <SetupCommandPreview command="claude doctor" label="诊断" />
                  </div>
                </div>
              )}
              {!verifyResult && !verifyError && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--cc-text-muted)' }}>
                  正在验证...
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep('config')} style={secondaryBtnStyle}>返回配置</button>
                <button onClick={handleFinish} style={primaryBtnStyle}>完成配置</button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', paddingTop: 40 }}>
              <h1>配置完成！</h1>
              <p className="cc-caption" style={{ marginBottom: 24 }}>
                Ctrl-CC 环境已配置完成。您可以开始使用 Claude Code CLI 了。
              </p>
              <div style={{
                display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
              }}>
                <button onClick={handleFinish} style={primaryBtnStyle}>进入 Ctrl-CC</button>
              </div>
              {snapshot && (
                <div style={{ marginTop: 32, textAlign: 'left' }}>
                  <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, marginBottom: 8 }}>环境摘要</h3>
                  <SetupCheckList checks={snapshot.checks} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 28px', fontSize: 'var(--cc-font-sm)', fontWeight: 600,
  border: 'none', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)', color: 'var(--cc-text-inverse)', cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 28px', fontSize: 'var(--cc-font-sm)', fontWeight: 500,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-bg)', color: 'var(--cc-text)', cursor: 'pointer',
};

const skipBtnStyle: React.CSSProperties = {
  padding: '10px 28px', fontSize: 'var(--cc-font-sm)', fontWeight: 400,
  border: '1px solid var(--cc-border)', borderRadius: 'var(--cc-radius-sm)',
  background: 'transparent', color: 'var(--cc-text-muted)', cursor: 'pointer',
};
