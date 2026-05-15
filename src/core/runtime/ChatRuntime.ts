export interface CreateSessionInput {
  projectId: string;
  projectName?: string;
  cwd: string;
  title?: string;
  model?: string;
  permissionMode?: string;
  effort?: string;
}

export interface SendMessageInput {
  sessionId: string;
  prompt: string;
  model?: string;
  permissionMode?: string;
  effort?: string;
  maxTurns?: number | null;
}

export interface RuntimeSession {
  id: string;
  providerId: string;
  projectId: string;
  cwd: string;
  status: 'idle' | 'running' | 'waiting-approval' | 'failed' | 'stopped';
  providerState: Record<string, unknown>;
}

export interface ChatRuntime {
  providerId: string;
  createSession(input: CreateSessionInput): Promise<RuntimeSession>;
  send(input: SendMessageInput): Promise<void>;
  cancel(sessionId: string): Promise<void>;
  resume(sessionId: string): Promise<void>;
  fork(sessionId: string): Promise<RuntimeSession>;
  compact(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
}
