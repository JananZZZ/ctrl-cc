export type DockMode = 'quiet' | 'calm' | 'focus';

export interface DockSnapshot {
  generatedAt: string;
  mode: DockMode;
  runtime: {
    activeSessionCount: number;
    runningCount: number;
    errorCount: number;
    warningCount: number;
  };
  activeSession?: {
    id: string;
    title: string;
    status: string;
    cwd: string;
  } | null;
}
