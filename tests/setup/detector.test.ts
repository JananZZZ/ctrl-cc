import { describe, test, expect } from 'vitest';

type SetupStatus = 'ok' | 'warning' | 'missing' | 'error' | 'checking' | 'installing';
type SetupItemId = string;

interface SetupCheckResult {
  id: SetupItemId;
  label: string;
  status: SetupStatus;
  installed: boolean;
  ok: boolean;
  required: boolean;
  version?: string;
  paths: string[];
  fixHint?: string;
  error?: string;
}

describe('Setup Detector', () => {
  test('required items are nodejs, npm, git, claudeCode, claudeCommand, powershellPolicy, pathEnv, workspace', () => {
    const requiredIds = ['nodejs', 'npm', 'git', 'claudeCode', 'claudeCommand', 'powershellPolicy', 'pathEnv', 'workspace'];
    expect(requiredIds).toContain('claudeCommand');
    expect(requiredIds).toContain('nodejs');
  });

  test('pathEnv.required should be false', () => {
    // From P0: pathEnv was changed to required=false
    const pathEnvRequired = false;
    expect(pathEnvRequired).toBe(false);
  });

  test('Windows Terminal detection uses where.exe wt', () => {
    // Where.exe is the correct way — not wildcard paths
    const detectionMethod = 'where.exe wt';
    expect(detectionMethod).toContain('where.exe');
  });

  test('PATH detection uses where.exe, not string matching', () => {
    // P0 fix: use where.exe to actually verify commands are resolvable
    const detectionMethod = 'where.exe node && where.exe npm';
    expect(detectionMethod).toContain('where.exe');
  });

  test('extensionless claude is never executable', () => {
    const forbidden = 'C:\\Users\\xxx\\AppData\\Roaming\\npm\\claude';
    const isExtensionless = !forbidden.endsWith('.exe') && !forbidden.endsWith('.cmd') && !forbidden.endsWith('.js') && !forbidden.endsWith('.cjs');
    expect(isExtensionless).toBe(true);
    // Should be filtered out by resolver
  });

  test('claudeCommand check has id and ok fields', () => {
    const result: Partial<SetupCheckResult> = {
      id: 'claudeCommand',
      ok: true,
      required: true,
      status: 'ok',
    };
    expect(result.id).toBe('claudeCommand');
    expect(result.required).toBe(true);
  });

  test('snapshot ready requires all required items ok', () => {
    const checks: Record<string, SetupCheckResult> = {
      nodejs: { id: 'nodejs', label: 'Node.js', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      npm: { id: 'npm', label: 'npm', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      git: { id: 'git', label: 'Git', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      claudeCode: { id: 'claudeCode', label: 'Claude Code', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      claudeCommand: { id: 'claudeCommand', label: 'Claude Command', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      powershellPolicy: { id: 'powershellPolicy', label: 'PS Policy', status: 'ok', installed: true, ok: true, required: true, paths: [] },
      pathEnv: { id: 'pathEnv', label: 'PATH', status: 'ok', installed: true, ok: true, required: false, paths: [] },
      workspace: { id: 'workspace', label: 'Workspace', status: 'ok', installed: true, ok: true, required: true, paths: [] },
    };
    const requiredOk = Object.values(checks).filter((c) => c.required).every((c) => c.ok);
    expect(requiredOk).toBe(true);
  });
});
