import type { ChatRuntime, RuntimeSession, SendMessageInput } from '../../core/runtime/ChatRuntime';
import type { CreateSessionInput } from '../../core/runtime/ChatRuntime';

export class ClaudeCodeRuntime implements ChatRuntime {
  providerId = 'claude-code';
  private sessions = new Map<string, RuntimeSession>();

  async createSession(_input: CreateSessionInput): Promise<RuntimeSession> {
    const session: RuntimeSession = {
      id: `claude-${crypto.randomUUID()}`,
      providerId: this.providerId,
      projectId: _input.projectId,
      cwd: _input.cwd,
      status: 'idle',
      providerState: {},
    };
    this.sessions.set(session.id, session);
    return session;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_input: SendMessageInput): Promise<void> {
    // Delegates to backend runtime_start_chat_stream via bridge
  }

  async cancel(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async resume(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) session.status = 'running';
  }

  async fork(sessionId: string): Promise<RuntimeSession> {
    const original = this.sessions.get(sessionId);
    if (!original) throw new Error(`Session not found: ${sessionId}`);
    return this.createSession({
      projectId: original.projectId,
      cwd: original.cwd,
    });
  }

  async compact(_sessionId: string): Promise<void> {
    // CLI-level compaction — not implemented at provider level
  }

  async dispose(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
