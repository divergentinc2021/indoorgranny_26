import 'fake-indexeddb/auto';
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
});
