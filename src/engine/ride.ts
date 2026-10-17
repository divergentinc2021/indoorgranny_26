import { Stat, DistanceIntegrator, Cumulative, caloriesMet, kJ, pctOf } from './metrics';
import { LapTracker, LapRow } from './laps';
import { WBal } from './wbal';
import { Ema } from './smoothing';
import { virtualSpeedMs } from './virtual-speed';

export interface LiveInput { hr: number; power: number; cadence: number; speedMs: number; speedSensorPresent?: boolean; trainerDistanceM?: number; trainerKcal?: number }
export interface RiderParams { weightKg: number; ftpW: number; cpW?: number; wprimeKj: number; hrMax: number }
export interface RideOpts { rider: RiderParams; smoothingN: 1 | 5 | 10 | 30; now?: () => number }
export type RideState = 'idle' | 'recording' | 'paused' | 'stopped';
export interface Sample { t: number; hr: number; cadence: number; power: number; lap: number; distanceM: number; speedMs: number }
export interface RideView {
  elapsedS: number; lapS: number; prevLapS: number | null;
  power: number; powerSmooth: number; avgPower: number; maxPower: number;
  hr: number; avgHr: number; maxHr: number;
  cadence: number; cadenceSmooth: number; avgCad: number; maxCad: number;
  speedMs: number; distanceM: number; calories: number; kJ: number; pctFtp: number; pctHrMax: number;
  wbalPct: number; wbalRemainingJ: number; lapNumber: number;
  speedSource: 'sensor' | 'trainer' | 'virtual' | 'none';
}

export class RideEngine {
  state: RideState = 'idle';
  samples: Sample[] = [];
  laps = new LapTracker();
  startMs = 0;
  private stopMs = 0;
  private pausedMs = 0; private pauseStartedAt = 0;
  private readonly now: () => number;
  private power = new Stat(); private hr = new Stat(); private cad = new Stat();
  private dist = new DistanceIntegrator();
  private wbal: WBal;
  private emaP: Ema; private emaC: Ema;
  private last: LiveInput = { hr: 0, power: 0, cadence: 0, speedMs: 0 };
  private distanceM = 0; private calories = 0; private lastTickMs = 0;
  // Trainer totals are measured as growth since the first value; once a trainer has supplied one the integrator/MET estimate is retired for the ride.
  private trainerDist = new Cumulative(); private trainerKcal = new Cumulative();
  private distCarry = 0; private kcalCarry = 0;
  // Decided per ride: a wheel/trainer speed sensor, once seen, owns speed for good; otherwise power > 0 gives a virtual (estimated) speed.
  private speedMode: 'undecided' | 'sensor' | 'virtual' = 'undecided';

  constructor(private readonly o: RideOpts) {
    this.now = o.now ?? (() => Date.now());
    this.wbal = new WBal(o.rider.cpW ?? o.rider.ftpW, o.rider.wprimeKj * 1000);
    this.emaP = new Ema(o.smoothingN); this.emaC = new Ema(o.smoothingN);
  }
  start() { if (this.state !== 'idle') return; this.state = 'recording'; this.startMs = this.now(); this.lastTickMs = this.startMs; }
  pause() { if (this.state !== 'recording') return; this.state = 'paused'; this.pauseStartedAt = this.now(); }
  resume() { if (this.state !== 'paused') return; this.pausedMs += this.now() - this.pauseStartedAt; this.state = 'recording'; this.lastTickMs = this.now(); }
  stop() {
    if (this.state === 'paused') this.resume();
    if (this.state !== 'recording') return;
    this.stopMs = this.now(); this.state = 'stopped';
    // Close the open lap so the final stretch is not lost from the table and the FIT file (spec §5: final row uses kJ / 4.184).
    if (this.laps.current.samples > 0) {
      const row = this.laps.close(this.elapsedS());
      row.calories = kJ(row.avgPower, row.durationS) / 4.184;
    }
  }
  lap(): LapRow | null { return this.state === 'recording' ? this.laps.close(this.elapsedS()) : null; }

  private elapsedS(): number {
    if (this.state === 'idle') return 0;
    const end = this.state === 'paused' ? this.pauseStartedAt : this.state === 'stopped' ? this.stopMs : this.now();
    return Math.floor((end - this.startMs - this.pausedMs) / 1000) + 1;
  }

  tick(input: LiveInput): Sample | null {
    if (this.state !== 'recording') return null;
    const nowMs = this.now();
    const dtS = this.samples.length ? Math.max(0, (nowMs - this.lastTickMs) / 1000) : 1;
    this.lastTickMs = nowMs;
    if (input.speedSensorPresent) this.speedMode = 'sensor';
    const speedMs = this.speedMode === 'sensor' ? input.speedMs : input.power > 0 ? (this.speedMode = 'virtual', virtualSpeedMs(input.power)) : input.speedMs;
    this.last = { ...input, speedMs };
    this.power.push(input.power); this.hr.push(input.hr); this.cad.push(input.cadence);
    this.emaP.push(input.power); this.emaC.push(input.cadence);
    this.wbal.tick(input.power);
    const elapsedS = this.elapsedS();
    const integrated = this.dist.push(speedMs, dtS);
    if (!this.trainerDist.seen && input.trainerDistanceM !== undefined) this.distCarry = this.distanceM;
    if (!this.trainerKcal.seen && input.trainerKcal !== undefined) this.kcalCarry = this.calories;
    this.trainerDist.push(input.trainerDistanceM); this.trainerKcal.push(input.trainerKcal);
    this.distanceM = this.trainerDist.seen ? this.distCarry + this.trainerDist.total : integrated;
    this.calories = this.trainerKcal.seen ? this.kcalCarry + this.trainerKcal.total : caloriesMet(this.o.rider.weightKg, (elapsedS - 1) / 3600);
    this.laps.sample({ power: input.power, hr: input.hr, cadence: input.cadence, speedMs, distanceM: this.distanceM, calories: this.calories, elapsedS });
    const prevT = this.samples.length ? this.samples[this.samples.length - 1].t : 0;
    const t = Math.max(prevT + 1, elapsedS); // a sub-second pause can repeat the floored second; sample keys must be unique
    const s: Sample = { t, hr: input.hr, cadence: input.cadence, power: input.power, lap: this.laps.current.number, distanceM: this.distanceM, speedMs };
    this.samples.push(s);
    return s;
  }

  get view(): RideView {
    const elapsedS = this.elapsedS();
    const prev = this.laps.rows[this.laps.rows.length - 1];
    return {
      elapsedS, lapS: this.laps.current.durationS, prevLapS: prev ? prev.durationS : null,
      power: this.last.power, powerSmooth: this.emaP.value, avgPower: this.power.avg, maxPower: this.power.max,
      hr: this.last.hr, avgHr: this.hr.avg, maxHr: this.hr.max,
      cadence: this.last.cadence, cadenceSmooth: this.emaC.value, avgCad: this.cad.avg, maxCad: this.cad.max,
      speedMs: this.last.speedMs, distanceM: this.distanceM, calories: this.calories,
      kJ: kJ(this.power.avg, elapsedS), pctFtp: pctOf(this.last.power, this.o.rider.ftpW), pctHrMax: pctOf(this.last.hr, this.o.rider.hrMax),
      wbalPct: this.wbal.pctExpended, wbalRemainingJ: this.wbal.remainingJ, lapNumber: this.laps.current.number,
      speedSource: this.trainerDist.seen ? 'trainer' : this.speedMode === 'undecided' ? 'none' : this.speedMode,
    };
  }
}
