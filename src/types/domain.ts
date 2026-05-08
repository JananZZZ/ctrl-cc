// Core domain types — single source of truth for all Ctrl-CC data models

export type RuntimeMode = 'pty-interactive' | 'structured-print';

export type SurfaceId = 'console' | 'projects' | 'workspace' | 'resources' | 'canvas' | 'github' | 'settings';

export type SessionStatus = 'created' | 'starting' | 'running' | 'waiting' | 'paused' | 'completed' | 'failed' | 'stopped' | 'archived';

export type PtyStatus = 'idle' | 'starting' | 'running' | 'exited' | 'failed' | 'killed';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'auto' | 'dontAsk' | 'bypassPermissions';

export type DockMode = 'quiet' | 'calm' | 'focus';

export type RuntimeEventType =
  | 'user_message' | 'assistant_message' | 'assistant_delta' | 'terminal_raw_output'
  | 'command_started' | 'command_output' | 'command_completed' | 'command_failed'
  | 'file_read' | 'file_created' | 'file_edited' | 'file_deleted' | 'file_diff'
  | 'permission_requested' | 'permission_resolved' | 'risk_detected'
  | 'hook_event' | 'mcp_tool' | 'agent_started' | 'agent_completed'
  | 'token_usage' | 'cost_update' | 'summary' | 'error'
  | 'tool_use' | 'tool_result' | 'thinking' | 'thinking_delta'
  | 'system_init' | 'raw_stderr';

export interface WorkspaceRoot {
  id: string;
  path: string;
  label: string;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceRootId: string;
  name: string;
  path: string;
  gitBranch?: string;
  description?: string;
  isFavorite: boolean;
  isArchived: boolean;
  activeSessionCount: number;
  totalSessionCount: number;
  pendingPermissionCount: number;
  riskCount: number;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  runtimeMode: RuntimeMode;
  status: SessionStatus;
  model: string;
  effort?: string;
  permissionMode: PermissionMode;
  claudeSessionId?: string;
  summary?: string;
  cwd: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  fileChangeCount: number;
  riskCount: number;
  auditCount: number;
  isPinned: boolean;
  viewMode?: 'chat' | 'terminal' | 'split';
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface OpenSessionTab {
  sessionId: string;
  projectId: string;
  projectName: string;
  title: string;
  status: SessionStatus;
  ptyStatus?: PtyStatus;
  viewMode: 'chat' | 'terminal' | 'split';
  pendingConfirms: number;
  riskCount: number;
  isPinned: boolean;
}

export interface PtySessionInfo {
  id: string;
  sessionId: string;
  projectId: string;
  cwd: string;
  command: string[];
  rows: number;
  cols: number;
  status: PtyStatus;
  pid?: number;
  createdAt: string;
}

export interface RuntimeEvent {
  id: string;
  sessionId: string;
  projectId: string;
  type: RuntimeEventType;
  title?: string;
  content: string;
  payload?: unknown;
  severity: RiskLevel;
  createdAt: string;
  toolName?: string;
  toolInput?: unknown;
  toolUseId?: string;
  isError?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalCostUsd?: number;
  durationMs?: number;
}

export interface AuditLog {
  id: string;
  projectId?: string;
  sessionId?: string;
  actor: 'user' | 'system' | 'auto_trust';
  action: string;
  target?: string;
  riskLevel: RiskLevel;
  beforeState?: string;
  afterState?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface RiskItem {
  id: string;
  projectId?: string;
  sessionId?: string;
  eventId?: string;
  level: RiskLevel;
  category: string;
  title: string;
  detail?: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface FileChange {
  id: string;
  projectId?: string;
  sessionId?: string;
  filePath: string;
  changeType: 'created' | 'edited' | 'deleted';
  beforeHash?: string;
  afterHash?: string;
  diff?: string;
  createdAt: string;
}

export interface ResourceItem {
  id: string;
  type: 'skill' | 'agent' | 'mcp' | 'hook' | 'plugin' | 'claude_md' | 'memory' | 'slash_command' | 'permission_rule' | 'output_style';
  name: string;
  source: 'user' | 'project' | 'local' | 'plugin';
  path?: string;
  enabled: boolean;
  riskLevel: RiskLevel;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AppSettings {
  language: string;
  theme: 'light' | 'dark';
  startupView: SurfaceId;
  claudeCliPath?: string;
  defaultModel: string;
  defaultEffort: string;
  defaultPermissionMode: PermissionMode;
  defaultRuntimeMode: RuntimeMode;
  autoTrustLevel: number;
  firstRunCompleted: boolean;
  terminalFontSize: number;
  terminalFontFamily: string;
  rawLogRetentionDays: number;
}
