import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PairedDevice, Slot } from '../sensors/types';
export interface Settings { unitSystem: 'metric' | 'imperial'; countdownS: 0 | 5 | 3600 | 7200 | 10800; smoothingN: 1 | 5 | 10 | 30; wheelMm: number; structuredWorkoutEnabled: boolean; licenseAccepted: boolean; devices: Partial<Record<Slot, PairedDevice>>; workoutId: string | null }
interface Actions { set(p: Partial<Settings>): void; setDevice(slot: Slot, d: PairedDevice | undefined): void }
export const useSettings = create<Settings & Actions>()(persist((set) => ({
  unitSystem: 'metric', countdownS: 0, smoothingN: 1, wheelMm: 1782, structuredWorkoutEnabled: false, licenseAccepted: false, devices: {}, workoutId: null,
  set: (p) => set(p),
  setDevice: (slot, d) => set((s) => { const devices = { ...s.devices }; if (d) devices[slot] = d; else delete devices[slot]; return { devices }; }),
}), { name: 'ig.settings' }));
