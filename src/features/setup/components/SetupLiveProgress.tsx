import { useSetupStore } from '../stores/setupStore';

/**
 * 环境检测实时进度组件。
 * 这个组件只订阅 setupStore，不直接调用后端事件。
 * 所有检测进度都由后端 task://progress 推送，再由 setupStore 汇总。
 */
export function SetupLiveProgress() {
  const checking = useSetupStore((s) => s.checking);
  const paused = useSetupStore((s) => s.paused);
  const progress = useSetupStore((s) => s.progress);
  const currentStepLabel = useSetupStore((s) => s.currentStepLabel);
  const currentMessage = useSetupStore((s) => s.currentMessage);
  const detectAll = useSetupStore((s) => s.detectAll);
  const pauseDetection = useSetupStore((s) => s.pauseDetection);
  const resumeDetection = useSetupStore((s) => s.resumeDetection);
  const cancelDetection = useSetupStore((s) => s.cancelDetection);
  const restartDetection = useSetupStore((s) => s.restartDetection);
  const exitApp = useSetupStore((s) => s.exitApp);

  const percent = Math.round(Math.max(0, Math.min(1, progress || 0)) * 100);

  return (
    <div className="setup-live-card">
      <div className="setup-live-header">
        <div>
          <div className={checking && !paused ? 'setup-live-title is-running' : 'setup-live-title'}>
            {paused
              ? '检测已暂停'
              : checking
                ? `正在检测：${currentStepLabel || '准备中'}`
                : currentStepLabel || '环境检测'}
          </div>
          <div className="setup-live-message">
            {currentMessage || '我们会逐项检查你的电脑环境，并在发现问题时给出清晰的修复建议。'}
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="setup-live-bar-track">
        <div
          className="setup-live-bar-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="setup-live-percent">{percent}%</div>

      {/* 操作按钮 */}
      <div className="setup-live-actions">
        {!checking && (
          <button className="cc-btn cc-btn-primary" onClick={() => { detectAll(); }}>
            开始检测
          </button>
        )}
        {checking && !paused && (
          <button className="cc-btn cc-btn-soft" onClick={() => { pauseDetection(); }}>
            暂停检测
          </button>
        )}
        {paused && (
          <button className="cc-btn cc-btn-primary" onClick={() => { resumeDetection(); }}>
            继续检测
          </button>
        )}
        {checking && (
          <button className="cc-btn cc-btn-ghost" onClick={() => { cancelDetection(); }}>
            终止检测
          </button>
        )}
        <button className="cc-btn cc-btn-ghost" onClick={() => { restartDetection(); }}>
          重新检测
        </button>
        <button className="cc-btn cc-btn-ghost" onClick={() => { exitApp(); }}>
          退出软件
        </button>
      </div>
    </div>
  );
}
