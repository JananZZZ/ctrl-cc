export type SetupStatus = 'ok' | 'warning' | 'missing' | 'error' | 'checking' | 'installing';

export type SetupItemId =
  | 'nodejs'
  | 'npm'
  | 'git'
  | 'gitBash'
  | 'claudeCode'
  | 'claudeCommand'
  | 'claudeAuth'
  | 'claudeConfig'
  | 'windowsTerminal'
  | 'powershellPolicy'
  | 'npmRegistry'
  | 'pathEnv'
  | 'pathIssues'
  | 'workspace'
  | 'apiProvider';

export interface SetupCheckResult {
  id: SetupItemId;
  label: string;
  status: SetupStatus;
  installed: boolean;
  ok: boolean;
  required: boolean;
  version?: string;
  latestVersion?: string;
  outdated?: boolean;
  paths: string[];
  method?: string;
  message?: string;
  error?: string;
  fixHint?: string;
  details?: Record<string, unknown>;
}

export interface ClaudeCommandCapability {
  id: string;
  label: string;
  program: string;
  argsPrefix: string[];
  kind: 'nativeExe' | 'cmdShim' | 'powershellShim' | 'gitBash' | 'npmShim' | 'npxDiagnostic' | 'unknown';
  source: string;
  versionOk: boolean;
  versionText?: string | null;
  printOk: boolean;
  interactivePtyOk: boolean;
  selectableForChat: boolean;
  selectableForTerminal: boolean;
  recommendedForChat: boolean;
  recommendedForTerminal: boolean;
  error?: string | null;
}

export interface SetupSnapshot {
  generatedAt: string;
  ready: boolean;
  severity: 'ok' | 'warning' | 'error';
  summary: string;
  checks: Record<SetupItemId, SetupCheckResult>;
  claudeCommands: ClaudeCommandCapability[];
  selectedChatCommandId: string | null;
  selectedTerminalCommandId: string | null;
}

export type SetupTaskStatus = 'queued' | 'running' | 'complete' | 'error' | 'cancelled';

export interface SetupTaskProgress {
  taskId: string;
  actionId: string;
  status: SetupTaskStatus;
  step: string;
  progress: number;
  message: string;
  error?: string;
  updatedAt: string;
}

export interface SetupAction {
  id: string;
  label: string;
  description: string;
  target: SetupItemId | 'all' | 'provider';
  kind: 'detect' | 'install' | 'repair' | 'configure' | 'verify' | 'openExternal' | 'copyCommand';
  commandPreview?: string;
  safeLevel: 'safe' | 'needs-confirmation' | 'admin-required' | 'manual-only';
  destructive: boolean;
}
