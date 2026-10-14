import { WBal } from './wbal';
describe('WBal', () => {
  it('τ with no sub-CP samples uses DCP = CP', () => {
    const w = new WBal(250, 20000);
    expect(w.tau).toBeCloseTo(546 * Math.exp(-0.01 * 250) + 316, 6);
  });
  it('accumulates above CP and decays with τ', () => {
    const w = new WBal(250, 20000);
    w.tick(350);                                 // +100 J
    expect(w.expendedJ).toBeCloseTo(100, 6);
    w.tick(350);
    expect(w.expendedJ).toBeCloseTo(100 * Math.exp(-1 / w.tau) + 100, 6);
    expect(w.remainingJ).toBeCloseTo(20000 - w.expendedJ, 6);
    expect(w.pctExpended).toBeCloseTo((w.expendedJ / 20000) * 100, 6);
  });
  it('τ grows as recovery power rises (DCP falls; mean of sub-CP samples)', () => {
    const w = new WBal(250, 20000);
    const t0 = w.tau; w.tick(150); // DCP = 250-150 = 100 → τ = 546e^-1+316
    expect(w.tau).toBeCloseTo(546 * Math.exp(-1) + 316, 6);
    expect(w.tau).toBeGreaterThan(t0);
    // second instance: a stronger recovery sample (200 W, DCP = 50) gives a larger τ again
    const w200 = new WBal(250, 20000);
    w200.tick(200);
    expect(w200.tau).toBeCloseTo(546 * Math.exp(-0.5) + 316, 6);
    expect(w200.tau).toBeGreaterThan(w.tau);
  });
  it('sub-CP stats update BEFORE the decay uses τ (ordering pinned)', () => {
    const w = new WBal(250, 20000);
    w.tick(350); w.tick(350);                    // build W'exp with no sub-CP samples (τ = τ0)
    const prev = w.expendedJ;                    // W'exp after the two prior ticks
    w.tick(150);                                 // sub-CP sample: DCP 250→100, so τ becomes τ_new
    const tauNew = 546 * Math.exp(-1) + 316;
    const tauOld = 546 * Math.exp(-2.5) + 316;   // τ before the sub-CP sample
    expect(w.expendedJ).toBeCloseTo(prev * Math.exp(-1 / tauNew), 6);
    // the swapped ordering would decay with τ_old; the two must be distinguishable here
    expect(Math.abs(prev * Math.exp(-1 / tauOld) - prev * Math.exp(-1 / tauNew))).toBeGreaterThan(0.01);
  });
  it('cp fallback: cpW 0 behaves as 250', () => { expect(new WBal(0, 20000).tau).toBeCloseTo(new WBal(250, 20000).tau, 9); });
});
