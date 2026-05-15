import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from './AppShell';
import { ErrorBoundary } from '../components/error/ErrorBoundary';
import { useProjectStore } from '../stores/projectStore';
import type { SessionStatus, PermissionMode, Project } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import { invokeCommand, warnLog } from '../services/invokeCommand';
import { useErrorStore } from '../stores/errorStore';
import { listen } from '@tauri-apps/api/event';
import { installRuntimeLifecycleBridge } from '../features/runtime/services/runtimeLifecycleBridge';
import { installRuntimeFabricEventBridge } from '../features/runtime-fabric/services/runtimeFabricEventBridge';
import { FirstRunSetupWizard } from '../features/setup/components/FirstRunSetupWizard';
import { useSetupStore } from '../features/setup/stores/setupStore';
import i18n from '../i18n';

export function App() {
  const { t } = useTranslation();
  const addProject = useProjectStore((s) => s.addProject);
  const setProjects = useProjectStore((s) => s.setProjects);
  const projects = useProjectStore((s) => s.projects);
  const setSessions = useSessionStore((s) => s.setSessions);

  // v13.0: Install runtime lifecycle bridge (pty://data, pty://exit, pty://error, runtime://session-status)
  useEffect(() => {
    let cleanup: undefined | (() => void);
    installRuntimeLifecycleBridge().then((fn) => {
      cleanup = fn;
    }).catch((error) => {
      console.error('[Ctrl-CC] installRuntimeLifecycleBridge failed', error);
    });
    return () => cleanup?.();
  }, []);

  // v19.0: Install Runtime Fabric Event Bridge (runtime://chat-stream, chat-stderr, chat-exit)
  useEffect(() => {
    let cleanup: undefined | (() => void);
    installRuntimeFabricEventBridge()
      .then((fn) => { cleanup = fn; })
      .catch((err) => console.error('[Ctrl-CC] RuntimeFabricEventBridge failed', err));
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    // Restore theme from localStorage, default to warm-sand
    const savedTheme = localStorage.getItem('ctrl-cc-theme') || 'warm-sand';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Restore font scale
    const savedScale = localStorage.getItem('ctrl-cc-font-scale');
    if (savedScale) document.documentElement.style.setProperty('--cc-font-scale', savedScale);

    // Restore language
    const savedLang = localStorage.getItem('ctrlcc_lang') || 'zh';
    if (i18n.language !== savedLang) i18n.changeLanguage(savedLang);

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
          runtimeMode: ((r.runtimeMode as string) === 'structured-print' ? 'structured-print' : 'pty-interactive') as 'pty-interactive' | 'structured-print',
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
      try {
        useErrorStore.getState().addError({
          severity: 'error',
          source: 'unknown',
          title: t('error.unhandledRejection'),
          detail: String(event.reason),
          rawError: String(event.reason),
        });
      } catch {}
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

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
