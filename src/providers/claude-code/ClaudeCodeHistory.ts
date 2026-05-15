export interface ClaudeSessionRecord {
  sessionId: string;
  projectId?: string;
  cwd: string;
  title?: string;
  summary?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export class ClaudeCodeHistory {
  async loadFromDb(): Promise<ClaudeSessionRecord[]> {
    const { invokeCommand } = await import('../../services/invokeCommand');
    try {
      const rows = await invokeCommand<Array<Record<string, unknown>>>('load_sessions_from_db');
      return (rows ?? []).map((r: Record<string, unknown>) => ({
        sessionId: r.id as string,
        projectId: r.projectId as string | undefined,
        cwd: (r.cwd as string) || '.',
        title: r.title as string | undefined,
        summary: r.summary as string | undefined,
        model: r.model as string | undefined,
        inputTokens: (r.inputTokens as number) || 0,
        outputTokens: (r.outputTokens as number) || 0,
        totalCostUsd: (r.totalCostUsd as number) || 0,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string || r.createdAt as string,
      }));
    } catch {
      return [];
    }
  }

  async hydrateSession(sessionId: string): Promise<ClaudeSessionRecord | null> {
    const records = await this.loadFromDb();
    return records.find((r) => r.sessionId === sessionId) ?? null;
  }
}
