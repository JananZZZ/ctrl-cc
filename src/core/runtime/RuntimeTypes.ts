export type RuntimeProviderId = 'claude-code' | 'codex' | 'opencode';

export type RuntimeSessionStatus =
  | 'created'
  | 'idle'
  | 'running'
  | 'waiting-approval'
  | 'failed'
  | 'stopped'
  | 'archived';

export type RuntimeChannelKind = 'chat' | 'terminal' | 'background' | 'activity';

export type RuntimeChannelStatus =
  | 'created'
  | 'starting'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'exited';

export interface RuntimeSessionRecord {
  id: string;
  projectId: string;
  providerId: RuntimeProviderId;
  title: string;
  cwd: string;
  status: RuntimeSessionStatus;
  activeView: 'chat' | 'terminal' | 'split';
  channels: {
    chat?: string;
    terminal?: string;
    background?: string;
    activity?: string;
  };
  providerState: Record<string, unknown>;
  error: RuntimeErrorRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeChannelRecord {
  id: string;
  sessionId: string;
  kind: RuntimeChannelKind;
  status: RuntimeChannelStatus;
  cwd: string;
  pid?: number | null;
  program?: string | null;
  args?: string[];
  error?: RuntimeErrorRecord | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  exitedAt?: string | null;
}

export type RuntimeUiEvent =
  | { id: string; type: 'user_message'; sessionId: string; content: string; createdAt: string }
  | { id: string; type: 'assistant_message'; sessionId: string; content: string; createdAt: string; streaming?: boolean }
  | { id: string; type: 'tool_start'; sessionId: string; toolName: string; input?: unknown; createdAt: string }
  | { id: string; type: 'tool_done'; sessionId: string; toolName: string; output?: unknown; createdAt: string }
  | { id: string; type: 'system'; sessionId: string; level: 'info' | 'warning' | 'error'; content: string; createdAt: string };

export interface RuntimeErrorRecord {
  code:
    | 'COMMAND_NOT_FOUND'
    | 'AUTH_REQUIRED'
    | 'CLI_CRASH'
    | 'SPAWN_FAILED'
    | 'STREAM_PARSE_FAILED'
    | 'PTY_FAILED'
    | 'SETUP_INCOMPLETE'
    | 'UNKNOWN';
  message: string;
  raw?: string;
  fixHint?: string;
}

export interface CreateRuntimeSessionInput {
  providerId: RuntimeProviderId;
  projectId: string;
  projectName?: string;
  cwd: string;
  title?: string;
  viewMode?: 'chat' | 'terminal' | 'split';
}

export interface SendChatInput {
  sessionId: string;
  prompt: string;
  model?: string;
  permissionMode?: string;
  effort?: string;
}

export interface StartTerminalInput {
  sessionId: string;
  cols?: number;
  rows?: number;
}
