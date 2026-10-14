import { Ema } from './smoothing';
describe('Ema', () => {
  it('n=1 passes values through', () => { const e = new Ema(1); expect(e.push(100)).toBe(100); expect(e.push(50)).toBe(50); });
  it('running mean until n samples, then EMA', () => {
    const e = new Ema(5);
    expect(e.push(100)).toBe(100);
    expect(e.push(200)).toBe(150);
    e.push(300); e.push(400);
    expect(e.push(500)).toBe(300);                           // mean of 5
    expect(e.push(600)).toBeCloseTo(300 + (2 / 6) * 300, 6); // α = 2/(5+1)
  });
});
