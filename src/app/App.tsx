import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from './AppShell';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { useProjectStore } from '../stores/projectStore';
import type { RuntimeMode, SessionStatus, PermissionMode, Project } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { invokeCommand, warnLog } from '../services/invokeCommand';
import { useErrorStore } from '../stores/errorStore';
import { listen } from '@tauri-apps/api/event';
import { FirstRunSetupWizard } from '../features/setup/components/FirstRunSetupWizard';
import { useSetupStore } from '../features/setup/stores/setupStore';
import { RuntimeKernelBridge } from '../runtime-kernel/runtimeKernelBridge';
import { TaskBridge } from '../core/tasks/taskBridge';
import { useAppearanceStore } from '../core/settings/appearanceStore';
import { useDiagnosticLedger } from '../core/diagnostics/diagnosticLedger';

export function App() {
  const { t } = useTranslation();
  const addProject = useProjectStore((s) => s.addProject);
  const setProjects = useProjectStore((s) => s.setProjects);
  const projects = useProjectStore((s) => s.projects);
  const setSessions = useSessionStore((s) => s.setSessions);

  // v28.0: Install RuntimeKernelBridge —唯一 Runtime 事件桥接
  useEffect(() => {
    let cleanup: undefined | (() => void);
    RuntimeKernelBridge.install().then((fn) => { cleanup = fn; }).catch((err) => console.error('[Ctrl-CC] RuntimeKernelBridge install failed', err));
    RuntimeKernelBridge.listSessions().catch(() => {});
    return () => cleanup?.();
  }, []);

  // v29.0: Install TaskBridge —全局任务事件桥接
  useEffect(() => {
    let cleanup: undefined | (() => void);
    TaskBridge.install().then((fn) => { cleanup = fn; }).catch((err) => console.error('[Ctrl-CC] TaskBridge install failed', err));
    return () => cleanup?.();
  }, []);

  // v29: Hydrate appearance (theme/font/language) from single source
  const hydrateAppearance = useAppearanceStore((s) => s.hydrate);
  useEffect(() => { hydrateAppearance(); }, [hydrateAppearance]);

  useEffect(() => {
    // Load projects from DB, create default if none
    invokeCommand<Array<Record<string, unknown>>>('load_projects_from_db')
      .then((rows) => {
        if (rows.length > 0) {
          setProjects(rows as unknown as Project[]);
        } else {
          // Create default project and persist it
          invokeCommand<string>('get_home_dir').then((homeDir) => {
            const p: Project = {
              id: 'default', workspaceRootId: '', name: t('projects.defaultProject'), path: homeDir || '.',
              isFavorite: false, isArchived: false, activeSessionCount: 0,
              totalSessionCount: 0, pendingPermissionCount: 0, riskCount: 0,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            };
            addProject(p);
            invokeCommand('save_project_to_db', { project: p }).catch((e) => warnLog('db', 'save_project failed', String(e)));
          }).catch(() => {
            const p: Project = {
              id: 'default', workspaceRootId: '', name: t('projects.defaultProject'), path: '.',
              isFavorite: false, isArchived: false, activeSessionCount: 0,
              totalSessionCount: 0, pendingPermissionCount: 0, riskCount: 0,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            };
            addProject(p);
            invokeCommand('save_project_to_db', { project: p }).catch((e) => warnLog('db', 'save_project failed', String(e)));
          });
        }
      })
      .catch(() => {
        // DB load failed, create in-memory default
        if (projects.length === 0) {
          addProject({
            id: 'default', workspaceRootId: '', name: t('projects.defaultProject'), path: '.',
            isFavorite: false, isArchived: false, activeSessionCount: 0,
            totalSessionCount: 0, pendingPermissionCount: 0, riskCount: 0,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          });
        }
      });
  }, []);

  useEffect(() => {
    invokeCommand<Array<Record<string, unknown>>>('load_sessions_from_db')
      .then((rows) => {
        const sessions = rows.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          projectId: (r.projectId as string) || 'default',
          title: (r.title as string) || t('session.notFound'),
          runtimeMode: ((r.runtimeMode as string) === 'structured-print' ? 'structured-print' : (r.runtimeMode as string) === 'kernel-persistent' ? 'kernel-persistent' : 'pty-interactive') as RuntimeMode,
          status: ((r.status as string) || 'created') as SessionStatus,
          model: (r.model as string) || 'sonnet',
          effort: r.effort as string | undefined,
          permissionMode: ((r.permissionMode as string) || 'default') as PermissionMode,
          claudeSessionId: r.claudeSessionId as string | undefined,
          summary: r.summary as string | undefined,
          cwd: (r.cwd as string) || '.',
          inputTokens: (r.inputTokens as number) || 0,
          outputTokens: (r.outputTokens as number) || 0,
          totalCostUsd: (r.totalCostUsd as number) || 0,
          fileChangeCount: (r.fileChangeCount as number) || 0,
          riskCount: (r.riskCount as number) || 0,
          auditCount: (r.auditCount as number) || 0,
          viewMode: ((r.viewMode as string) || 'chat') as 'chat' | 'terminal' | 'split',
          isPinned: Boolean(r.isPinned),
          createdAt: (r.createdAt as string) || new Date().toISOString(),
          updatedAt: (r.updatedAt as string) || new Date().toISOString(),
          startedAt: r.startedAt as string | undefined,
          endedAt: r.endedAt as string | undefined,
        }));
        // Stale session detection: mark non-terminal persisted sessions as disconnected
        // because backend registry is empty after app restart.
        const terminalStatuses = new Set(['completed', 'failed', 'exited', 'killed', 'archived', 'disconnected']);
        const cleaned = sessions.map((s) => {
          if (!terminalStatuses.has(s.status)) {
            return { ...s, status: 'disconnected' as const, error: 'Backend runtime was restarted. Start a new session or resume.' };
          }
          return s;
        });
        if (cleaned.length > 0) setSessions(cleaned);
      })
      .catch((e) => warnLog('db', 'load_sessions_from_db failed', String(e)));
  }, []);

  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const detail = String(event.reason);
      // v29: Route to DiagnosticLedger for full traceability
      try {
        useDiagnosticLedger.getState().append({
          source: 'window.unhandledrejection',
          severity: 'error',
          title: '未处理的异步错误',
          detail,
          raw: event.reason,
        });
      } catch {}

      try {
        useErrorStore.getState().addError({
          severity: 'error',
          source: 'unknown',
          title: t('error.unhandledRejection'),
          detail,
          rawError: detail,
        });
      } catch {}
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [t]);

  // Global PTY log listener — captures all ctrlcc://log events from Rust
  useEffect(() => {
    const unlisten = listen<Record<string, unknown>>('ctrlcc://log', (event) => {
      const p = event.payload;
      useErrorStore.getState().addError({
        severity: 'info',
        source: 'pty',
        title: `[PTY] ${p.step || 'unknown'}`,
        detail: JSON.stringify(p, null, 2),
        rawError: JSON.stringify(p),
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // v23.0: Load cached setup snapshot and install task progress listeners
  useEffect(() => {
    useSetupStore.getState().loadCached();
    let cleanup: undefined | (() => void);
    useSetupStore.getState().installListeners().then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, []);

  // v23.0: First-run onboarding gate
  const onboardingCompleted = useSetupStore((s) => s.onboardingCompleted);

  if (!onboardingCompleted) {
    return (
      <ErrorBoundary>
        <FirstRunSetupWizard />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
