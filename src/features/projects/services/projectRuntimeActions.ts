/** Projects Surface → RuntimeBridge bridge.
 *  Projects must NOT call invokeCommand directly for session creation. */

import { startInteractiveClaudeSession } from '../../runtime/services/runtimeBridge';

export async function launchClaudeSessionFromProject(input: {
  projectId: string; projectName: string; cwd: string;
}) {
  return startInteractiveClaudeSession({
    projectId: input.projectId,
    projectName: input.projectName,
    cwd: input.cwd,
    mode: 'new',
  });
}
