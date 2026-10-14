import { Stat, caloriesMet, DistanceIntegrator, kJ, pctOf } from './metrics';
describe('Stat', () => {
  it('tracks avg, max, n and resets', () => {
    const s = new Stat(); s.push(100); s.push(300);
    expect(s.avg).toBe(200); expect(s.max).toBe(300); expect(s.n).toBe(2);
    s.reset(); expect(s.avg).toBe(0); expect(s.max).toBe(0); expect(s.n).toBe(0);
  });
});
describe('calories', () => {
  it('MET × kg × h with MET 8 default', () => { expect(caloriesMet(70, 0.5)).toBeCloseTo(280, 6); expect(caloriesMet(70, 1, 4)).toBe(280); });
});
describe('DistanceIntegrator', () => {
  it('trapezoid of speed over dt', () => {
    const d = new DistanceIntegrator();
    expect(d.push(10, 1)).toBeCloseTo(5, 6);     // first sample: (0+10)/2 × 1
    expect(d.push(10, 1)).toBeCloseTo(15, 6);
  });
});
describe('kJ and pct', () => {
  it('kJ = avgW × s / 1000', () => { expect(kJ(200, 3600)).toBe(720); });
  it('pctOf guards zero reference', () => { expect(pctOf(125, 250)).toBe(50); expect(pctOf(10, 0)).toBe(0); });
});
