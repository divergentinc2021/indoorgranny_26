export class Stat {
  private sum = 0; n = 0; max = 0;
  push(x: number) { this.sum += x; this.n++; if (x > this.max) this.max = x; }
  get avg() { return this.n ? this.sum / this.n : 0; }
  reset() { this.sum = 0; this.n = 0; this.max = 0; }
}
/**
 * Accumulates a device-side running total (trainer distance / kcal) as growth since the first value seen.
 * A value that goes down (the trainer reset its counter) adds nothing, so the total never goes backwards;
 * an absent value holds the total.
 */
export class Cumulative {
  total = 0; private lastV: number | undefined;
  get seen() { return this.lastV !== undefined; }
  push(v: number | undefined) {
    if (v === undefined || !Number.isFinite(v)) return this.total;
    if (this.lastV !== undefined) this.total += Math.max(0, v - this.lastV);
    this.lastV = v;
    return this.total;
  }
}
export const caloriesMet = (weightKg: number, hours: number, met = 8) => met * weightKg * hours;
export class DistanceIntegrator {
  meters = 0; private last = 0;
  push(speedMs: number, dtS: number) { this.meters += ((this.last + speedMs) / 2) * dtS; this.last = speedMs; return this.meters; }
  reset() { this.meters = 0; this.last = 0; }
}
export const kJ = (avgPowerW: number, elapsedS: number) => (avgPowerW * elapsedS) / 1000;
export const pctOf = (value: number, ref: number) => (ref > 0 ? (value / ref) * 100 : 0);
