// Class runner: pure, plan-anchored. The ride store calls tick(elapsedS) once a second and closes a lap whenever boundary is true.
// Boundaries are cumulative plan times (300, 360, 480 for [300, 60, 120]); a skip moves the index but never the boundaries.
import type { ClassInterval, ClassPlan } from './classplan';

export interface ClassStatus { index: number; interval: ClassInterval | null; remainingS: number; pct: number; boundary: boolean; done: boolean }

export class ClassRunner {
  private readonly ends: number[];
  private index = 0;
  private winStart = 0;
  private done = false;
  private cur: ClassStatus;

  constructor(private readonly plan: ClassPlan, private readonly anchorElapsedS: number) {
    let acc = 0;
    this.ends = plan.intervals.map((i) => (acc += i.durationS));
    this.cur = this.snap(0, false);
  }

  get status(): ClassStatus { return this.cur; }

  tick(elapsedS: number): ClassStatus {
    const c = elapsedS - this.anchorElapsedS, n = this.ends.length;
    if (this.done) return (this.cur = this.snap(c, false));
    if (c >= this.plan.totalS) { this.done = true; this.index = n; return (this.cur = this.snap(c, true)); }
    const before = this.index;
    while (this.index < n && c >= this.ends[this.index]) this.index++;
    if (this.index === before) return (this.cur = this.snap(c, false));
    this.winStart = this.ends[this.index - 1];
    return (this.cur = this.snap(c, true));
  }

  skip(elapsedS: number): ClassStatus {
    const s = this.tick(elapsedS); // flush a boundary already passed, so the skip cannot swallow a lap close
    if (s.done) return s;
    const c = elapsedS - this.anchorElapsedS;
    if (this.index + 1 >= this.ends.length) { this.done = true; this.index = this.ends.length; return (this.cur = this.snap(c, s.boundary)); }
    this.index++; this.winStart = c;
    return (this.cur = this.snap(c, s.boundary));
  }

  private snap(c: number, boundary: boolean): ClassStatus {
    if (this.done) return { index: this.ends.length, interval: null, remainingS: 0, pct: 1, boundary, done: true };
    const end = this.ends[this.index], span = end - this.winStart;
    const pct = span > 0 ? Math.min(1, Math.max(0, (c - this.winStart) / span)) : 1;
    return { index: this.index, interval: this.plan.intervals[this.index], remainingS: Math.max(0, end - c), pct, boundary, done: false };
  }
}
