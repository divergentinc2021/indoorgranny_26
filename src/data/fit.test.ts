import { Decoder, Stream } from '@garmin/fitsdk';
import { buildFit, fitFileName } from './fit';
import type { SessionRecord } from './db';
const session: SessionRecord = { id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3, distanceM: 30, calories: 2, nSamples: 3, avgPower: 200, maxPower: 250, avgHr: 140, maxHr: 150, avgCad: 90, uploaded: null, synced: false };
const laps = [{ number: 1, startOffsetS: 0, durationS: 3, distanceM: 30, calories: 2, avgPower: 200, avgCad: 90, avgSpeedMs: 10, avgHr: 140, difHrPct: null }];
const samples = [1, 2, 3].map((t) => ({ t, hr: 140, cadence: 90, power: t === 2 ? 250 : 175, lap: 1, distanceM: t * 10, speedMs: 10 }));

describe('buildFit', () => {
  it('round-trips through the SDK decoder with the vendor message set', () => {
    const bytes = buildFit(session, laps, samples);
    const { messages, errors } = new Decoder(Stream.fromByteArray(bytes)).read();
    expect(errors).toEqual([]);
    expect(messages.fileIdMesgs![0]).toMatchObject({ type: 'activity', manufacturer: 'development' });
    expect(messages.recordMesgs).toHaveLength(3);
    expect(messages.recordMesgs![1]).toMatchObject({ power: 250, heartRate: 140, cadence: 90, distance: 20 });
    expect(messages.lapMesgs).toHaveLength(1);
    expect(messages.sessionMesgs![0]).toMatchObject({ sport: 'cycling', subSport: 'indoorCycling', numLaps: 1, totalCalories: 2 });
    expect(messages.activityMesgs).toHaveLength(1);
  });
  it('zero samples still yields a valid file', () => {
    const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit({ ...session, nSamples: 0 }, [], []))).read();
    expect(errors).toEqual([]); expect(messages.recordMesgs ?? []).toHaveLength(0);
  });
  it('file name from start time', () => { expect(fitFileName(session)).toMatch(/^indoorgranny_\d{8}_\d{4}\.fit$/); });
});
