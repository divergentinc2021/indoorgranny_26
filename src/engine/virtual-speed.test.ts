import { virtualSpeedMs } from './virtual-speed';
const f = (v: number) => 0.5 * 1.1865 * 0.388 * v ** 3 + 0.004 * 735 * v;
it('solves 0.95P = aero + rolling (vendor constants)', () => {
  expect(virtualSpeedMs(80)).toBeCloseTo(6.30, 2);
  expect(virtualSpeedMs(200)).toBeCloseTo(8.93, 2);
  for (const p of [10, 50, 120, 300, 600]) expect(f(virtualSpeedMs(p))).toBeCloseTo(0.95 * p, 1);
});
// The brief expected 2000 W to clamp at 30 m/s, but with the vendor constants the true root at 2000 W is about 20 m/s; the clamp only bites above roughly 6.5 kW.
it('clamps: 0 W → 0, 10 kW → 30 m/s, negative → 0; 2000 W solves to about 20 m/s', () => { expect(virtualSpeedMs(0)).toBe(0); expect(virtualSpeedMs(10000)).toBe(30); expect(virtualSpeedMs(2000)).toBeCloseTo(20, 0); expect(virtualSpeedMs(-5)).toBe(0); });
