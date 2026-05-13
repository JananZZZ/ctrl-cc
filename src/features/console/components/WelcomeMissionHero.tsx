import React from 'react';

interface WelcomeMissionHeroProps {
  userName?: string;
  runtimeReady: boolean;
  recommendedAction?: 'continue' | 'new' | 'diagnostics';
  onNewSession?: () => void;
  onContinueSession?: () => void;
  onRunDiagnostics?: () => void;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 18) return '下午好';
  return '晚上好';
}

function getStatusIndicator(ready: boolean): {
  className: string;
  label: string;
} {
  if (ready) {
    return { className: 'cc-status-running', label: '就绪' };
  }
  return { className: 'cc-status-idle', label: '待命' };
}

const dotBase: React.CSSProperties = {
  display: 'inline-block',
  width: '10px',
  height: '10px',
  borderRadius: 'var(--cc-radius-full)',
  marginRight: 'var(--cc-space-2)',
};

export function WelcomeMissionHero({
  userName,
  runtimeReady,
  recommendedAction = 'new',
  onNewSession,
  onContinueSession,
  onRunDiagnostics,
}: WelcomeMissionHeroProps) {
  const greeting = getTimeGreeting();
  const status = getStatusIndicator(runtimeReady);

  return (
    <section
      className="cc-card"
      style={{
        borderTop: '3px solid var(--cc-brand)',
        padding: 'var(--cc-card-padding)',
        marginBottom: 'var(--cc-space-6)',
      }}
    >
      <div style={{ marginBottom: 'var(--cc-space-4)' }}>
        <h2
          style={{
            fontFamily: 'var(--cc-font-sans)',
            fontSize: 'var(--cc-font-2xl)',
            fontWeight: 'var(--cc-font-semibold)',
            lineHeight: 'var(--cc-leading-tight)',
            color: 'var(--cc-text)',
            marginBottom: 'var(--cc-space-2)',
          }}
        >
          {greeting}{userName ? `，${userName}` : ''}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--cc-font-sans)',
            fontSize: 'var(--cc-font-sm)',
            color: 'var(--cc-text-muted)',
          }}
        >
          <span className={status.className} style={dotBase} />
          Runtime {status.label}
          <span
            style={{
              margin: '0 var(--cc-space-2)',
              color: 'var(--cc-border-strong)',
            }}
          >
            |
          </span>
          v9.0 Industrial Runtime
        </div>
      </div>

      <p
        style={{
          fontFamily: 'var(--cc-font-sans)',
          fontSize: 'var(--cc-font-md)',
          lineHeight: 'var(--cc-leading-relaxed)',
          color: 'var(--cc-text-muted)',
          marginBottom: 'var(--cc-space-5)',
        }}
      >
        {recommendedAction === 'continue'
          ? '你有未完成的会话，建议继续之前的工作。'
          : recommendedAction === 'diagnostics'
            ? '检测到异常状态，建议运行诊断检查。'
            : '一切就绪，开始一个新的会话吧。'}
      </p>

      <div style={{ display: 'flex', gap: 'var(--cc-space-3)', flexWrap: 'wrap' }}>
        <button
          className="cc-button cc-button-primary"
          onClick={onNewSession}
        >
          + 新建会话
        </button>
        <button
          className="cc-button cc-button-soft"
          onClick={onContinueSession}
          disabled={recommendedAction !== 'continue'}
        >
          &#x21A9; 继续上次
        </button>
        <button
          className="cc-button cc-button-ghost"
          onClick={onRunDiagnostics}
          disabled={!runtimeReady}
        >
          &#x2699; 运行诊断
        </button>
      </div>
    </section>
  );
}
