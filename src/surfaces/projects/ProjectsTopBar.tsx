import { useTranslation } from 'react-i18next';
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

export function ProjectsTopBar({
  searchQuery, onSearchChange, onCreateProject, onImportProject, onContinueLatest, filterMode, onFilterChange,
}: Props) {
  const { t } = useTranslation();
  const filters: { id: Props['filterMode']; label: string }[] = [
    { id: 'all', label: t('projects.filterAll') },
    { id: 'running', label: t('projects.filterRunning') },
    { id: 'risk', label: t('projects.filterRisk') },
    { id: 'archived', label: t('projects.filterArchived') },
  ];

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
        placeholder={t('projects.searchPlaceholder')}
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
      <CcButton size="sm" onClick={onContinueLatest}>{t('projects.continueLatest')}</CcButton>
      <CcButton size="sm" onClick={onImportProject} variant="ghost">{t('common.import')}</CcButton>
      <CcButton size="sm" variant="primary" onClick={onCreateProject} data-testid="create-project-button">+ {t('projects.newProject')}</CcButton>
    </div>
  );
}
