import { CcButton } from '../../components/ui/CcButton';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCreateProject: () => void;
  onImportProject: () => void;
  onContinueLatest: () => void;
  filterMode: 'all' | 'running' | 'risk' | 'archived';
  onFilterChange: (f: 'all' | 'running' | 'risk' | 'archived') => void;
}

const filters: { id: Props['filterMode']; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'running', label: '运行中' },
  { id: 'risk', label: '有风险' },
  { id: 'archived', label: '已归档' },
];

export function ProjectsTopBar({
  searchQuery, onSearchChange, onCreateProject, onImportProject, onContinueLatest, filterMode, onFilterChange,
}: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
      borderBottom: '1px solid var(--cc-border)', background: 'var(--cc-surface-solid)',
      flexShrink: 0, minHeight: 48,
    }}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="搜索项目、会话、文件、风险..."
        data-testid="projects-search"
        style={{
          flex: 1, height: 32, padding: '0 12px',
          fontSize: 'var(--cc-font-sm)', border: '1px solid var(--cc-border)',
          borderRadius: 'var(--cc-radius-sm)', background: 'var(--cc-bg)',
          color: 'var(--cc-text)', outline: 'none',
        }}
      />
      {filters.map((f) => (
        <button
          key={f.id}
          data-testid={`filter-${f.id}`}
          onClick={() => onFilterChange(f.id)}
          style={{
            height: 28, padding: '0 10px', fontSize: 'var(--cc-font-xs)', fontWeight: filterMode === f.id ? 600 : 400,
            border: 'none', borderRadius: 'var(--cc-radius-xs)',
            background: filterMode === f.id ? 'var(--cc-navy)' : 'transparent',
            color: filterMode === f.id ? 'var(--cc-text-on-accent)' : 'var(--cc-text-muted)',
            cursor: 'pointer',
          }}
        >
          {f.label}
        </button>
      ))}
      <CcButton size="sm" onClick={onContinueLatest}>继续最近</CcButton>
      <CcButton size="sm" onClick={onImportProject} variant="ghost">导入</CcButton>
      <CcButton size="sm" variant="primary" onClick={onCreateProject} data-testid="create-project-button">+ 新建项目</CcButton>
    </div>
  );
}
