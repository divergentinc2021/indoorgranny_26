import { RevCounter, speedMs, cadenceRpm } from './derive';

describe('RevCounter', () => {
  it('first packet yields null, second yields rate', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32 });
    expect(c.push(100, 0, 0)).toBeNull();
    expect(c.push(102, 1024, 1000)).toBeCloseTo(2, 5);      // 2 revs in 1 s
  });
  it('duplicate packet (Δt=0) yields null and keeps last value', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32 });
    c.push(0, 0, 0); c.push(1, 1024, 1000);
    expect(c.push(1, 1024, 1200)).toBeNull();
    expect(c.value(1500)).toBeCloseTo(1, 5);
  });
  it('handles 16-bit time and rev rollover', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 16 });
    c.push(65534, 65000, 0);
    expect(c.push(1, 488, 1000)).toBeCloseTo(3 / (1024 / 1024), 5);   // 3 revs, Δt=1024 ticks
  });
  it('goes stale to zero after staleMs', () => {
    const c = new RevCounter({ timeHz: 1024, revBits: 32, staleMs: 5000 });
    c.push(0, 0, 0); c.push(1, 1024, 1000);
    expect(c.value(5999)).toBeCloseTo(1, 5);
    expect(c.value(6001)).toBe(0);
  });
});

describe('conversions', () => {
  it('speed from wheel rev/s and circumference', () => { expect(speedMs(5, 2000)).toBeCloseTo(10, 6); });
  it('cadence from crank rev/s', () => { expect(cadenceRpm(1.5)).toBe(90); });
});
