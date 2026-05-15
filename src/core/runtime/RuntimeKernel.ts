import type {
  CreateRuntimeSessionInput,
  RuntimeSessionRecord,
  SendChatInput,
  StartTerminalInput,
} from './RuntimeTypes';

export interface RuntimeKernel {
  createSession(input: CreateRuntimeSessionInput): Promise<RuntimeSessionRecord>;
  sendChat(input: SendChatInput): Promise<void>;
  startTerminal(input: StartTerminalInput): Promise<void>;
  stopChannel(channelId: string): Promise<void>;
  cancel(sessionId: string): Promise<void>;
}
