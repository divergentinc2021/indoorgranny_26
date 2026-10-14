import { RideEngine } from './ride';
const rider = { weightKg: 70, ftpW: 250, cpW: 250, wprimeKj: 20, hrMax: 180 };
function mk(smoothingN: 1 | 5 | 10 | 30 = 1) {
  let t = 1_000_000;
  const e = new RideEngine({ rider, smoothingN, now: () => t });
  return { e, advance: (ms: number) => { t += ms; } };
}
const live = (power: number, hr = 120, cadence = 90, speedMs = 8) => ({ hr, power, cadence, speedMs });

describe('RideEngine', () => {
  it('idle → recording → stopped, elapsed counts from 1 like the vendor', () => {
    const { e, advance } = mk();
    expect(e.state).toBe('idle');
    e.start(); expect(e.state).toBe('recording');
    expect(e.tick(live(200))).toMatchObject({ t: 1, power: 200, lap: 1 });
    advance(1000); e.tick(live(300));
    expect(e.view.elapsedS).toBe(2); expect(e.view.avgPower).toBe(250); expect(e.view.maxPower).toBe(300);
    e.stop(); expect(e.state).toBe('stopped'); expect(e.tick(live(100))).toBeNull();
    expect(e.samples).toHaveLength(2);
  });
  it('pause excludes time and writes no samples; resume continues', () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(200)); advance(1000);
    e.pause(); expect(e.state).toBe('paused');
    advance(5000); expect(e.tick(live(999))).toBeNull();
    e.resume(); advance(1000); e.tick(live(200));
    expect(e.view.elapsedS).toBe(3);          // 1 s + 1 s, pause excluded, +1 vendor offset
    expect(e.samples).toHaveLength(2); expect(e.view.avgPower).toBe(200);
  });
  it('laps, kJ, %FTP, %HRmax, distance, calories', () => {
    const { e, advance } = mk();
    e.start();
    for (let i = 0; i < 60; i++) { e.tick(live(250, 90, 90, 10)); advance(1000); }
    const row = e.lap();
    expect(row.number).toBe(1); expect(row.avgPower).toBe(250); expect(e.view.lapNumber).toBe(2);
    expect(e.view.pctFtp).toBe(100); expect(e.view.pctHrMax).toBe(50);
    expect(e.view.kJ).toBeCloseTo((250 * 61) / 1000, 6);        // elapsed is 61 after 60 advances
    expect(e.view.distanceM).toBeCloseTo(595, 0);               // 5 (first half-trapezoid) + 59 × 10
    expect(e.view.calories).toBeCloseTo(8 * 70 * (59 / 3600), 6);     // last tick at t=59 s → elapsed 60 → (60 − 1)/3600 h
    e.tick(live(250, 90, 90, 10)); advance(1000);
    expect(e.view.lapS).toBe(0); expect(e.view.prevLapS).toBe(61); // lap closed at elapsed 61; next tick (t=60 s) is also elapsed 61 → 0 s into lap 2
    e.tick(live(250, 90, 90, 10));                                  // t=61 s → elapsed 62
    expect(e.view.lapS).toBe(1); expect(e.samples[e.samples.length - 1].lap).toBe(2);
  });
  it('trainer distance and kcal override integration when present', () => {
    const { e, advance } = mk();
    e.start(); e.tick({ ...live(100), trainerDistanceM: 1234, trainerKcal: 42 }); advance(1000);
    expect(e.view.distanceM).toBe(1234); expect(e.view.calories).toBe(42);
  });
  it('smoothing applies to displayed power/cadence only', () => {
    const { e, advance } = mk(5);
    e.start(); e.tick(live(100, 120, 80)); advance(1000); e.tick(live(300, 120, 100));
    expect(e.view.powerSmooth).toBe(200); expect(e.view.power).toBe(300);
    expect(e.view.cadenceSmooth).toBe(90); expect(e.samples[1].power).toBe(300);
  });
  it("W'bal: riding above CP expends", () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(350)); advance(1000);
    expect(e.view.wbalPct).toBeCloseTo(0.5, 6);                // 100 J of 20 kJ
    expect(e.view.wbalRemainingJ).toBeCloseTo(19900, 6);
  });
});
