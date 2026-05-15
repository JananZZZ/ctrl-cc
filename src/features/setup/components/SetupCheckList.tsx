import type { SetupCheckResult, SetupItemId } from '../types/setupTypes';

interface Props {
  checks: Record<SetupItemId, SetupCheckResult>;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  ok: { label: '已就绪', color: 'var(--cc-green)', dot: '●' },
  warning: { label: '需关注', color: 'var(--cc-amber)', dot: '●' },
  missing: { label: '未安装', color: 'var(--cc-red)', dot: '●' },
  error: { label: '错误', color: 'var(--cc-red)', dot: '●' },
  installing: { label: '安装中', color: 'var(--cc-blue)', dot: '◉' },
  checking: { label: '检测中', color: 'var(--cc-text-muted)', dot: '○' },
  unknown: { label: '未知', color: 'var(--cc-text-soft)', dot: '○' },
};

const itemOrder: SetupItemId[] = [
  'nodejs', 'npm', 'git', 'gitBash', 'claudeCode',
  'claudeAuth', 'claudeConfig', 'powershellPolicy',
  'npmRegistry', 'windowsTerminal', 'pathEnv', 'pathIssues',
  'apiProvider', 'workspace',
];

export function SetupCheckList({ checks }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {itemOrder.map((id) => {
        const item = checks[id];
        if (!item) return null;
        const cfg = statusConfig[item.status] || statusConfig.unknown;
        return (
          <div key={id} className="setup-v23-check-row">
            <span style={{ fontSize: 'var(--cc-font-sm)', fontWeight: 500, color: 'var(--cc-text)' }}>
              {item.label}
              {item.required && <span style={{ color: 'var(--cc-red)', marginLeft: 2 }}>*</span>}
            </span>
            <span style={{
              fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: cfg.color,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>{cfg.dot}</span> {cfg.label}
            </span>
            <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.version ? `v${item.version}` : item.message || item.error || ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
