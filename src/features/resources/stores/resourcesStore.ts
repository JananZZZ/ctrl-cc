// v10.0 ResourcesStore — Zustand store for resource management
import { create } from 'zustand';
import type { ResourceItem, ResourceScanResult, ResourceView } from '../types/resourceTypes';
import { classifyHealth } from '../services/resourceScanner';

interface ResourcesState {
  resources: ResourceItem[];
  activeView: ResourceView;
  activeResourceId: string | null;
  selectedScope: 'all' | 'global' | 'user' | 'project' | 'session';
  selectedType: string | null;
  searchQuery: string;
  scanning: boolean;
  lastScanResult: ResourceScanResult | null;

  setResources: (resources: ResourceItem[]) => void;
  addResource: (resource: ResourceItem) => void;
  updateResource: (id: string, patch: Partial<ResourceItem>) => void;
  removeResource: (id: string) => void;
  setActiveView: (view: ResourceView) => void;
  setActiveResource: (id: string | null) => void;
  setScope: (scope: ResourcesState['selectedScope']) => void;
  setType: (type: string | null) => void;
  setSearch: (query: string) => void;
  setScanning: (scanning: boolean) => void;
  setScanResult: (result: ResourceScanResult) => void;
  getFiltered: () => ResourceItem[];
}

export const useResourcesStore = create<ResourcesState>((set, get) => ({
  resources: [],
  activeView: 'grid',
  activeResourceId: null,
  selectedScope: 'all',
  selectedType: null,
  searchQuery: '',
  scanning: false,
  lastScanResult: null,

  setResources: (resources) => {
    const current = get().resources;
    if (current === resources) return;
    set({ resources });
  },

  addResource: (resource) => {
    const current = get().resources;
    if (current.some(r => r.id === resource.id)) return;
    set({ resources: [...current, resource] });
  },

  updateResource: (id, patch) => {
    const current = get().resources;
    const idx = current.findIndex(r => r.id === id);
    if (idx === -1) return;
    const updated = { ...current[idx], ...patch, updatedAt: new Date().toISOString() };
    updated.health = classifyHealth(updated);
    const next = [...current];
    next[idx] = updated;
    if (JSON.stringify(current) === JSON.stringify(next)) return;
    set({ resources: next });
  },

  removeResource: (id) => {
    const current = get().resources;
    if (!current.some(r => r.id === id)) return;
    set({ resources: current.filter(r => r.id !== id) });
  },

  setActiveView: (view) => { if (get().activeView !== view) set({ activeView: view }); },
  setActiveResource: (id) => { if (get().activeResourceId !== id) set({ activeResourceId: id }); },
  setScope: (scope) => { if (get().selectedScope !== scope) set({ selectedScope: scope }); },
  setType: (type) => { if (get().selectedType !== type) set({ selectedType: type }); },
  setSearch: (query) => { if (get().searchQuery !== query) set({ searchQuery: query }); },
  setScanning: (scanning) => { if (get().scanning !== scanning) set({ scanning }); },
  setScanResult: (result) => set({ lastScanResult: result }),

  getFiltered: () => {
    const { resources, selectedScope, selectedType, searchQuery } = get();
    return resources.filter(r => {
      if (selectedScope !== 'all' && r.scope !== selectedScope) return false;
      if (selectedType && r.type !== selectedType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.tags.some(t => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  },
}));
