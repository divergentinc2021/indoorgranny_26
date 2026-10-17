import 'fake-indexeddb/auto';
import fs from 'node:fs';
import { useClassPlans } from './app/classplan-store';
import { parseSecondsFile } from './engine/classplan';
import { Decoder, Stream } from '@garmin/fitsdk';
import { useRide } from './app/ride-store';
import { useSensors } from './app/sensor-store';
import { useSettings } from './app/settings-store';
import { buildFit } from './data/fit';
import { getLaps, getSamples, getSession } from './data/sessions';
import type { SensorKind, Slot } from './sensors/types';

// A scripted sensor source feeding the same LiveStore the ride store reads, through the real arbitration.
function fakeSensors(withSpeed = true) {
  const live = useSensors.getState().live;
  const send = (kind: SensorKind, slot: Slot, value: number) => { live.accept({ kind, value, at: Date.now(), slot }); };
  return setInterval(() => { send('hr', 'hr', 140); send('power', 'power', 200); send('cadence', 'power', 90); if (withSpeed) send('speed', 'csc', 8); }, 1000);
}

describe('end to end: sensors → ride → store → FIT', () => {
  // Fake only these: fake-indexeddb needs the real setTimeout/setImmediate to complete transactions.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); useRide.getState().discard(); });

  it('records 95 s with one manual lap, saves, and exports a coherent FIT file', async () => {
    useSettings.getState().set({ countdownS: 0 });
    for (const slot of ['hr', 'power', 'csc'] as const) useSettings.getState().setDevice(slot, { slot, id: slot, name: slot });
    const src = fakeSensors();
    try {
      useRide.getState().begin();
      await vi.advanceTimersByTimeAsync(65_000);
      useRide.getState().lap();
      await vi.advanceTimersByTimeAsync(30_000);
      useRide.getState().stop();
      const saved = await useRide.getState().save();

      const session = (await getSession(saved.id))!;
      const laps = await getLaps(saved.id);
      const samples = await getSamples(saved.id);
      expect(laps).toHaveLength(2);
      expect(samples.length).toBeGreaterThanOrEqual(90);

      const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit(session, laps, samples))).read();
      expect(errors).toEqual([]);
      expect(messages.lapMesgs).toHaveLength(2);
      expect(messages.recordMesgs!.length).toBeGreaterThanOrEqual(90);
      const ses = messages.sessionMesgs![0];
      expect(ses.numLaps).toBe(2);
      expect(ses.avgPower).toBeGreaterThan(196); expect(ses.avgPower).toBeLessThan(204);
      expect(Math.abs((ses.totalDistance ?? 0) - 8 * 95) / (8 * 95)).toBeLessThan(0.02);
      expect(ses.avgHeartRate).toBe(140);
    } finally {
      clearInterval(src);
    }
  });

  it('a power-only ride (no wheel sensor) records virtual-speed distance into the FIT file', async () => {
    useSettings.getState().set({ countdownS: 0 });
    for (const slot of ['hr', 'power'] as const) useSettings.getState().setDevice(slot, { slot, id: slot, name: slot });
    useSettings.getState().setDevice('csc', undefined);
    vi.setSystemTime(Date.now() + 600_000); // the shared LiveStore still holds the previous test's wheel speed; make it stale
    const src = fakeSensors(false);
    try {
      useRide.getState().begin();
      await vi.advanceTimersByTimeAsync(95_000);
      useRide.getState().stop();
      const saved = await useRide.getState().save();

      const session = (await getSession(saved.id))!;
      const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit(session, await getLaps(saved.id), await getSamples(saved.id)))).read();
      expect(errors).toEqual([]);
      const expected = 8.93 * 95;
      expect(Math.abs((session.distanceM ?? 0) - expected) / expected).toBeLessThan(0.02);
      expect(messages.recordMesgs!.some((r) => (r.distance ?? 0) > 0)).toBe(true);
      expect(messages.sessionMesgs![0].totalDistance ?? 0).toBeGreaterThan(0);
    } finally {
      clearInterval(src);
    }
  });

  it('a full class ride: warm-up, Session 1 to its end, 28 named laps, plan on the record, FIT coherent', async () => {
    useSettings.getState().set({ countdownS: 0, classAlerts: 'off' });
    for (const slot of ['hr', 'power'] as const) useSettings.getState().setDevice(slot, { slot, id: slot, name: slot });
    useSettings.getState().setDevice('csc', undefined);
    vi.setSystemTime(Date.now() + 1_000_000); // earlier tests left wheel speed in the shared LiveStore; make it stale
    const [plan] = parseSecondsFile(JSON.parse(fs.readFileSync('src/engine/__fixtures__/timers.seconds', 'utf8')), 'bundled');
    expect(plan.title).toBe('Session 1 Score 65 19-20 October 2026');
    expect(plan.intervals).toHaveLength(27); expect(plan.totalS).toBe(3060);
    useClassPlans.getState().add([plan]); useClassPlans.getState().select(plan.id);
    const src = fakeSensors(false);
    try {
      useRide.getState().begin({ classMode: 'warmup' });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(useRide.getState().classPhase).toBe('warmup');
      useRide.getState().startClass();
      expect(useRide.getState().classPhase).toBe('class');
      await vi.advanceTimersByTimeAsync(3_060_000);
      expect(useRide.getState().classPhase).toBe('done');
      useRide.getState().stop();
      const saved = await useRide.getState().save();

      const session = (await getSession(saved.id))!;
      const laps = await getLaps(saved.id);
      const samples = await getSamples(saved.id);
      expect(session.planId).toBe(plan.id); expect(session.planTitle).toBe(plan.title);
      expect(laps).toHaveLength(28);
      expect(laps[0].name).toBe('Warm up');
      expect(laps[1].durationS).toBe(300); expect(laps[1].name).toBe('Endurance 80+ 5:00');
      expect(laps.slice(1).map((l) => l.name)).toEqual(plan.intervals.map((i) => i.name));
      const expected = 8.93 * (120 + 3060);
      expect(Math.abs((session.distanceM ?? 0) - expected) / expected).toBeLessThan(0.02);

      const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit(session, laps, samples))).read();
      expect(errors).toEqual([]);
      expect(messages.lapMesgs).toHaveLength(28);
      const ses = messages.sessionMesgs![0];
      expect(ses.numLaps).toBe(28);
      // Engine elapsed counts the first tick as 1, so the last lap closes at 3181 = 121 (warm-up) + 3060 while durationS = elapsed - 1 = 3180; FIT session end = max(durationS, last lap end, last sample t) = 3181, within 1 s of 120 + 3060.
      expect(session.durationS).toBe(3180); expect(laps[0].durationS).toBe(121);
      expect(ses.totalElapsedTime).toBe(3181); expect(Math.abs((ses.totalElapsedTime ?? 0) - 3180)).toBeLessThanOrEqual(1);
    } finally {
      clearInterval(src);
    }
  }, 120_000);
});
