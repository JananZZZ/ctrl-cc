// v10.0 ActionBus — singleton dispatch bus for CtrlCcAction lifecycle
// All surfaces write through this bus. The bus owns action creation and
// status transitions, writing into the ActionStore journal.
//
// Usage:
//   const actionId = ActionBus.dispatch('open-project', { projectId: 'p1' }, 'projects');
//   ActionBus.start(actionId);
//   // ... do work ...
//   ActionBus.complete(actionId);
//   // or on error:
//   ActionBus.fail(actionId, 'Permission denied');

import { createAction, type CtrlCcAction } from './actionTypes';
import { useActionStore } from './actionStore';

/** Surface identifier — mirrors CtrlCcAction['sourceSurface']. */
type SurfaceTarget = CtrlCcAction['sourceSurface'];

export class ActionBus {
  /** Create and enqueue a new action. Returns the action id for chaining. */
  static dispatch(
    type: string,
    target: CtrlCcAction['target'],
    sourceSurface: SurfaceTarget,
  ): string {
    const action = createAction(sourceSurface, type, target);
    useActionStore.getState().addAction(action);
    return action.id;
  }

  /** Mark an action as in-progress. */
  static start(id: string): void {
    useActionStore.getState().patchAction(id, { status: 'running' });
  }

  /** Mark an action as successfully completed. */
  static complete(id: string): void {
    useActionStore.getState().patchAction(id, { status: 'succeeded' });
  }

  /** Mark an action as failed with an error description. */
  static fail(id: string, error: string): void {
    useActionStore.getState().patchAction(id, { status: 'failed', error });
  }

  /** Mark an action as blocked with a reason. */
  static block(id: string, reason: string): void {
    useActionStore.getState().patchAction(id, { status: 'blocked', error: reason });
  }
}
