export type RuntimeKernelStatus =
  | 'starting'
  | 'ready'
  | 'busy'
  | 'waiting-input'
  | 'waiting-permission'
  | 'exited'
  | 'failed'
  | 'stopped';

export interface RuntimeKernelEvent {
  seq: number;
  traceId: string;
  guiSessionId: string;
  runtimeSessionId: string;
  eventType: string;
  channel: 'raw' | 'status' | 'error' | 'lifecycle';
  data?: string | null;
  status?: RuntimeKernelStatus | null;
  pid?: number | null;
  cwd?: string | null;
  createdAt: string;
}

export interface RuntimeKernelSessionSnapshot {
  traceId: string;
  guiSessionId: string;
  runtimeSessionId: string;
  claudeSessionId?: string | null;
  projectId: string;
  cwd: string;
  pid?: number | null;
  status: RuntimeKernelStatus;
  hasWriter: boolean;
  readerAlive: boolean;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
}

export type ChatBlock =
  | { id: string; kind: 'user'; content: string; createdAt: string }
  | { id: string; kind: 'assistant'; content: string; streaming: boolean; createdAt: string; updatedAt: string }
  | { id: string; kind: 'status'; label: string; content: string; createdAt: string }
  | { id: string; kind: 'tool'; name: string; content: string; createdAt: string }
  | { id: string; kind: 'error'; content: string; createdAt: string }
  | { id: string; kind: 'thinking'; content: string; createdAt: string }
  | { id: string; kind: 'permission'; rule: string; approved?: boolean; createdAt: string }
  | { id: string; kind: 'file_change'; path: string; action: string; diff?: string; createdAt: string };

// Legacy compat
export type KernelChatMessage = ChatBlock;
