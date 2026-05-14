export type CtrlCcSessionId = string;
export type RuntimeChannelId = string;
export type EventLedgerId = string;
export type ClaudeSessionId = string;

export type RuntimeChannelKind = 'chat' | 'terminal' | 'background';

export type RuntimeChannelStatus =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'running'
  | 'waiting-permission'
  | 'stopping'
  | 'stopped'
  | 'exited'
  | 'failed';

export interface CtrlCcSession {
  id: CtrlCcSessionId;
  projectId: string;
  projectName: string;
  cwd: string;
  title: string;

  activeView: 'chat' | 'terminal' | 'split' | 'background';
  claudeSessionId: ClaudeSessionId | null;

  chatChannelId: RuntimeChannelId | null;
  terminalChannelId: RuntimeChannelId | null;
  backgroundChannelId: RuntimeChannelId | null;
  ledgerId: EventLedgerId;

  status: RuntimeChannelStatus;
  error: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface RuntimeChannel {
  id: RuntimeChannelId;
  sessionId: CtrlCcSessionId;
  kind: RuntimeChannelKind;
  status: RuntimeChannelStatus;

  cwd: string;
  pid: number | null;
  program: string | null;
  args: string[];
  error: string | null;

  startedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEventLevel = 'debug' | 'info' | 'warning' | 'error';

export type LedgerEventType =
  | 'session.created'
  | 'session.view.changed'
  | 'chat.request'
  | 'chat.delta'
  | 'chat.message'
  | 'chat.tool'
  | 'chat.done'
  | 'chat.failed'
  | 'terminal.start.request'
  | 'terminal.ready'
  | 'terminal.data'
  | 'terminal.exit'
  | 'terminal.failed'
  | 'background.start'
  | 'background.logs'
  | 'background.attach'
  | 'background.stop'
  | 'permission.request'
  | 'permission.result'
  | 'file.changed'
  | 'git.status'
  | 'runtime.discovery'
  | 'runtime.diagnostics';

export interface LedgerEvent {
  id: string;
  ts: string;
  sessionId: CtrlCcSessionId;
  channelId: RuntimeChannelId | null;
  level: LedgerEventLevel;
  type: LedgerEventType;
  message: string;
  payload?: unknown;
}

export interface ClaudeNativeCandidate {
  path: string;
  source: string;
  exists: boolean;
  executable: boolean;
  versionOk: boolean;
  versionText: string | null;
  printOk: boolean;
  interactiveAllowed: boolean;
  error: string | null;
}
