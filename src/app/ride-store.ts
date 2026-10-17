import { create } from 'zustand';
import { RideEngine, type RideState, type RideView } from '../engine/ride';
import type { LapRow } from '../engine/laps';
import { saveSession, deleteSession, type SessionRecord } from '../data/sessions';
import { remote } from '../data/remote';
import { useRiders } from './rider-store';
import type { Rider } from '../data/riders';
import { useSettings } from './settings-store';
import { useSensors } from './sensor-store';
import { useClassPlans } from './classplan-store';
import { ClassRunner, type ClassStatus } from '../engine/classrun';
import type { ClassPlan } from '../engine/classplan';
import { classAlert, prepareAudio } from './alerts';

type ClassPhase = 'none' | 'warmup' | 'class' | 'done';
interface S { storageError: string | null; engine: RideEngine | null; view: RideView | null; state: RideState; lapRows: LapRow[]; countdownLeft: number | null; classPhase: ClassPhase; classStatus: ClassStatus | null; begin(opts?: { skipCountdown?: boolean; classMode?: 'warmup' | 'class' }): void; startClass(): void; pause(): void; resume(): void; lap(): void; stop(): void; save(): Promise<SessionRecord>; discard(): void }
let timer: ReturnType<typeof setInterval> | null = null;
// Tail of the most recent partial flush; discard() waits on it so a late flush can never resurrect a deleted row.
let lastFlush: Promise<unknown> = Promise.resolve();
const FLUSH_ERROR = 'Could not save history — your ride is still on screen';
const DISCARD_ERROR = 'Could not delete the discarded ride — it will still show in Logs';
const clear = () => { if (timer) clearInterval(timer); timer = null; };
// Class runner state lives beside the timer: the plan is captured at begin() like the rider, so changing the selection mid-ride cannot re-plan it.
let runner: ClassRunner | null = null;
let ridePlan: ClassPlan | undefined;
let doneTimer: ReturnType<typeof setTimeout> | null = null;
const DONE_HOLD_MS = 5000;
const clearClass = () => { if (doneTimer) clearTimeout(doneTimer); doneTimer = null; runner = null; };
// Close one lap per plan interval in [from, to): a boundary tick, a skip and a flush all go through here so every interval gets exactly one named row.
const closeIntervals = (e: RideEngine, from: number, to: number) => { for (let i = from; i < to; i++) e.lap(ridePlan?.intervals[i]?.name); };
// The rider is captured at begin(): picking someone else mid-ride must not re-label (or re-weigh) the ride in progress.
type RideRider = Pick<Rider, 'id' | 'name' | 'weightKg' | 'ftpW' | 'cpW' | 'wprimeKj' | 'hrMax'>;
let rideRider: RideRider | undefined;
const toRecord = (e: RideEngine, rider: RideRider | undefined): SessionRecord => {
  const v = e.view;
  return { id: e.startMs, riderId: rider?.id ?? '', riderName: rider?.name ?? 'Guest', sport: 'indoor_cycling', startMs: e.startMs, durationS: Math.max(0, v.elapsedS - 1), distanceM: v.distanceM, calories: v.calories, nSamples: e.samples.length, avgPower: v.avgPower, maxPower: v.maxPower, avgHr: v.avgHr, maxHr: v.maxHr, avgCad: v.avgCad, uploaded: null, synced: false, planId: ridePlan?.id, planTitle: ridePlan?.title };
};

const scheduleReset = () => {
  if (doneTimer) clearTimeout(doneTimer);
  doneTimer = setTimeout(() => { doneTimer = null; runner = null; useRide.setState({ classPhase: 'none', classStatus: null }); }, DONE_HOLD_MS);
};

