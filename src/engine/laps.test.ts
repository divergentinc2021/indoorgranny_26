import { LapTracker } from './laps';
const s = (power: number, hr: number, cadence: number, speedMs: number, distanceM: number, calories: number, elapsedS: number) => ({ power, hr, cadence, speedMs, distanceM, calories, elapsedS });
describe('LapTracker', () => {
  it('closes laps with averages, lap-relative distance, and %dif HR', () => {
    const t = new LapTracker();
    t.sample(s(100, 120, 80, 5, 5, 1, 1)); t.sample(s(200, 140, 90, 5, 10, 2, 2));
    const r1 = t.close(2);
    expect(r1).toEqual({ number: 1, startOffsetS: 0, durationS: 2, distanceM: 10, calories: 2, avgPower: 150, avgCad: 85, avgSpeedMs: 5, avgHr: 130, maxPower: 200, maxHr: 140, difHrPct: null });
    t.sample(s(300, 156, 90, 10, 20, 3, 3));
    const r2 = t.close(3);
    expect(r2.number).toBe(2); expect(r2.startOffsetS).toBe(2); expect(r2.durationS).toBe(1);
    expect(r2.distanceM).toBe(10); expect(r2.calories).toBe(1);
    expect(r2.difHrPct).toBeCloseTo(20, 6);        // (156-130)/130 × 100
    expect(t.rows).toHaveLength(2);
  });
  it('current lap exposes live values and an empty lap closes with zeros', () => {
    const t = new LapTracker();
    expect(t.current.number).toBe(1);
    const r = t.close(0);
    expect(r.avgPower).toBe(0); expect(r.durationS).toBe(0); expect(r.difHrPct).toBeNull();
  });
  it('a lap closed with no HR samples after a real lap has null %dif HR, not −100', () => {
    const t = new LapTracker();
    t.sample(s(200, 130, 90, 5, 5, 1, 1));
    const real = t.close(1);
    expect(real.avgHr).toBe(130);
    const empty = t.close(2);                    // no samples since the last close
    expect(empty.avgHr).toBe(0);
    expect(empty.difHrPct).toBeNull();
  });
});

describe('LapTracker maxima and zero-HR guard', () => {
  it('tracks per-lap max power and max HR and resets them on close', () => {
    const t = new LapTracker();
    t.sample(s(100, 120, 80, 5, 5, 1, 1)); t.sample(s(300, 150, 90, 5, 10, 2, 2));
    const r1 = t.close(2);
    expect(r1.maxPower).toBe(300); expect(r1.maxHr).toBe(150);
    t.sample(s(50, 100, 90, 5, 15, 3, 3));
    const r2 = t.close(3);
    expect(r2.maxPower).toBe(50); expect(r2.maxHr).toBe(100);
  });
  it('a lap with samples but all-zero HR after a real lap has null %dif HR', () => {
    const t = new LapTracker();
    t.sample(s(200, 130, 90, 5, 5, 1, 1)); t.close(1);
    t.sample(s(200, 0, 90, 5, 10, 2, 2));
    const r = t.close(2);
    expect(r.avgHr).toBe(0); expect(r.difHrPct).toBeNull();
  });
});

describe('LapTracker names', () => {
  it('carries an optional name on the closed row', () => {
    const t = new LapTracker();
    t.sample(s(100, 120, 80, 5, 5, 1, 10));
    expect(t.close(10, 'Warm up').name).toBe('Warm up');
    expect(t.close(20).name).toBeUndefined();
  });
});
