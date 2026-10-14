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
    const row = e.lap()!;
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
  it('stop freezes elapsed and kJ', () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(200)); advance(1000); e.tick(live(200)); advance(1000);
    e.stop();
    const el = e.view.elapsedS, kj = e.view.kJ;
    expect(el).toBe(3);
    advance(10_000);
    expect(e.view.elapsedS).toBe(el); expect(e.view.kJ).toBe(kj);
  });
  it('stop from paused excludes paused time and does not drift', () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(200)); advance(1000);
    e.pause(); const atPause = e.view.elapsedS;
    advance(5000); e.stop();
    expect(e.state).toBe('stopped'); expect(e.view.elapsedS).toBe(atPause); expect(atPause).toBe(2);
    advance(10_000);
    expect(e.view.elapsedS).toBe(atPause);
  });
  it('lap() returns null unless recording', () => {
    const { e, advance } = mk();
    expect(e.lap()).toBeNull(); expect(e.laps.rows).toHaveLength(0);
    e.start(); e.tick(live(200)); advance(1000);
    e.pause(); expect(e.lap()).toBeNull(); expect(e.laps.rows).toHaveLength(0);
    e.resume(); e.stop();
    const closed = e.laps.rows.length;          // stop() closes the final lap itself (1 sample), nothing more
    expect(closed).toBe(1);
    expect(e.lap()).toBeNull(); expect(e.laps.rows).toHaveLength(closed);
  });
  it('trainer distance and kcal (relative to the first value) override integration when present', () => {
    const { e, advance } = mk();
    e.start(); e.tick({ ...live(100), trainerDistanceM: 1234, trainerKcal: 42 }); advance(1000);
    e.tick({ ...live(100), trainerDistanceM: 1244, trainerKcal: 44 });
    expect(e.view.distanceM).toBe(10); expect(e.view.calories).toBe(2);
  });
  it("without an explicit CP, W'bal uses FTP as the critical power", () => {
    let t = 1_000_000;
    const e = new RideEngine({ rider: { weightKg: 70, ftpW: 300, wprimeKj: 20, hrMax: 180 }, smoothingN: 1, now: () => t });
    e.start(); e.tick(live(350)); t += 1000;
    expect(e.view.wbalRemainingJ).toBeCloseTo(20000 - 50, 6);
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

  describe('final lap on stop', () => {
    it('closes the open lap with kJ/4.184 calories', () => {
      const { e, advance } = mk();
      e.start();
      for (let i = 0; i < 5; i++) { e.tick(live(200)); advance(1000); }
      expect(e.laps.rows).toHaveLength(0);
      e.stop();
      expect(e.laps.rows).toHaveLength(1);
      const row = e.laps.rows[0];
      expect(row.durationS).toBe(e.view.elapsedS);
      expect(row.avgPower).toBe(200);
      expect(row.calories).toBeCloseTo((200 * row.durationS) / 1000 / 4.184, 9);
    });
    it('after a manual lap the final row only covers the remainder', () => {
      const { e, advance } = mk();
      e.start();
      for (let i = 0; i < 3; i++) { e.tick(live(200)); advance(1000); }
      e.lap();
      for (let i = 0; i < 2; i++) { e.tick(live(300)); advance(1000); }
      e.stop();
      expect(e.laps.rows).toHaveLength(2);
      expect(e.laps.rows[0].durationS + e.laps.rows[1].durationS).toBe(e.view.elapsedS);
      expect(e.laps.rows[1].avgPower).toBe(300);
    });
    it('adds no empty row when stopping straight after a lap or with no samples', () => {
      const a = mk(); a.e.start(); a.e.stop();
      expect(a.e.laps.rows).toHaveLength(0);
      const { e, advance } = mk();
      e.start(); e.tick(live(200)); advance(1000); e.lap(); e.stop();
      expect(e.laps.rows).toHaveLength(1);
    });
    it('stopping from paused also closes the lap', () => {
      const { e, advance } = mk();
      e.start(); e.tick(live(200)); advance(1000); e.tick(live(200)); advance(1000);
      e.pause(); advance(3000); e.stop();
      expect(e.laps.rows).toHaveLength(1);
      expect(e.laps.rows[0].durationS).toBe(e.view.elapsedS);
    });
  });

  describe('trainer cumulative baselines', () => {
    const tr = (distanceM?: number, kcal?: number) => ({ ...live(100, 120, 90, 8), trainerDistanceM: distanceM, trainerKcal: kcal });
    it('distance is relative to the first trainer value and held when absent', () => {
      const { e, advance } = mk();
      e.start();
      const out: number[] = [];
      for (const d of [1000, 1010, undefined, 1025]) { e.tick(tr(d)); out.push(e.view.distanceM); advance(1000); }
      expect(out).toEqual([0, 10, 10, 25]);
    });
    it('a trainer-side reset never goes backwards', () => {
      const { e, advance } = mk();
      e.start();
      const out: number[] = [];
      for (const d of [1000, 1025, 5, 15]) { e.tick(tr(d)); out.push(e.view.distanceM); advance(1000); }
      expect(out).toEqual([0, 25, 25, 35]);
    });
    it('kcal follows the same scheme and the MET estimate never mixes in', () => {
      const { e, advance } = mk();
      e.start();
      const out: number[] = [];
      for (const k of [500, 503, undefined, 510]) { e.tick(tr(undefined, k)); out.push(e.view.calories); advance(1000); }
      expect(out).toEqual([0, 3, 3, 10]);
    });
    it('without trainer values the speed integrator and MET estimate keep running', () => {
      const { e, advance } = mk();
      e.start();
      for (let i = 0; i < 3; i++) { e.tick(tr()); advance(1000); }
      expect(e.view.distanceM).toBeGreaterThan(10);
      expect(e.view.calories).toBeGreaterThan(0);
    });
    it('a trainer that appears mid-ride continues from the integrated distance', () => {
      const { e, advance } = mk();
      e.start();
      for (let i = 0; i < 3; i++) { e.tick(tr()); advance(1000); }
      const before = e.view.distanceM;
      e.tick(tr(5000)); advance(1000);
      expect(e.view.distanceM).toBe(before);
      e.tick(tr(5012));
      expect(e.view.distanceM).toBe(before + 12);
    });
  });

  it('sample t stays strictly increasing across a sub-second pause', () => {
    const { e, advance } = mk();
    e.start(); e.tick(live(200)); advance(1000); e.tick(live(200));
    e.pause(); advance(1500); e.resume();
    e.tick(live(200)); advance(1000); e.tick(live(200));
    const ts = e.samples.map((x) => x.t);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });
});