export const useRide = create<S>((set, get) => ({
  storageError: null, engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null, classPhase: 'none', classStatus: null,
  begin: (opts) => {
    if (get().state === 'recording' || get().state === 'paused') return;
    const cur = useRiders.getState().current();
    rideRider = cur && { id: cur.id, name: cur.name, weightKg: cur.weightKg, ftpW: cur.ftpW, cpW: cur.cpW, wprimeKj: cur.wprimeKj, hrMax: cur.hrMax };
    const rider = rideRider;
    clearClass();
    ridePlan = opts?.classMode ? useClassPlans.getState().selected() ?? undefined : undefined;
    const mode = ridePlan ? opts?.classMode : undefined;
    if (mode) prepareAudio();
    const st = useSettings.getState();
    const engine = new RideEngine({ rider: { weightKg: rider?.weightKg ?? 70, ftpW: rider?.ftpW ?? 250, cpW: rider?.cpW, wprimeKj: rider?.wprimeKj ?? 20, hrMax: rider?.hrMax ?? 180 }, smoothingN: st.smoothingN });
    set({ engine, lapRows: [], view: null, state: 'idle', storageError: null, classPhase: mode ?? 'none', classStatus: null });
    const run = () => {
      engine.start();
      if (mode === 'class' && ridePlan) runner = new ClassRunner(ridePlan, 0);
      set({ countdownLeft: null, state: 'recording', classStatus: runner?.status ?? null });
      clear();
      timer = setInterval(() => {
        const sample = engine.tick(useSensors.getState().live.snapshot(Date.now()));
        // The plan clock is engine elapsed, which freezes while paused: no sample, no runner tick.
        let cls: Partial<S> = {};
        if (sample && runner && ridePlan) {
          const from = runner.status.index, status = runner.tick(engine.view.elapsedS);
          cls = { classStatus: status };
          if (status.boundary) { closeIntervals(engine, from, status.index); classAlert(useSettings.getState().classAlerts); cls.lapRows = [...engine.laps.rows]; }
          if (status.done && get().classPhase === 'class') { cls.classPhase = 'done'; scheduleReset(); }
        }
        set({ view: engine.view, state: engine.state, ...cls });
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
  startClass: () => {
    const e = get().engine; if (!e || e.state !== 'recording' || get().classPhase !== 'warmup' || !ridePlan) return;
    e.lap('Warm up'); prepareAudio();
    runner = new ClassRunner(ridePlan, e.view.elapsedS);
    set({ classPhase: 'class', classStatus: runner.status, lapRows: [...e.laps.rows], view: e.view });
  },
  pause: () => { const e = get().engine; if (!e) return; e.pause(); set({ state: e.state }); },
  resume: () => { const e = get().engine; if (!e) return; e.resume(); set({ state: e.state }); },
  lap: () => {
    const e = get().engine; if (!e || e.state !== 'recording') return;
    if (runner && ridePlan && get().classPhase === 'class') {
      // skip() first flushes a boundary that already passed (index +1) and then skips the current interval (index +1 more); one named row per interval either way.
      const from = runner.status.index, status = runner.skip(e.view.elapsedS);
      closeIntervals(e, from, status.index);
      if (status.boundary) classAlert(useSettings.getState().classAlerts);
      set({ lapRows: [...e.laps.rows], view: e.view, classStatus: status, ...(status.done ? { classPhase: 'done' as const } : {}) });
      if (status.done) scheduleReset();
      return;
    }
    e.lap(); set({ lapRows: [...e.laps.rows], view: e.view });
  },
  stop: () => {
    const e = get().engine; if (!e) return;
    // Stopping during the countdown (engine still idle) means there is nothing to keep: behave as discard.
    if (e.state === 'idle') { get().discard(); return; }
    // Flush a boundary the 1 Hz tick has not seen yet, then name the final partial lap after the interval the rider was in.
    let lastName: string | undefined;
    if (e.state === 'paused') e.resume();   // engine.stop() resumes anyway; doing it first lets the class block below run for a paused stop too
    if (runner && ridePlan && get().classPhase === 'class' && e.state === 'recording') {
      const from = runner.status.index, status = runner.tick(e.view.elapsedS);
      if (status.boundary) closeIntervals(e, from, status.index);
      lastName = status.interval?.name;
    }
    e.stop(lastName); clear(); clearClass(); set({ state: e.state, view: e.view, lapRows: [...e.laps.rows], countdownLeft: null, classPhase: 'none', classStatus: null });
  },
  save: async () => {
    const e = get().engine; if (!e) throw new Error('no ride');
    if (e.state !== 'stopped') throw new Error('ride not stopped');
    clear();
    const s = toRecord(e, rideRider);
    await saveSession(s, e.laps.rows, e.samples);
    if (remote.enabled) void remote.pushSession(s);
    clearClass(); set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null, storageError: null, classPhase: 'none', classStatus: null });
    return s;
  },
  discard: () => { const e = get().engine; if (e && e.startMs) { const id = e.startMs; void lastFlush.then(() => deleteSession(id)).catch(() => { set({ storageError: DISCARD_ERROR }); }); } clear(); clearClass(); set({ engine: null, view: null, state: 'idle', lapRows: [], countdownLeft: null, classPhase: 'none', classStatus: null }); },
}));
