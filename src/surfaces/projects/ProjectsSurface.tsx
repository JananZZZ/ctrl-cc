import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ProjectsTopBar } from './ProjectsTopBar';
import { ProjectManagementRail } from './ProjectManagementRail';
import { SessionManagementRail } from './SessionManagementRail';
import { ProjectDetailPanel } from './ProjectDetailPanel';

export function ProjectsSurface() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'running' | 'risk' | 'archived'>('all');
  const [projectRailCollapsed, setProjectRailCollapsed] = useState(false);
  const [sessionRailCollapsed, setSessionRailCollapsed] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { selectProject, addProject } = useProjectStore();

  const handleSelectProject = (id: string | null) => {
    setSelectedProjectId(id);
    setSelectedSessionId(null);
    selectProject(id);
  };

  const handleCreateProject = () => {
    const name = `新项目 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    const id = `proj-${Date.now()}`;
    addProject({
      id, workspaceRootId: '', name, path: `G:/Projects/${name}`,
      isFavorite: false, isArchived: false, activeSessionCount: 0, totalSessionCount: 0,
      pendingPermissionCount: 0, riskCount: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    handleSelectProject(id);
  };

  return (
    <div data-testid="surface-projects" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ProjectsTopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateProject={handleCreateProject}
        onImportProject={() => {}}
        onContinueLatest={() => {}}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <ProjectManagementRail
          collapsed={projectRailCollapsed}
          onToggleCollapse={() => setProjectRailCollapsed((v) => !v)}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          searchQuery={searchQuery}
        />
        <SessionManagementRail
          collapsed={sessionRailCollapsed}
          onToggleCollapse={() => setSessionRailCollapsed((v) => !v)}
          projectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onResume={() => {}}
          onFork={() => {}}
        />
        <ProjectDetailPanel
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          onSelectSession={setSelectedSessionId}
          onCreateSession={() => {}}
        />
      </div>
    </div>
  );
}
