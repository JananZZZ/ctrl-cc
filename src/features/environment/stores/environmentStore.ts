// v28: environmentStore is now an adapter over setupStore.
// Console, Settings, and FirstRun all read from the same setup snapshot.

import { useSetupStore } from '../../setup/stores/setupStore';

export interface EnvironmentSnapshotCompat {
  capability: null;
  launchPlans: unknown[];
  jsCandidates: unknown[];
  generatedAt: string;
  source: string;
}

export function useEnvironmentSnapshot() {
  return useSetupStore((s) => s.snapshot);
}

// Compatibility re-export: existing consumers of useEnvironmentStore
// get the unified setup snapshot with the old store API.
export const useEnvironmentStore = useSetupStore;
