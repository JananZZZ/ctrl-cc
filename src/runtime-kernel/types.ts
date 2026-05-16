export interface RuntimeKernelSessionSnapshot {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  projectId: string;
  cwd: string;
  pid: number | null;
  status: string;
  hasWriter: boolean;
  readerAlive: boolean;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export interface RuntimeKernelEvent {
  traceId: string;
  guiSessionId: string;
  runtimeProcessId: string;
  eventType: string;
  status?: string | null;
  data?: string | null;
  message?: string | null;
  pid?: number | null;
  cwd?: string | null;
  createdAt: string;
}

export interface KernelChatMessage {
  id: string;
  sessionId: string;
  projectId: string;
  type: 'user_message' | 'assistant_message' | 'system' | 'thinking' | 'raw';
  content: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
}
