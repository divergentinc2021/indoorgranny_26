import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClassPlan, isoDay, parseSecondsFile } from '../engine/classplan';
interface Res { added: number; skipped: number }
interface S {
  plans: ClassPlan[]; selectedId: string | null; autoPickedOn: string | null;
  add(plans: ClassPlan[]): Res; remove(id: string): void; select(id: string | null): void; deselect(today?: string): void; selected(): ClassPlan | null;
  todays(today?: string): ClassPlan | null; autoPickToday(today?: string): void; loadBundled(): Promise<void>; importFile(text: string): Res;
}
export const useClassPlans = create<S>()(persist((set, get) => ({
  plans: [], selectedId: null, autoPickedOn: null,
  add: (incoming) => {
    const seen = new Set(get().plans.map((p) => p.id)); const fresh: ClassPlan[] = []; let skipped = 0;
    for (const p of incoming) { if (seen.has(p.id)) skipped++; else { seen.add(p.id); fresh.push(p); } }
    if (fresh.length) set((s) => ({ plans: [...s.plans, ...fresh] }));
    return { added: fresh.length, skipped };
  },
  remove: (id) => { const p = get().plans.find((x) => x.id === id); if (!p || p.source === 'bundled') return; set((s) => ({ plans: s.plans.filter((x) => x.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })); },
  select: (id) => set({ selectedId: id }),
  // Deselecting is a manual choice for today: burn autoPickedOn so the auto-pick does not put the plan straight back.
  deselect: (today = isoDay(new Date())) => set({ selectedId: null, autoPickedOn: today }),
  selected: () => get().plans.find((p) => p.id === get().selectedId) ?? null,
  todays: (today = isoDay(new Date())) => get().plans.find((p) => p.dates.includes(today)) ?? null,
  autoPickToday: (today = isoDay(new Date())) => {
    const t = get().todays(today); if (!t || get().autoPickedOn === today) return;
    const sel = get().selected(); if (sel && sel.dates.includes(today)) return;
    set({ selectedId: t.id, autoPickedOn: today });
  },
  loadBundled: async () => { try { const idx: string[] = await (await fetch('/classplans/index.json')).json(); for (const f of idx) get().add(parseSecondsFile(await (await fetch(`/classplans/${f}`)).json(), 'bundled')); } catch { /* offline or none bundled */ } },
  importFile: (text) => get().add(parseSecondsFile(JSON.parse(text), 'seconds')),
}), { name: 'ig.classplans', partialize: (s) => ({ plans: s.plans, selectedId: s.selectedId, autoPickedOn: s.autoPickedOn }) }));
