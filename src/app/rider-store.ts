import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Rider, listRiders, putRider, deleteRider } from '../data/riders';
interface S { riders: Rider[]; currentId: string | null; load(): Promise<void>; save(r: Rider): Promise<void>; remove(id: string): Promise<void>; select(id: string | null): void; current(): Rider | undefined }
export const useRiders = create<S>()(persist((set, get) => ({
  riders: [], currentId: null,
  load: async () => { set({ riders: await listRiders() }); },
  save: async (r) => { await putRider(r); await get().load(); },
  remove: async (id) => { await deleteRider(id); if (get().currentId === id) set({ currentId: null }); await get().load(); },
  select: (id) => set({ currentId: id }),
  current: () => get().riders.find((r) => r.id === get().currentId),
}), { name: 'ig.rider', partialize: (s) => ({ currentId: s.currentId }) as S }));
