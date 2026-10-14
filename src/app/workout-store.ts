import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseWorkout, Workout } from '../engine/workout';
interface S { workouts: Workout[]; selectedId: string | null; add(json: unknown): boolean; remove(id: string): void; select(id: string | null): void; selected(): Workout | null; loadBundled(): Promise<void> }
export const useWorkouts = create<S>()(persist((set, get) => ({
  workouts: [], selectedId: null,
  add: (json) => { const w = parseWorkout(json); if (!w) return false; set((s) => ({ workouts: [...s.workouts.filter((x) => x.id !== w.id), w] })); return true; },
  remove: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),
  select: (id) => set({ selectedId: id }),
  selected: () => get().workouts.find((w) => w.id === get().selectedId) ?? null,
  loadBundled: async () => { try { const idx: string[] = await (await fetch('/workouts/index.json')).json(); for (const f of idx) get().add(await (await fetch(`/workouts/${f}`)).json()); } catch { /* offline or none bundled */ } },
}), { name: 'ig.workouts' }));
