// v10.0 Resource Types — capability & context center
export type ResourceType =
  | 'skill'
  | 'agent'
  | 'rule'
  | 'memory'
  | 'hook'
  | 'mcp'
  | 'template'
  | 'slash-command'
  | 'claude-md'
  | 'settings'
  | 'pack'
  | 'project-overlay';

export type ResourceScope = 'global' | 'user' | 'project' | 'session';
export type ResourceHealth = 'ready' | 'warning' | 'error' | 'inactive' | 'missing-dependency' | 'invalid-frontmatter';
export type ResourceView = 'grid' | 'list' | 'split' | 'graph';

export interface ResourceDiagnostics {
  summary: string;
  issues: string[];
  missingDeps: string[];
  pathExists: boolean;
  frontmatterValid: boolean;
}

export interface ResourceItem {
  id: string;
  type: ResourceType;
  name: string;
  description?: string;
  path: string;
  scope: ResourceScope;
  health: ResourceHealth;
  tags: string[];
  diagnostics: ResourceDiagnostics | null;
  usedBySessions?: string[];
  usedByProjects?: string[];
  content?: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceActivationTarget {
  type: 'chat-composer' | 'session-context' | 'current-pty' | 'project-overlay' | 'project-clone';
  uiSessionId?: string;
  projectId?: string;
}

export interface ResourceScanResult {
  resources: ResourceItem[];
  errors: string[];
  scannedAt: string;
}

export interface ResourcePackItem {
  resourceId: string;
  type: ResourceType;
  name: string;
}
