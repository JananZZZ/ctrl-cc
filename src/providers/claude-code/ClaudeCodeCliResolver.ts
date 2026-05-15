export interface ResolvedCliEntry {
  id: string;
  kind: 'nativeExe' | 'nodeWrapper' | 'cmdShim' | 'gitBash' | 'npxDiagnostic' | 'unknown';
  program: string;
  argsPrefix: string[];
  versionOk: boolean;
  versionText: string | null;
  error: string | null;
}

export class ClaudeCodeCliResolver {
  async discover(): Promise<ResolvedCliEntry[]> {
    const { invokeCommand } = await import('../../services/invokeCommand');
    try {
      const entries = await invokeCommand<ResolvedCliEntry[]>('runtime_discover_claude_commands');
      return entries ?? [];
    } catch {
      return [];
    }
  }

  async selectForChat(): Promise<ResolvedCliEntry> {
    const entries = await this.discover();
    const usable = entries.filter((e) => e.versionOk && e.kind !== 'npxDiagnostic');
    if (usable.length === 0) throw new Error('No usable Claude CLI entry found');
    const priority: Record<string, number> = { nativeExe: 0, nodeWrapper: 1, cmdShim: 2, gitBash: 3 };
    usable.sort((a, b) => (priority[a.kind] ?? 99) - (priority[b.kind] ?? 99));
    return usable[0];
  }
}
