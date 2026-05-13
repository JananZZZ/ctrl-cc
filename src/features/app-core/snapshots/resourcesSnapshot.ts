// v10.0 ResourcesSnapshot — stable derived view for Resources surface
import type { ResourceItem } from '../../resources/types/resourceTypes';

export interface ResourceHealthSummary {
  total: number;
  ready: number;
  warning: number;
  error: number;
  inactive: number;
  missingDependency: number;
  invalidFrontmatter: number;
}

export interface ResourcesSnapshot {
  generatedAt: string;
  health: ResourceHealthSummary;
  activeForCurrentSession: number;
  projectResources: number;
  globalResources: number;
  byType: Record<string, number>;
  recentWarnings: Array<{ id: string; name: string; type: string; issue: string }>;
}

export function buildResourcesSnapshot(resources: ResourceItem[] = [], activeSessionId?: string): ResourcesSnapshot {
  const byType: Record<string, number> = {};
  let ready = 0, warning = 0, error = 0, inactive = 0, missingDep = 0, invalidFm = 0;
  const recentWarnings: ResourcesSnapshot['recentWarnings'] = [];

  for (const r of resources) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    switch (r.health) {
      case 'ready': ready++; break;
      case 'warning': warning++; recentWarnings.push({ id: r.id, name: r.name, type: r.type, issue: r.diagnostics?.summary ?? 'Unknown issue' }); break;
      case 'error': error++; recentWarnings.push({ id: r.id, name: r.name, type: r.type, issue: r.diagnostics?.summary ?? 'Error' }); break;
      case 'inactive': inactive++; break;
      case 'missing-dependency': missingDep++; break;
      case 'invalid-frontmatter': invalidFm++; break;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    health: { total: resources.length, ready, warning, error, inactive, missingDependency: missingDep, invalidFrontmatter: invalidFm },
    activeForCurrentSession: activeSessionId ? resources.filter(r => r.usedBySessions?.includes(activeSessionId)).length : 0,
    projectResources: resources.filter(r => r.scope === 'project').length,
    globalResources: resources.filter(r => r.scope === 'global' || r.scope === 'user').length,
    byType,
    recentWarnings: recentWarnings.slice(0, 10),
  };
}
