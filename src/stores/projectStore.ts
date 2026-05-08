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
  setRoots: (roots) => set({ roots }),
  setProjects: (projects) => set({ projects }),
  selectProject: (id) => set({ selectedProjectId: id }),
  addProject: (project) => set((s) => ({ projects: [...s.projects, project] })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  updateProject: (id, patch) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
}));
