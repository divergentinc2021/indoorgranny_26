import { create } from 'zustand';
import { BleAdapter } from '../sensors/ble/adapter';
import { LiveStore } from '../sensors/live-store';
import { type SensorKind, type SensorState, type Slot, SLOT_KINDS, SLOT_PRIORITY } from '../sensors/types';
import { useSettings } from './settings-store';

interface S { adapter: BleAdapter; live: LiveStore; states: Record<Slot, SensorState>; messages: Partial<Record<Slot, string>>; values: Partial<Record<SensorKind, number>>; pair(slot: Slot): Promise<void>; forget(slot: Slot): Promise<void>; reconnectAll(): Promise<void> }
const adapter = new BleAdapter({ circumferenceMm: () => useSettings.getState().wheelMm });
const live = new LiveStore();
const pairedSlots = () => SLOT_PRIORITY.filter((s) => useSettings.getState().devices[s]);
live.setPaired(pairedSlots());
useSettings.subscribe(() => live.setPaired(pairedSlots()));

export const useSensors = create<S>((set, get) => {
  adapter.onReading((r) => { if (live.accept(r)) set((s) => ({ values: { ...s.values, [r.kind]: r.value } })); });
  adapter.onState((slot, st, msg) => set((s) => ({ states: { ...s.states, [slot]: st }, messages: { ...s.messages, [slot]: msg } })));
  return {
    adapter, live, states: { hr: 'unpaired', power: 'unpaired', csc: 'unpaired', trainer: 'unpaired' }, messages: {}, values: {},
    pair: async (slot) => { try { const d = await adapter.pair(slot); useSettings.getState().setDevice(slot, d); } catch (e) { set((s) => ({ states: { ...s.states, [slot]: 'unpaired' }, messages: { ...s.messages, [slot]: (e as Error).message } })); } },
    forget: async (slot) => { const d = useSettings.getState().devices[slot]; if (d) await adapter.disconnect(d); useSettings.getState().setDevice(slot, undefined);
      // Drop this slot's kinds from the mirror, except kinds another still-paired slot supplies.
      const others = new Set(pairedSlots().flatMap((o) => SLOT_KINDS[o]));
      set((s) => { const values = { ...s.values }; for (const k of SLOT_KINDS[slot]) if (!others.has(k)) delete values[k]; return { values }; });
    },
    reconnectAll: async () => { for (const slot of pairedSlots()) { const d = useSettings.getState().devices[slot]!; if (get().states[slot] !== 'connected') await adapter.connect(d); } },
  };
});
