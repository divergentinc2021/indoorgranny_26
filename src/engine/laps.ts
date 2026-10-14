import { Stat } from './metrics';
export interface LapRow { number: number; startOffsetS: number; durationS: number; distanceM: number; calories: number; avgPower: number; avgCad: number; avgSpeedMs: number; avgHr: number; maxPower: number; maxHr: number; difHrPct: number | null }
export interface LapSample { power: number; hr: number; cadence: number; speedMs: number; distanceM: number; calories: number; elapsedS: number }

export class LapTracker {
  rows: LapRow[] = [];
  private n = 1;
  private start: number;
  private startDist = 0; private startCal = 0;
  private lastDist = 0; private lastCal = 0; private lastElapsed: number;
  private power = new Stat(); private hr = new Stat(); private cad = new Stat(); private speed = new Stat();
  constructor(startOffsetS = 0) { this.start = startOffsetS; this.lastElapsed = startOffsetS; }
  sample(s: LapSample) {
    this.power.push(s.power); this.hr.push(s.hr); this.cad.push(s.cadence); this.speed.push(s.speedMs);
    this.lastDist = s.distanceM; this.lastCal = s.calories; this.lastElapsed = s.elapsedS;
  }
  get current() {
    return { number: this.n, samples: this.power.n, durationS: this.lastElapsed - this.start, avgPower: this.power.avg, avgHr: this.hr.avg, avgCad: this.cad.avg, distanceM: this.lastDist - this.startDist };
  }
  close(elapsedS: number): LapRow {
    const prev = this.rows[this.rows.length - 1];
    const avgHr = this.hr.avg;
    const row: LapRow = {
      number: this.n, startOffsetS: this.start, durationS: elapsedS - this.start,
      distanceM: this.lastDist - this.startDist, calories: this.lastCal - this.startCal,
      avgPower: this.power.avg, avgCad: this.cad.avg, avgSpeedMs: this.speed.avg, avgHr, maxPower: this.power.max, maxHr: this.hr.max,
      difHrPct: prev && prev.avgHr > 0 && this.hr.n > 0 && avgHr > 0 ? ((avgHr - prev.avgHr) / prev.avgHr) * 100 : null,
    };
    this.rows.push(row);
    this.n++; this.start = elapsedS; this.startDist = this.lastDist; this.startCal = this.lastCal; this.lastElapsed = elapsedS;
    this.power.reset(); this.hr.reset(); this.cad.reset(); this.speed.reset();
    return row;
  }
}
