import { create } from 'zustand';
import { RideEngine, type RideState, type RideView } from '../engine/ride';
import type { LapRow } from '../engine/laps';
import { saveSession, deleteSession, type SessionRecord } from '../data/sessions';
import { remote } from '../data/remote';
import { useRiders } from './rider-store';
import type { Rider } from '../data/riders';
import { useSettings } from './settings-store';
import { useSensors } from './sensor-store';

interface S { storageError: string | null; engine: RideEngine | null; view: RideView | null; state: RideState; lapRows: LapRow[]; countdownLeft: number | null; begin(opts?: { skipCountdown?: boolean }): void; pause(): void; resume(): void; lap(): void; stop(): void; save(): Promise<SessionRecord>; discard(): void }
let timer: ReturnType<typeof setInterval> | null = null;
// Tail of the most recent partial flush; discard() waits on it so a late flush can never resurrect a deleted row.
let lastFlush: Promise<unknown> = Promise.resolve();
const FLUSH_ERROR = 'Could not save history — your ride is still on screen';
const DISCARD_ERROR = 'Could not delete the discarded ride — it will still show in Logs';
const clear = () => { if (timer) clearInterval(timer); timer = null; };
// The rider is captured at begin(): picking someone else mid-ride must not re-label (or re-weigh) the ride in progress.
type RideRider = Pick<Rider, 'id' | 'name' | 'weightKg' | 'ftpW' | 'cpW' | 'wprimeKj' | 'hrMax'>;
let rideRider: RideRider | undefined;
const toRecord = (e: RideEngine, rider: RideRider | undefined): SessionRecord => {
  const v = e.view;
  return { id: e.startMs, riderId: rider?.id ?? '', riderName: rider?.name ?? 'Guest', sport: 'indoor_cycling', startMs: e.startMs, durationS: Math.max(0, v.elapsedS - 1), distanceM: v.distanceM, calories: v.calories, nSamples: e.samples.length, avgPower: v.avgPower, maxPower: v.maxPower, avgHr: v.avgHr, maxHr: v.maxHr, avgCad: v.avgCad, uploaded: null, synced: false };
};

export const useRide = create<S>((set, get) => ({
  storageError: null, engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null,
  begin: (opts) => {
    if (get().state === 'recording' || get().state === 'paused') return;
    const cur = useRiders.getState().current();
    rideRider = cur && { id: cur.id, name: cur.name, weightKg: cur.weightKg, ftpW: cur.ftpW, cpW: cur.cpW, wprimeKj: cur.wprimeKj, hrMax: cur.hrMax };
    const rider = rideRider;
    const st = useSettings.getState();
    const engine = new RideEngine({ rider: { weightKg: rider?.weightKg ?? 70, ftpW: rider?.ftpW ?? 250, cpW: rider?.cpW, wprimeKj: rider?.wprimeKj ?? 20, hrMax: rider?.hrMax ?? 180 }, smoothingN: st.smoothingN });
    set({ engine, lapRows: [], view: null, state: 'idle', storageError: null });
    const run = () => {
      engine.start(); set({ countdownLeft: null, state: 'recording' });
      clear();
      timer = setInterval(() => {
        const sample = engine.tick(useSensors.getState().live.snapshot(Date.now()));
        set({ view: engine.view, state: engine.state });
        // Partial flush: a crash or tab kill loses at most ~10 s. saveSession uses put, so repeats are idempotent.
        // Gate on the tick result: tick() returns null while paused, so the length stays frozen and would re-flush every second.
        if (sample && engine.samples.length % 10 === 0) lastFlush = saveSession(toRecord(engine, rideRider), engine.laps.rows, engine.samples.slice(-10)).catch(() => { set({ storageError: FLUSH_ERROR }); });
      }, 1000);
    };
    if (st.countdownS > 0 && !opts?.skipCountdown) {
      set({ countdownLeft: st.countdownS });
      clear();
      timer = setInterval(() => { const left = (get().countdownLeft ?? 1) - 1; if (left <= 0) run(); else set({ countdownLeft: left }); }, 1000);
    } else run();
  },
  pause: () => { const e = get().engine; if (!e) return; e.pause(); set({ state: e.state }); },
  resume: () => { const e = get().engine; if (!e) return; e.resume(); set({ state: e.state }); },
  lap: () => { const e = get().engine; if (!e || e.state !== 'recording') return; e.lap(); set({ lapRows: [...e.laps.rows], view: e.view }); },
  stop: () => {
    const e = get().engine; if (!e) return;
    // Stopping during the countdown (engine still idle) means there is nothing to keep: behave as discard.
    if (e.state === 'idle') { get().discard(); return; }
    e.stop(); clear(); set({ state: e.state, view: e.view, lapRows: [...e.laps.rows], countdownLeft: null });
  },
  save: async () => {
    const e = get().engine; if (!e) throw new Error('no ride');
    if (e.state !== 'stopped') throw new Error('ride not stopped');
    clear();
    const s = toRecord(e, rideRider);
    await saveSession(s, e.laps.rows, e.samples);
    if (remote.enabled) void remote.pushSession(s);
    set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null, storageError: null });
    return s;
  },
  discard: () => { const e = get().engine; if (e && e.startMs) { const id = e.startMs; void lastFlush.then(() => deleteSession(id)).catch(() => { set({ storageError: DISCARD_ERROR }); }); } clear(); set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null }); },
}));
