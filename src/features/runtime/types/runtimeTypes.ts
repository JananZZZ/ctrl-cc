// Canonical RuntimeSession 数据模型 — RuntimeBridge 8.0
// Evidence-first debugging: traceId, ptySessionId, ClaudeSessionId

export type RuntimeMode = 'interactive-pty' | 'structured-print';

export type UiSessionId = string;   // ses-xxx
export type PtySessionId = string;  // pty-{uuid}
export type ClaudeSessionId = string;

export type RuntimeSessionStatus =
  | 'created'
  | 'workspace-opened'
  | 'discovering'
  | 'discovery-failed'
  | 'shell-testing'
  | 'pty-starting'
  | 'pty-ready'
  | 'claude-launching'
  | 'claude-active'
  | 'waiting-permission'
  | 'idle'
  | 'failed'
  | 'exited'
  | 'killed'
  | 'disconnected';

export interface RuntimeSession {
  id: UiSessionId;
  ptySessionId: PtySessionId | null;
  claudeSessionId?: ClaudeSessionId | null;
  traceId: string;
  projectId: string;
  projectName: string;
  cwd: string;
  name: string;
  mode: RuntimeMode;
  status: RuntimeSessionStatus;
  shellStrategy?: string | null;
  claudeCommand?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  exitedAt?: string | null;
}

export interface RuntimeEvent {
  id: string;
  ts: string;
  sessionId?: string;
  projectId?: string;
  type: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  payload?: unknown;
}

export interface StartInteractiveInput {
  projectId: string;
  projectName: string;
  cwd: string;
  mode: 'new' | 'continue' | 'resume' | 'fork';
  sessionName?: string;
  resumeTarget?: string;
  initialPrompt?: string;
}

export function isRuntimeWritable(status: RuntimeSessionStatus): boolean {
  return [
    'pty-ready',
    'claude-launching',
    'claude-active',
    'idle',
    'waiting-permission',
  ].includes(status);
}

