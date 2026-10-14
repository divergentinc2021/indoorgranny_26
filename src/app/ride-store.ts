import { create } from 'zustand';
import { RideEngine, type RideState, type RideView } from '../engine/ride';
import type { LapRow } from '../engine/laps';
import { saveSession, type SessionRecord } from '../data/sessions';
import { remote } from '../data/remote';
import { useRiders } from './rider-store';
import { useSettings } from './settings-store';
import { useSensors } from './sensor-store';

interface S { engine: RideEngine | null; view: RideView | null; state: RideState; lapRows: LapRow[]; countdownLeft: number | null; begin(): void; pause(): void; resume(): void; lap(): void; stop(): void; save(): Promise<SessionRecord>; discard(): void }
let timer: ReturnType<typeof setInterval> | null = null;
const clear = () => { if (timer) clearInterval(timer); timer = null; };

export const useRide = create<S>((set, get) => ({
  engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null,
  begin: () => {
    const rider = useRiders.getState().current();
    const st = useSettings.getState();
    const engine = new RideEngine({ rider: { weightKg: rider?.weightKg ?? 70, ftpW: rider?.ftpW ?? 250, cpW: rider?.cpW, wprimeKj: rider?.wprimeKj ?? 20, hrMax: rider?.hrMax ?? 180 }, smoothingN: st.smoothingN });
    set({ engine, lapRows: [], view: null, state: 'idle' });
    const run = () => {
      engine.start(); set({ countdownLeft: null, state: 'recording' });
      clear();
      timer = setInterval(() => { engine.tick(useSensors.getState().live.snapshot(Date.now())); set({ view: engine.view, state: engine.state }); }, 1000);
    };
    if (st.countdownS > 0) {
      set({ countdownLeft: st.countdownS });
      clear();
      timer = setInterval(() => { const left = (get().countdownLeft ?? 1) - 1; if (left <= 0) run(); else set({ countdownLeft: left }); }, 1000);
    } else run();
  },
  pause: () => { get().engine?.pause(); set({ state: 'paused' }); },
  resume: () => { get().engine?.resume(); set({ state: 'recording' }); },
  lap: () => { const e = get().engine; if (!e || e.state !== 'recording') return; e.lap(); set({ lapRows: [...e.laps.rows], view: e.view }); },
  stop: () => { const e = get().engine; if (!e) return; e.stop(); clear(); set({ state: 'stopped', view: e.view, countdownLeft: null }); },
  save: async () => {
    const e = get().engine; if (!e) throw new Error('no ride');
    const rider = useRiders.getState().current();
    const v = e.view;
    const s: SessionRecord = { id: e.startMs, riderId: rider?.id ?? '', riderName: rider?.name ?? 'Guest', sport: 'indoor_cycling', startMs: e.startMs, durationS: Math.max(0, v.elapsedS - 1), distanceM: v.distanceM, calories: v.calories, nSamples: e.samples.length, avgPower: v.avgPower, maxPower: v.maxPower, avgHr: v.avgHr, maxHr: v.maxHr, avgCad: v.avgCad, uploaded: null, synced: false };
    await saveSession(s, e.laps.rows, e.samples);
    if (remote.enabled) void remote.pushSession(s);
    set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null });
    return s;
  },
  discard: () => { clear(); set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null }); },
}));
