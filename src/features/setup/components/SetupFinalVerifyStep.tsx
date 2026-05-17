import { useSetupStore } from '../stores/setupStore';
import { SetupLiveProgress } from './SetupLiveProgress';
import { SetupCheckList } from './SetupCheckList';
import { SetupCommandPreview } from './SetupCommandPreview';

/** v29: 首次启动 — 最终验证步骤 */
export function SetupFinalVerifyStep() {
  const snapshot = useSetupStore((s) => s.snapshot);
  const checking = useSetupStore((s) => s.checking);
  const error = useSetupStore((s) => s.error);
  const detectAll = useSetupStore((s) => s.detectAll);

  return (
    <div className="setup-step-panel">
      <h1>验证环境</h1>
      <p className="cc-body-sm" style={{ marginBottom: 20 }}>
        验证 Claude Code CLI 是否可用。基础检测不消耗 API。
      </p>

      {checking && <SetupLiveProgress />}

      {!checking && snapshot?.ready && (
        <div style={{ padding: '16px 20px', borderRadius: 'var(--cc-radius-lg)', background: 'var(--cc-green-soft)', border: '1px solid var(--cc-green)', color: 'var(--cc-green)', marginBottom: 16 }}>
          环境检测通过！所有必需组件已就绪。
        </div>
      )}

      {!checking && error && (
        <div style={{ padding: '16px 20px', borderRadius: 'var(--cc-radius-lg)', background: 'var(--cc-red-soft)', border: '1px solid var(--cc-red)', color: 'var(--cc-red)', marginBottom: 16 }}>
          {error}
          <div style={{ marginTop: 8 }}>
            <SetupCommandPreview command="claude --version" label="版本检查" />
            <SetupCommandPreview command="claude doctor" label="诊断" />
          </div>
        </div>
      )}

      {!checking && !snapshot?.ready && !error && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <button className="cc-btn cc-btn-primary" onClick={() => { detectAll(); }}>运行验证</button>
        </div>
      )}

      {!checking && snapshot && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 'var(--cc-font-md)', fontWeight: 600, marginBottom: 8 }}>环境摘要</h3>
          <SetupCheckList checks={snapshot.checks} />
        </div>
      )}
    </div>
  );
}
