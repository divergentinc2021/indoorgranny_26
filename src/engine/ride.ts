import { Stat, DistanceIntegrator, caloriesMet, kJ, pctOf } from './metrics';
import { LapTracker, LapRow } from './laps';
import { WBal } from './wbal';
import { Ema } from './smoothing';

export interface LiveInput { hr: number; power: number; cadence: number; speedMs: number; trainerDistanceM?: number; trainerKcal?: number }
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

  constructor(private readonly o: RideOpts) {
    this.now = o.now ?? (() => Date.now());
    this.wbal = new WBal(o.rider.cpW ?? o.rider.ftpW, o.rider.wprimeKj * 1000);
    this.emaP = new Ema(o.smoothingN); this.emaC = new Ema(o.smoothingN);
  }
  start() { if (this.state !== 'idle') return; this.state = 'recording'; this.startMs = this.now(); this.lastTickMs = this.startMs; }
  pause() { if (this.state !== 'recording') return; this.state = 'paused'; this.pauseStartedAt = this.now(); }
  resume() { if (this.state !== 'paused') return; this.pausedMs += this.now() - this.pauseStartedAt; this.state = 'recording'; this.lastTickMs = this.now(); }
  stop() { if (this.state === 'paused') this.resume(); if (this.state === 'recording') { this.stopMs = this.now(); this.state = 'stopped'; } }
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
    this.last = input;
    this.power.push(input.power); this.hr.push(input.hr); this.cad.push(input.cadence);
    this.emaP.push(input.power); this.emaC.push(input.cadence);
    this.wbal.tick(input.power);
    const elapsedS = this.elapsedS();
    this.distanceM = input.trainerDistanceM ?? this.dist.push(input.speedMs, dtS);
    this.calories = input.trainerKcal ?? caloriesMet(this.o.rider.weightKg, (elapsedS - 1) / 3600);
    this.laps.sample({ power: input.power, hr: input.hr, cadence: input.cadence, speedMs: input.speedMs, distanceM: this.distanceM, calories: this.calories, elapsedS });
    const s: Sample = { t: elapsedS, hr: input.hr, cadence: input.cadence, power: input.power, lap: this.laps.current.number, distanceM: this.distanceM, speedMs: input.speedMs };
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
    };
  }
}
