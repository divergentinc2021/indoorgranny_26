import { Decoder, Profile, Stream } from '@garmin/fitsdk';
import { assertKnownFields, buildFit, fitFileName } from './fit';
import type { SessionRecord } from './db';
const session: SessionRecord = { id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3, distanceM: 30, calories: 2, nSamples: 3, avgPower: 200, maxPower: 250, avgHr: 140, maxHr: 150, avgCad: 90, uploaded: null, synced: false };
const laps = [{ number: 1, startOffsetS: 0, durationS: 3, distanceM: 30, calories: 2, avgPower: 200, avgCad: 90, avgSpeedMs: 10, avgHr: 140, maxPower: 250, maxHr: 150, difHrPct: null }];
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

    const ms = (d: Date | number | string | undefined) => (d === undefined ? undefined : new Date(d).getTime());
    const t0 = session.startMs;
    expect(ms(messages.fileIdMesgs![0].timeCreated)).toBe(t0);
    expect(ms(messages.recordMesgs![0].timestamp)).toBe(t0 + 1000);
    const lap = messages.lapMesgs![0];
    expect(ms(lap.startTime)).toBe(t0);
    expect(ms(lap.timestamp)).toBe(t0 + 3000);
    expect(lap).toMatchObject({ totalElapsedTime: 3, totalDistance: 30, avgPower: 200, maxPower: 250, avgHeartRate: 140, maxHeartRate: 150, avgCadence: 90, totalCalories: 2 });
    const ses = messages.sessionMesgs![0];
    expect(ms(ses.startTime)).toBe(t0);
    expect(ses).toMatchObject({ totalElapsedTime: 3, totalDistance: 30, avgPower: 200, maxPower: 250, avgHeartRate: 140, maxHeartRate: 150, avgCadence: 90, avgSpeed: 10 });
  });
  it('omits heartRate when the strap reads 0', () => {
    const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit(session, laps, [{ ...samples[0], hr: 0 }, samples[1]]))).read();
    expect(errors).toEqual([]);
    expect(messages.recordMesgs![0]).not.toHaveProperty('heartRate');
    expect(messages.recordMesgs![1]).toHaveProperty('heartRate', 140);
  });
  it('omits lap and session heart-rate fields when the strap read 0 the whole ride', () => {
    const noHr = { ...session, avgHr: 0, maxHr: 0 };
    const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit(noHr, [{ ...laps[0], avgHr: 0, maxHr: 0 }], samples.map((x) => ({ ...x, hr: 0 }))))).read();
    expect(errors).toEqual([]);
    for (const m of [messages.lapMesgs![0], messages.sessionMesgs![0]]) {
      expect(m).not.toHaveProperty('avgHeartRate');
      expect(m).not.toHaveProperty('maxHeartRate');
    }
    expect(messages.lapMesgs![0]).toHaveProperty('maxPower', 250);
  });
  it('a session with a single closed final lap has exactly one Lap message and numLaps 1', () => {
    const { messages } = new Decoder(Stream.fromByteArray(buildFit(session, laps, samples))).read();
    expect(messages.lapMesgs).toHaveLength(1);
    expect(messages.sessionMesgs![0]).toHaveProperty('numLaps', 1);
  });
  it('zero samples still yields a valid file', () => {
    const { messages, errors } = new Decoder(Stream.fromByteArray(buildFit({ ...session, nSamples: 0 }, [], []))).read();
    expect(errors).toEqual([]); expect(messages.recordMesgs ?? []).toHaveLength(0);
  });
  it('file name is GrannyGear_date_time_Rider', () => {
    const at = new Date(2026, 9, 14, 18, 5).getTime();
    expect(fitFileName({ ...session, startMs: at, riderName: 'Mark Carroll' })).toBe('GrannyGear_2026-10-14_1805_Mark-Carroll.fit');
    expect(fitFileName({ ...session, startMs: at, riderName: '' })).toBe('GrannyGear_2026-10-14_1805_Guest.fit');
    expect(fitFileName({ ...session, startMs: at, riderName: 'Zoë/Ann' })).toBe('GrannyGear_2026-10-14_1805_Zo-Ann.fit');
  });
});

describe('assertKnownFields', () => {
  it('accepts valid field names', () => {
    expect(() => assertKnownFields(Profile.MesgNum.RECORD, { mesgNum: Profile.MesgNum.RECORD, timestamp: new Date(), heartRate: 1, power: 2 })).not.toThrow();
  });
  it('throws naming a misspelt field (the SDK would silently drop it)', () => {
    expect(() => assertKnownFields(Profile.MesgNum.SESSION, { totalCalorie: 1 })).toThrow(/totalCalorie/);
  });
});
