// v10.0 ConsoleRuntimeActions — Console surface RuntimeBridge actions
import { RuntimeBridge } from '../../../features/runtime/services/runtimeBridge';
import { recordRuntimeError } from '../../../features/runtime/stores/runtimeTraceStore';

export interface ConsoleQuickAction {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
  action: () => Promise<void> | void;
}

export function buildQuickStartCards(
  onNewSession: () => void,
  onContinueSession: () => void,
  onOpenProject: () => void,
  onOpenWorkspace: () => void,
  onOpenResources: () => void,
  onRunDiagnostics: () => void,
  hasRecentSession: boolean,
  hasActiveSession: boolean,
  hasProject: boolean,
): ConsoleQuickAction[] {
  return [
    {
      id: 'new-session', label: '新建 Claude 会话', description: '启动新的 Claude Code 交互会话',
      enabled: true,
      action: () => onNewSession(),
    },
    {
      id: 'continue-session', label: '继续最近会话', description: '恢复上次的 Claude Code 会话',
      enabled: hasRecentSession,
      disabledReason: hasRecentSession ? undefined : '没有最近的会话',
      action: () => onContinueSession(),
    },
    {
      id: 'open-project', label: '打开项目', description: '浏览和管理项目',
      enabled: hasProject,
      disabledReason: hasProject ? undefined : '没有项目',
      action: () => onOpenProject(),
    },
    {
      id: 'open-workspace', label: '打开当前 Workspace', description: '进入活跃工作区',
      enabled: hasActiveSession,
      disabledReason: hasActiveSession ? undefined : '没有活跃会话',
      action: () => onOpenWorkspace(),
    },
    {
      id: 'resources', label: '插入常用资源', description: '管理 Skills、Agents、Rules 等资源',
      enabled: true,
      action: () => onOpenResources(),
    },
    {
      id: 'diagnostics', label: '运行诊断', description: '检查系统健康状态',
      enabled: true,
      action: () => onRunDiagnostics(),
    },
  ];
}

export async function consoleNewSession(projectId: string, projectName: string, cwd: string): Promise<void> {
  try {
    await RuntimeBridge.startInteractiveSession({ projectId, projectName, cwd, mode: 'new' });
  } catch (e) {
    recordRuntimeError('console.new_session.failed', null, null, String(e));
    throw e;
  }
}
