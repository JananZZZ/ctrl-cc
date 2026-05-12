// ProjectStore — React #185 fix: all actions idempotent (no-op when unchanged)
import { create } from 'zustand';
import type { Project, WorkspaceRoot } from '../types';

interface ProjectState {
  roots: WorkspaceRoot[];
  projects: Project[];
  selectedProjectId: string | null;
  setRoots: (roots: WorkspaceRoot[]) => void;
  setProjects: (projects: Project[]) => void;
  selectProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  roots: [],
  projects: [],
  selectedProjectId: null,
  setRoots: (roots) =>
    set((state) => {
      if (state.roots.length === roots.length && state.roots.every((r, i) => r.id === roots[i]?.id)) return state;
      return { roots };
    }),
  setProjects: (projects) =>
    set((state) => {
      if (state.projects.length === projects.length && state.projects.every((p, i) => p.id === projects[i]?.id)) return state;
      return { projects };
    }),
  selectProject: (id) =>
    set((state) => {
      if (state.selectedProjectId === id) return state; // idempotent guard
      return { selectedProjectId: id };
    }),
  addProject: (project) =>
    set((s) => {
      if (s.projects.some((p) => p.id === project.id)) return s;
      return { projects: [...s.projects, project] };
    }),
  removeProject: (id) =>
    set((s) => {
      if (!s.projects.some((p) => p.id === id)) return s;
      return { projects: s.projects.filter((p) => p.id !== id) };
    }),
  updateProject: (id, patch) =>
    set((s) => {
      const old = s.projects.find((p) => p.id === id);
      if (!old) return s;
      let changed = false;
      for (const k of Object.keys(patch) as Array<keyof typeof patch>) {
        if (patch[k] !== undefined && old[k] !== patch[k]) { changed = true; break; }
      }
      if (!changed) return s;
      return { projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    }),
}));
