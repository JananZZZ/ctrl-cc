import React from 'react';

interface ProjectHeroProps {
  projectName: string;
  projectPath: string;
  gitBranch?: string;
  gitDirty: boolean;
  claudeReady: boolean;
  runningSessions: number;
  lastActivity?: string;
  onNewSession: () => void;
  onContinueSession?: () => void;
  onOpenWorkspace?: () => void;
}

export function ProjectHero({
  projectName,
  projectPath,
  gitBranch,
  gitDirty,
  claudeReady,
  runningSessions,
  lastActivity,
  onNewSession,
  onContinueSession,
  onOpenWorkspace,
}: ProjectHeroProps) {
  return (
    <section style={heroStyle} aria-label="Project Overview">
      <div style={topRowStyle}>
        <div style={nameBlockStyle}>
          <h1 style={projectNameHeadingStyle}>{projectName}</h1>
          <span style={pathMonoStyle}>{projectPath}</span>
        </div>
        <div style={infoPillsStyle}>
          {gitBranch && (
            <span style={gitPillStyle}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {gitBranch}
              {gitDirty && (
                <span style={dirtyDotStyle} title="Uncommitted changes">
                  &bull;
                </span>
              )}
            </span>
          )}
          <span style={claudeReady ? readyPillStyle : notReadyPillStyle}>
            <span
              style={{
                ...pillDotStyle,
                background: claudeReady ? 'var(--cc-green)' : 'var(--cc-text-soft)',
              }}
            />
            {claudeReady ? 'Claude Available' : 'Claude Not Ready'}
          </span>
          <span style={sessionsPillStyle}>
            <span
              style={{
                ...pillDotStyle,
                background: runningSessions > 0 ? 'var(--cc-green)' : 'var(--cc-text-soft)',
              }}
            />
            Running {runningSessions}
          </span>
          {lastActivity && (
            <span style={lastActivityStyle}>{lastActivity}</span>
          )}
        </div>
      </div>
      <div style={actionsRowStyle}>
        <button onClick={onNewSession} style={btnPrimaryStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Claude Session
        </button>
        {onContinueSession && (
          <button onClick={onContinueSession} style={btnSecondaryStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 3 19 12 5 21 5 3" />
            </svg>
            Continue Last
          </button>
        )}
        {onOpenWorkspace && (
          <button onClick={onOpenWorkspace} style={btnGhostStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
            Open Workspace
          </button>
        )}
      </div>
    </section>
  );
}

const heroStyle: React.CSSProperties = {
  padding: 'var(--cc-space-6) var(--cc-space-6) var(--cc-space-5)',
  background: 'var(--cc-surface)',
  borderBottom: '1px solid var(--cc-border)',
};

const topRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 'var(--cc-space-4)',
  marginBottom: 'var(--cc-space-4)',
  flexWrap: 'wrap',
};

const nameBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  flex: 1,
};

const projectNameHeadingStyle: React.CSSProperties = {
  fontSize: 'var(--cc-font-xl)',
  fontWeight: 600,
  color: 'var(--cc-text)',
  lineHeight: 'var(--cc-leading-tight)',
  margin: 0,
};

const pathMonoStyle: React.CSSProperties = {
  fontSize: 'var(--cc-font-sm)',
  fontFamily: 'var(--cc-font-mono)',
  color: 'var(--cc-text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const infoPillsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-2)',
  flexWrap: 'wrap',
  flexShrink: 0,
};

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 26,
  padding: '0 10px',
  borderRadius: 'var(--cc-radius-full)',
  fontSize: 'var(--cc-font-xs)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  whiteSpace: 'nowrap',
};

const pillDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  flexShrink: 0,
};

const gitPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--cc-blue-soft)',
  color: 'var(--cc-blue)',
};

const dirtyDotStyle: React.CSSProperties = {
  color: 'var(--cc-amber)',
  fontSize: 'var(--cc-font-lg)',
  lineHeight: 1,
  marginLeft: -3,
};

const readyPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--cc-green-soft)',
  color: 'var(--cc-green)',
};

const notReadyPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--cc-surface-muted)',
  color: 'var(--cc-text-muted)',
};

const sessionsPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--cc-surface-muted)',
  color: 'var(--cc-text)',
};

const lastActivityStyle: React.CSSProperties = {
  fontSize: 'var(--cc-font-xs)',
  color: 'var(--cc-text-muted)',
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--cc-space-2)',
  flexWrap: 'wrap',
};

const btnPrimaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  border: 'none',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)',
  color: 'var(--cc-text-inverse)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
};

const btnSecondaryStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  border: '1px solid var(--cc-border)',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-surface-solid)',
  color: 'var(--cc-text)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
};

const btnGhostStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  border: '1px solid transparent',
  borderRadius: 'var(--cc-radius-sm)',
  background: 'transparent',
  color: 'var(--cc-text-muted)',
  fontSize: 'var(--cc-font-sm)',
  fontWeight: 500,
  fontFamily: 'var(--cc-font-sans)',
  cursor: 'pointer',
};
