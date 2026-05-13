import React from 'react';

interface RuntimeActionRibbonProps {
  projectId: string;
  hasActiveSession: boolean;
  activeSessionId?: string;
  onNewSession: () => void;
  onContinueSession?: () => void;
  onResumeSession?: () => void;
  onForkSession?: () => void;
  onRunDoctor?: () => void;
  onRunCost?: () => void;
  onOpenClaudeMd?: () => void;
}

interface RibbonButton {
  key: string;
  icon: string;
  label: string;
  onClick: (() => void) | undefined;
  disabled: boolean;
  disabledReason?: string;
  accent: boolean;
}

export function RuntimeActionRibbon({
  onNewSession,
  onContinueSession,
  onResumeSession,
  onForkSession,
  onRunDoctor,
  onRunCost,
  onOpenClaudeMd,
  hasActiveSession,
}: RuntimeActionRibbonProps) {
  const buttons: RibbonButton[] = [
    {
      key: 'new',
      icon: '➕',
      label: '+ 新建',
      onClick: onNewSession,
      disabled: false,
      accent: true,
    },
    {
      key: 'continue',
      icon: '▶',
      label: '继续',
      onClick: onContinueSession,
      disabled: !hasActiveSession || !onContinueSession,
      disabledReason: !hasActiveSession ? '没有活跃会话' : undefined,
      accent: false,
    },
    {
      key: 'resume',
      icon: '↩',
      label: '恢复',
      onClick: onResumeSession,
      disabled: !hasActiveSession || !onResumeSession,
      disabledReason: !hasActiveSession ? '没有活跃会话' : undefined,
      accent: false,
    },
    {
      key: 'fork',
      icon: '⑂',
      label: '分支',
      onClick: onForkSession,
      disabled: !hasActiveSession || !onForkSession,
      disabledReason: !hasActiveSession ? '没有活跃会话' : undefined,
      accent: false,
    },
    {
      key: 'doctor',
      icon: '⚕',
      label: '/doctor',
      onClick: onRunDoctor,
      disabled: !hasActiveSession || !onRunDoctor,
      disabledReason: !hasActiveSession ? '需要活跃会话' : undefined,
      accent: false,
    },
    {
      key: 'cost',
      icon: '¢',
      label: '/cost',
      onClick: onRunCost,
      disabled: !hasActiveSession || !onRunCost,
      disabledReason: !hasActiveSession ? '需要活跃会话' : undefined,
      accent: false,
    },
    {
      key: 'claudemd',
      icon: '\u{1F4C4}',
      label: 'CLAUDE.md',
      onClick: onOpenClaudeMd,
      disabled: !onOpenClaudeMd,
      accent: false,
    },
  ];

  return (
    <div style={ribbonStyle} role="toolbar" aria-label="Runtime 操作工具栏">
      {buttons.map((btn) => (
        <button
          key={btn.key}
          onClick={btn.onClick}
          disabled={btn.disabled}
          style={btn.disabled ? btnDisabledStyle : btn.accent ? btnAccentStyle : btnNormalStyle}
          title={btn.disabled ? btn.disabledReason ?? btn.label : btn.label}
        >
          <span style={iconStyle}>{btn.icon}</span>
          <span>{btn.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const ribbonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-1)',
  padding: 'var(--cc-space-2) var(--cc-space-3)',
  background: 'var(--cc-surface)',
  borderBottom: '1px solid var(--cc-border)',
  flexWrap: 'wrap',
};

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 30,
  padding: '0 10px',
  border: '1px solid transparent',
  borderRadius: 'var(--cc-radius-sm)',
  fontSize: 'var(--cc-font-xs)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity var(--cc-duration-fast)',
};

const btnNormalStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--cc-text)',
  borderColor: 'var(--cc-border)',
};

const btnAccentStyle: React.CSSProperties = {
  ...btnBase,
  background: 'var(--cc-brand)',
  color: 'var(--cc-text-inverse)',
  borderColor: 'var(--cc-brand-strong)',
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnBase,
  background: 'transparent',
  color: 'var(--cc-text-muted)',
  borderColor: 'var(--cc-border)',
  cursor: 'not-allowed',
  opacity: 0.45,
};

const iconStyle: React.CSSProperties = {
  fontSize: 'var(--cc-font-md)',
  lineHeight: 1,
};
