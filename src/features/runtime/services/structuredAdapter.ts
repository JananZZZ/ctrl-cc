/** Structured Adapter — for claude -p --output-format stream-json one-shot tasks.
 *  NOT for interactive PTY sessions. */

import { invokeCommand } from '../../../services/invokeCommand';

export async function runStructuredTask(input: {
  sessionId: string; projectId: string; cwd: string;
  model: string; prompt: string; effort?: string; permissionMode?: string;
}) {
  return invokeCommand('create_claude_chat', {
    options: {
      sessionId: input.sessionId,
      projectId: input.projectId,
      cwd: input.cwd,
      model: input.model,
      prompt: input.prompt,
      effort: input.effort ?? null,
      permissionMode: input.permissionMode ?? null,
    },
  });
}

export async function stopStructuredTask(sessionId: string) {
  return invokeCommand('stop_claude_chat', { sessionId });
}
