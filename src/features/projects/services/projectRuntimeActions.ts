// v10.0 ProjectRuntimeActions — Projects surface RuntimeBridge actions
import { RuntimeBridge } from '../../../features/runtime/services/runtimeBridge';
import { recordRuntimeError } from '../../../features/runtime/stores/runtimeTraceStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';

export function openWorkspaceForSession(_uiSessionId: string): void {
  useSurfaceStore.getState().navigateTo('workspace');
}

export async function newProjectSession(projectId: string, projectName: string, cwd: string): Promise<void> {
  try {
    await RuntimeBridge.startInteractiveSession({ projectId, projectName, cwd, mode: 'new' });
  } catch (e) {
    recordRuntimeError('projects.new_session.failed', null, null, String(e));
    throw e;
  }
}

export async function resumeProjectSession(projectId: string, projectName: string, cwd: string, resumeTarget?: string): Promise<void> {
  try {
    await RuntimeBridge.startInteractiveSession({ projectId, projectName, cwd, mode: 'resume', resumeTarget });
  } catch (e) {
    recordRuntimeError('projects.resume_session.failed', null, null, String(e));
    throw e;
  }
}

export async function forkProjectSession(projectId: string, projectName: string, cwd: string, resumeTarget?: string): Promise<void> {
  try {
    await RuntimeBridge.startInteractiveSession({ projectId, projectName, cwd, mode: 'fork', resumeTarget });
  } catch (e) {
    recordRuntimeError('projects.fork_session.failed', null, null, String(e));
    throw e;
  }
}

export async function stopProjectSession(uiSessionId: string): Promise<void> {
  try {
    await RuntimeBridge.stop(uiSessionId);
  } catch (e) {
    recordRuntimeError('projects.stop_session.failed', uiSessionId, null, String(e));
  }
}
