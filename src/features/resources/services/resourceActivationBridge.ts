// v10.0 ResourceActivationBridge — insert/attach/apply resources to sessions and projects
import { RuntimeBridge, getRuntimeSession } from '../../../features/runtime/services/runtimeBridge';
import type { ResourceItem } from '../types/resourceTypes';
import { recordRuntimeError, recordRuntimeWarning } from '../../../features/runtime/stores/runtimeTraceStore';
import { useRuntimeStore } from '../../runtime/stores/runtimeStore';

function formatResourceAsContext(resource: ResourceItem): string {
  return [
    `### Resource Context: ${resource.name}`,
    '',
    `- Type: ${resource.type}`,
    `- Scope: ${resource.scope}`,
    `- Path: ${resource.path}`,
    '',
    '```resource',
    resource.content ?? '(empty)',
    '```',
    '',
    '---',
  ].join('\n');
}

export function getActiveSessionCwd(): string | null {
  const { activeSessionId, sessions } = useRuntimeStore.getState();
  if (!activeSessionId) return null;
  return sessions[activeSessionId]?.cwd ?? null;
}

export { getRuntimeSession as getSessionContext };

export const ResourceActivationBridge = {
  insertIntoChat(resource: ResourceItem, uiSessionId: string): boolean {
    const session = getRuntimeSession(uiSessionId);
    if (!session) {
      recordRuntimeError('resource.activate.chat.no_session', uiSessionId, null, 'No session found');
      return false;
    }
    const contextBlock = formatResourceAsContext(resource);
    try {
      sessionStorage.setItem(`ctrlcc:composer-draft:${uiSessionId}`, contextBlock);
      return true;
    } catch (e) {
      recordRuntimeError('resource.activate.chat.storage_failed', uiSessionId, null, String(e));
      return false;
    }
  },

  attachToSession(resource: ResourceItem, uiSessionId: string): boolean {
    const session = getRuntimeSession(uiSessionId);
    if (!session) {
      recordRuntimeError('resource.activate.attach.no_session', uiSessionId, null, 'No session found');
      return false;
    }
    try {
      const key = `ctrlcc:session-context:${uiSessionId}`;
      const existing = JSON.parse(sessionStorage.getItem(key) ?? '[]');
      existing.push({
        id: resource.id, type: resource.type, name: resource.name,
        path: resource.path, attachedAt: new Date().toISOString(),
      });
      sessionStorage.setItem(key, JSON.stringify(existing.slice(-20)));
      return true;
    } catch (e) {
      recordRuntimeError('resource.activate.attach.failed', uiSessionId, null, String(e));
      return false;
    }
  },

  async sendToCurrentPty(resource: ResourceItem, uiSessionId: string): Promise<boolean> {
    const session = getRuntimeSession(uiSessionId);
    if (!session) {
      recordRuntimeError('resource.activate.pty.no_session', uiSessionId, null, 'No session found');
      return false;
    }
    if (!session.ptySessionId) {
      recordRuntimeWarning('resource.activate.pty.no_pty', uiSessionId, null, 'No PTY attached');
      return false;
    }
    try {
      const header = `\n# Loaded resource: ${resource.name} (${resource.type})\n`;
      await RuntimeBridge.write(uiSessionId, header);
      return true;
    } catch (e) {
      recordRuntimeError('resource.activate.pty.failed', uiSessionId, session.ptySessionId, String(e));
      return false;
    }
  },

  applyToProject(resource: ResourceItem, _projectId: string): { ok: boolean; targetPath: string } {
    const configTypes = ['rule', 'mcp', 'claude-md', 'settings', 'hook'];
    if (!configTypes.includes(resource.type)) return { ok: false, targetPath: '' };
    const targetPath = `.claude/${resource.name}`;
    return { ok: true, targetPath };
  },

  cloneToProject(resource: ResourceItem, _projectId: string): { ok: boolean; targetPath: string } {
    const targetPath = `.claude/${resource.type}s/${resource.name}`;
    return { ok: true, targetPath };
  },

  applyPackToProject(_packId: string, _projectId: string): { ok: boolean; items: number } {
    return { ok: false, items: 0 };
  },

  diagnose(resource: ResourceItem): ResourceItem['diagnostics'] {
    const issues: string[] = [];
    if (!resource.path) issues.push('Path is empty');
    if (!resource.content && resource.type !== 'pack') issues.push('Content is empty');
    return {
      summary: issues.length > 0 ? issues.join('; ') : 'OK',
      issues,
      missingDeps: [],
      pathExists: !!resource.path,
      frontmatterValid: true,
    };
  },
};
