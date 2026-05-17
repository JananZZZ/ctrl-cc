import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../stores/projectStore';
import { CcStatusDot } from '../../components/ui/CcStatusDot';
import type { Project } from '../../types';

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  searchQuery: string;
}

export function ProjectManagementRail({ collapsed, onToggleCollapse, selectedProjectId, onSelectProject, searchQuery }: Props) {
  const { t } = useTranslation();
  const { projects, roots } = useProjectStore();

  const filtered = useMemo(
    () => searchQuery
      ? projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.path.toLowerCase().includes(searchQuery.toLowerCase()))
      : projects,
    [projects, searchQuery],
  );

  const active = useMemo(() => filtered.filter((p) => p.activeSessionCount > 0), [filtered]);
  const withRisks = useMemo(() => filtered.filter((p) => p.riskCount > 0), [filtered]);

  if (collapsed) {
    return (
      <div style={{ width: 32, borderRight: '1px solid var(--cc-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8 }}>
        <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>&#x25B6;</button>
      </div>
    );
  }

  return (
    <div className="project-management-rail" data-testid="project-management-rail" style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--cc-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <RailHeader title={t('projects.title')} onCollapse={onToggleCollapse} count={filtered.length} />
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {roots.length > 0 && (
          <GroupSection title={t('projects.workspaceRoot')}>
            {roots.map((r) => (
              <div key={r.id} style={{ padding: '4px 12px', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)', fontWeight: 500 }}>
                📂 {r.label || r.path.split(/[/\\]/).pop()}
              </div>
            ))}
          </GroupSection>
        )}

        <GroupSection title={`${t('projects.filterRunning')} (${active.length})`}>
          {active.map((p) => <ProjectNode key={p.id} project={p} isSelected={selectedProjectId === p.id} onSelect={() => onSelectProject(p.id)} t={t} />)}
        </GroupSection>

        <GroupSection title={`${t('projects.withRisks')} (${withRisks.length})`}>
          {withRisks.map((p) => <ProjectNode key={p.id} project={p} isSelected={selectedProjectId === p.id} onSelect={() => onSelectProject(p.id)} t={t} />)}
        </GroupSection>

        <GroupSection title={`${t('projects.allProjects')} (${filtered.length})`}>
          {filtered.map((p) => <ProjectNode key={p.id} project={p} isSelected={selectedProjectId === p.id} onSelect={() => onSelectProject(p.id)} t={t} />)}
        </GroupSection>
      </div>
    </div>
  );
}

function RailHeader({ title, onCollapse, count }: { title: string; onCollapse: () => void; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--cc-border)', minHeight: 36 }}>
      <span style={{ fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text)' }}>{title}</span>
      <span style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>{count}</span>
      <button onClick={onCollapse} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>&#x25C0;</button>
    </div>
  );
}

function GroupSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ padding: '4px 12px', fontSize: 'var(--cc-font-xs)', fontWeight: 600, color: 'var(--cc-text-soft)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

function ProjectNode({ project, isSelected, onSelect, t }: { project: Project; isSelected: boolean; onSelect: () => void; t: (key: string, opts?: any) => string }) {
  const status: 'running' | 'idle' | 'error' = project.activeSessionCount > 0 ? 'running' : project.riskCount > 0 ? 'error' : 'idle';
  return (
    <div
      data-testid="project-node"
      onClick={onSelect}
      style={{
        padding: '6px 12px 6px 20px', cursor: 'pointer', fontSize: 'var(--cc-font-sm)',
        background: isSelected ? 'var(--cc-brand-soft)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--cc-navy)' : '2px solid transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <CcStatusDot status={status} size={7} pulse={status === 'running'} />
        <span style={{ fontWeight: 500, color: 'var(--cc-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{project.name}</span>
      </div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', marginTop: 2 }}>
        {project.gitBranch && <span style={{ marginRight: 8 }}>{project.gitBranch}</span>}
        <span style={{ marginRight: 8 }}>{t('projects.totalSessions')}: {project.totalSessionCount}</span>
        {project.activeSessionCount > 0 && <span style={{ marginRight: 8, color: 'var(--cc-green)' }}>{t('projects.activeSessions')}: {project.activeSessionCount}</span>}
        {project.riskCount > 0 && <span style={{ color: 'var(--cc-red)' }}>{t('projects.riskCountLabel', { count: project.riskCount })}</span>}
      </div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.path}</div>
      <div style={{ fontSize: 'var(--cc-font-xs)', color: 'var(--cc-text-muted)' }}>
        {t('projects.lastUpdate')}: {relativeTime(project.updatedAt)}
      </div>
    </div>
  );
}
