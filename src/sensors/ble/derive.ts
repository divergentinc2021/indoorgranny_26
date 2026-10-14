export interface RevCounterOpts { timeHz: number; revBits: 16 | 32; staleMs?: number }

export class RevCounter {
  private lastRevs: number | null = null;
  private lastTime = 0;
  private lastAt = 0;
  private rate = 0;
  private readonly revMod: number;
  private readonly staleMs: number;
  constructor(private readonly o: RevCounterOpts) {
    this.revMod = o.revBits === 16 ? 0x10000 : 0x100000000;
    this.staleMs = o.staleMs ?? 5000;
  }
  push(revs: number, time: number, nowMs: number): number | null {
    if (this.lastRevs === null) { this.lastRevs = revs; this.lastTime = time; this.lastAt = nowMs; return null; }
    const dRev = (revs - this.lastRevs + this.revMod) % this.revMod;
    const dT = (time - this.lastTime + 0x10000) % 0x10000;
    if (dT === 0) return null;
    this.lastRevs = revs; this.lastTime = time; this.lastAt = nowMs;
    this.rate = dRev / (dT / this.o.timeHz);
    return this.rate;
  }
  value(nowMs: number): number { return nowMs - this.lastAt > this.staleMs ? 0 : this.rate; }
}

export const speedMs = (revPerSec: number, circumferenceMm: number) => (revPerSec * circumferenceMm) / 1000;
export const cadenceRpm = (revPerSec: number) => Math.round(revPerSec * 60);
