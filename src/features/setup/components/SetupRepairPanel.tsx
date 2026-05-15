import { useState } from 'react';
import { useSetupStore } from '../stores/setupStore';
import { SetupCommandPreview } from './SetupCommandPreview';
import { TaskProgressCard } from './TaskProgressCard';
import { SetupSafeConfirmDialog } from './SetupSafeConfirmDialog';

interface Props {
  onDone?: () => void;
}

export function SetupRepairPanel({ onDone }: Props) {
  const snapshot = useSetupStore((s) => s.snapshot);
  const tasks = useSetupStore((s) => s.tasks);
  const installClaude = useSetupStore((s) => s.installClaudeCodeCli);
  const fixPowershell = useSetupStore((s) => s.fixPowershellPolicy);
  const setNpmMirror = useSetupStore((s) => s.setNpmMirror);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  if (!snapshot) return null;

  const checks = snapshot.checks;
  const missing = Object.values(checks).filter((c) => c.required && !c.ok);
  const warnings = Object.values(checks).filter((c) => !c.required && !c.ok);

  const doAction = async (action: string) => {
    setError(null);
    setRunning(action);
    try {
      switch (action) {
        case 'install-claude':
          await installClaude();
          break;
        case 'fix-powershell':
          await fixPowershell();
          break;
        case 'set-npm-mirror':
          await setNpmMirror();
          break;
      }
      onDone?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(null);
      setConfirmAction(null);
    }
  };

  const activeTasks = Object.values(tasks).filter(
    (t) => t.status === 'running' || t.status === 'queued'
  );

  return (
    <div>
      {missing.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-red)', marginBottom: 10 }}>
            缺少 {missing.length} 个必需组件
          </h4>
          {missing.map((m) => (
            <div key={m.id} style={{
              padding: '10px 14px', marginBottom: 8,
              borderRadius: 'var(--cc-radius-md)',
              background: 'var(--cc-surface-solid)',
              border: '1px solid var(--cc-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-text)' }}>
                    {m.label}
                  </span>
                  {m.fixHint && (
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
                      {m.fixHint}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {m.id === 'claudeCode' && (
                    <button
                      onClick={() => setConfirmAction('install-claude')}
                      disabled={running === 'install-claude'}
                      style={actionBtnStyle}
                    >
                      {running === 'install-claude' ? '安装中...' : '安装'}
                    </button>
                  )}
                  {m.id === 'powershellPolicy' && (
                    <button
                      onClick={() => setConfirmAction('fix-powershell')}
                      disabled={running === 'fix-powershell'}
                      style={actionBtnStyle}
                    >
                      {running === 'fix-powershell' ? '修复中...' : '修复'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 600, color: 'var(--cc-amber)', marginBottom: 10 }}>
            建议修复 ({warnings.length})
          </h4>
          {warnings.map((w) => (
            <div key={w.id} style={{
              padding: '10px 14px', marginBottom: 8,
              borderRadius: 'var(--cc-radius-md)',
              background: 'var(--cc-surface-solid)',
              border: '1px solid var(--cc-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 500, color: 'var(--cc-text)' }}>
                    {w.label}
                  </span>
                  {w.fixHint && (
                    <p style={{ margin: '4px 0 0', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
                      {w.fixHint}
                    </p>
                  )}
                </div>
                {w.id === 'npmRegistry' && (
                  <button
                    onClick={() => setConfirmAction('set-npm-mirror')}
                    disabled={running === 'set-npm-mirror'}
                    style={actionBtnStyle}
                  >
                    {running === 'set-npm-mirror' ? '设置中...' : '修复'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {missing.length === 0 && warnings.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 32,
          color: 'var(--cc-green)', fontSize: 'var(--cc-font-md)',
        }}>
          所有必需组件已就绪！
        </div>
      )}

      {activeTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {activeTasks.map((t) => (
            <TaskProgressCard key={t.taskId} task={t} />
          ))}
        </div>
      )}

      {error && (
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--cc-radius-sm)',
          background: 'var(--cc-red-soft)', color: 'var(--cc-red)',
          fontSize: 'var(--cc-font-xs)', marginBottom: 12,
        }}>
          {error}
        </div>
      )}

      <SetupCommandPreview
        label="手动安装 Claude Code CLI"
        command="npm install -g @anthropic-ai/claude-code@latest"
      />

      <SetupSafeConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction === 'install-claude' ? '安装 Claude Code CLI' :
          confirmAction === 'fix-powershell' ? '修复 PowerShell 执行策略' :
          '设置 npm 镜像源'
        }
        message={
          confirmAction === 'install-claude'
            ? '将使用 npm 全局安装 @anthropic-ai/claude-code。此操作会修改全局 npm 目录，需要 Node.js 和 npm 已安装。'
            : confirmAction === 'fix-powershell'
            ? '将设置 PowerShell CurrentUser 执行策略为 RemoteSigned。此操作需要管理员权限。'
            : '将 npm registry 设置为 npmmirror.com 镜像源。'
        }
        confirmLabel="确认执行"
        onConfirm={() => confirmAction && doAction(confirmAction)}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '4px 14px', fontSize: 'var(--cc-font-xs)', fontWeight: 600,
  border: '1px solid var(--cc-brand)', borderRadius: 'var(--cc-radius-sm)',
  background: 'var(--cc-brand)', color: 'var(--cc-text-inverse)', cursor: 'pointer',
};
