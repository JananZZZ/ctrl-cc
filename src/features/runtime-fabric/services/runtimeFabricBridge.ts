import { invokeCommand } from '../../../services/invokeCommand';
import { useRuntimeFabricStore } from '../stores/runtimeFabricStore';
import type { CtrlCcSession, RuntimeChannel } from '../types/runtimeFabricTypes';
import { useOpenSessionStore } from '../../../stores/openSessionStore';
import { useSurfaceStore } from '../../../stores/surfaceStore';
import { useSessionStore } from '../../../stores/sessionStore';

function now() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export interface CreateSessionInput {
  projectId: string;
  projectName: string;
  cwd: string;
  title?: string;
}

export function createCtrlCcSession(input: CreateSessionInput): CtrlCcSession {
  const ts = now();
  const session: CtrlCcSession = {
    id: uid('ses'),
    projectId: input.projectId,
    projectName: input.projectName,
    cwd: input.cwd,
    title: input.title ?? `${input.projectName}-${ts.slice(0, 16).replace(/[:T]/g, '-')}`,
    activeView: 'chat',
    claudeSessionId: crypto.randomUUID(),
    chatChannelId: null,
    terminalChannelId: null,
    backgroundChannelId: null,
    ledgerId: uid('ledger'),
    status: 'idle',
    error: null,
    createdAt: ts,
    updatedAt: ts,
  };

  useRuntimeFabricStore.getState().addSession(session);
  useRuntimeFabricStore.getState().appendEvent({
    sessionId: session.id,
    channelId: null,
    level: 'info',
    type: 'session.created',
    message: 'Ctrl-CC session created',
    payload: { cwd: session.cwd, projectId: session.projectId },
  });

  useSessionStore.getState().addSession({
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    runtimeMode: 'fabric',
    status: 'starting',
    model: 'sonnet',
    permissionMode: 'default' as const,
    cwd: session.cwd,
    inputTokens: 0,
    outputTokens: 0,
    totalCostUsd: 0,
    fileChangeCount: 0,
    riskCount: 0,
    auditCount: 0,
    isPinned: false,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    startedAt: session.createdAt,
  } as any);

  useOpenSessionStore.getState().openSession({
    sessionId: session.id,
    projectId: session.projectId,
    projectName: session.projectName,
    title: session.title,
    status: 'starting',
    viewMode: 'chat',
    pendingConfirms: 0,
    riskCount: 0,
    isPinned: false,
  });

  useSurfaceStore.getState().navigateTo('workspace');
  return session;
}

export async function sendChatMessage(
  sessionId: string,
  prompt: string,
  options?: {
    model?: string;
    permissionMode?: string;
    effort?: string;
    cwd?: string;
    projectId?: string;
  }
) {
  const state = useRuntimeFabricStore.getState();
  const session = state.sessions[sessionId];
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const channel: RuntimeChannel = {
    id: uid('chat'),
    sessionId,
    kind: 'chat',
    status: 'starting',
    cwd: session.cwd,
    pid: null,
    program: null,
    args: [],
    error: null,
    startedAt: now(),
    exitedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  state.addChannel(channel);
  state.patchSession(sessionId, { chatChannelId: channel.id, status: 'running', activeView: 'chat' });
  state.appendEvent({
    sessionId,
    channelId: channel.id,
    level: 'info',
    type: 'chat.request',
    message: prompt,
  });

  try {
    const started = await invokeCommand<{ pid?: number }>('runtime_start_chat_stream', {
      req: {
        traceId: uid('trace'),
        sessionId,
        channelId: channel.id,
        cwd: options?.cwd ?? session.cwd,
        prompt,
        claudeSessionId: session.claudeSessionId,
        model: options?.model ?? 'sonnet',
        permissionMode: options?.permissionMode ?? 'default',
        maxTurns: null,
      },
    });

    useRuntimeFabricStore.getState().patchChannel(channel.id, {
      status: 'running',
      pid: started.pid ?? null,
    });
  } catch (error) {
    const msg = String(error);
    useRuntimeFabricStore.getState().patchChannel(channel.id, {
      status: 'failed',
      error: msg,
      exitedAt: new Date().toISOString(),
    });
    useRuntimeFabricStore.getState().appendEvent({
      sessionId,
      channelId: channel.id,
      level: 'error',
      type: 'chat.failed',
      message: msg,
    });
    throw error;
  }
}

export async function startTerminalChannel(sessionId: string) {
  const session = useRuntimeFabricStore.getState().sessions[sessionId];
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const channel: RuntimeChannel = {
    id: uid('pty'),
    sessionId,
    kind: 'terminal',
    status: 'starting',
    cwd: session.cwd,
    pid: null,
    program: null,
    args: [],
    error: null,
    startedAt: now(),
    exitedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  useRuntimeFabricStore.getState().addChannel(channel);
  useRuntimeFabricStore.getState().patchSession(sessionId, {
    terminalChannelId: channel.id,
    activeView: 'terminal',
  });

  try {
    await invokeCommand('runtime_start_interactive_v2', {
      req: {
        traceId: uid('trace'),
        uiSessionId: sessionId,
        ptySessionId: channel.id,
        projectId: session.projectId,
        cwd: session.cwd,
        model: null,
        permissionMode: 'default',
        mode: 'new',
        sessionName: session.title,
        resumeTarget: null,
        initialPrompt: null,
      },
    });

    useRuntimeFabricStore.getState().patchChannel(channel.id, { status: 'ready' });
  } catch (error) {
    const msg = String(error);
    useRuntimeFabricStore.getState().patchChannel(channel.id, {
      status: 'failed',
      error: msg,
      exitedAt: new Date().toISOString(),
    });
    useRuntimeFabricStore.getState().appendEvent({
      sessionId,
      channelId: channel.id,
      level: 'error',
      type: 'terminal.failed',
      message: msg,
    });
    throw error;
  }
}

export const RuntimeFabricBridge = {
  createCtrlCcSession,
  sendChatMessage,
  startTerminalChannel,
};
