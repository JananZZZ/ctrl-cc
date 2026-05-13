// v10.0 ResourceScanner — scans .claude directories for skills, agents, rules, etc.
import type { ResourceItem, ResourceType, ResourceHealth, ResourceScanResult } from '../types/resourceTypes';

const RESOURCE_TYPE_MAP: Record<string, ResourceType> = {
  skills: 'skill', agents: 'agent', rules: 'rule',
  memory: 'memory', hooks: 'hook', mcp: 'mcp',
  templates: 'template', commands: 'slash-command',
};

export async function scanGlobalResources(): Promise<ResourceScanResult> {
  // Resources at ~/.claude/ — scanned via Tauri backend
  // For P0 frontend: uses list_directory + read_file_content commands
  const errors: string[] = [];
  const resources: ResourceItem[] = [];

  try {
    const { invokeCommand } = await import('../../../services/invokeCommand');
    const dirs = ['skills', 'agents', 'rules', 'memory', 'hooks', 'mcp', 'templates'];

    for (const dir of dirs) {
      try {
        const files = await invokeCommand<Array<{ name: string; path: string; isDir: boolean }>>('list_directory', {
          path: `~/.claude/${dir}`, depth: 2,
        });
        if (!files || !Array.isArray(files)) continue;
        for (const f of files) {
          if (f.isDir || !f.name.endsWith('.md')) continue;
          resources.push({
            id: `res-${dir}-${f.name.replace('.md', '')}`,
            type: RESOURCE_TYPE_MAP[dir] || 'skill',
            name: f.name.replace('.md', ''),
            path: f.path,
            scope: 'global',
            health: 'ready',
            tags: [dir],
            diagnostics: null,
            dependencies: [],
            createdAt: '',
            updatedAt: '',
          });
        }
      } catch { /* directory may not exist */ }
    }
  } catch (e) {
    errors.push(String(e));
  }

  return { resources, errors, scannedAt: new Date().toISOString() };
}

export async function scanProjectResources(projectPath: string): Promise<ResourceScanResult> {
  const errors: string[] = [];
  const resources: ResourceItem[] = [];

  try {
    const { invokeCommand } = await import('../../../services/invokeCommand');
    const claudeDir = `${projectPath}/.claude`;

    try {
      const files = await invokeCommand<Array<{ name: string; path: string; isDir: boolean }>>('list_directory', {
        path: claudeDir, depth: 3,
      });
      if (files && Array.isArray(files)) {
        for (const f of files) {
          if (f.isDir || (!f.name.endsWith('.md') && !f.name.endsWith('.json'))) continue;
          const type = f.name === 'CLAUDE.md' ? 'claude-md' : 'rule';
          resources.push({
            id: `res-project-${f.name.replace(/[.\s]/g, '-')}`,
            type,
            name: f.name,
            path: f.path,
            scope: 'project',
            health: 'ready',
            tags: ['project'],
            diagnostics: null,
            dependencies: [],
            createdAt: '',
            updatedAt: '',
          });
        }
      }
    } catch { /* no .claude dir */ }
  } catch (e) {
    errors.push(String(e));
  }

  return { resources, errors, scannedAt: new Date().toISOString() };
}

export function classifyHealth(resource: ResourceItem): ResourceHealth {
  if (!resource.path) return 'invalid-frontmatter';
  if (resource.diagnostics && resource.diagnostics.issues.length > 0) {
    return resource.diagnostics.issues.some(i => i.toLowerCase().includes('error')) ? 'error' : 'warning';
  }
  return 'ready';
}
