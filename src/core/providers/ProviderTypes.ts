import type {
  RuntimeProviderId,
  RuntimeSessionRecord,
} from '../runtime/RuntimeTypes';

export interface ProviderSessionState {
  sessionId: string;
  providerState: Record<string, unknown>;
}

export interface ProviderTurnHandle {
  channelId: string;
  pid?: number | null;
}

export interface ProviderTerminalHandle {
  channelId: string;
  pid?: number | null;
}

export interface CreateRuntimeSessionInput {
  providerId: RuntimeProviderId;
  projectId: string;
  projectName?: string;
  cwd: string;
  title?: string;
}

export interface ProviderRuntime {
  providerId: RuntimeProviderId;

  createSession(input: CreateRuntimeSessionInput): Promise<ProviderSessionState>;

  sendChat(input: {
    session: RuntimeSessionRecord;
    prompt: string;
    model?: string;
    permissionMode?: string;
    effort?: string;
  }): Promise<ProviderTurnHandle>;

  startTerminal(input: {
    session: RuntimeSessionRecord;
    cols: number;
    rows: number;
  }): Promise<ProviderTerminalHandle>;

  stopChannel(channelId: string): Promise<void>;
}
