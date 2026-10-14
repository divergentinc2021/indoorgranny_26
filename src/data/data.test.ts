import 'fake-indexeddb/auto';
import { listRiders, putRider, newRider, deleteRider } from './riders';
import { saveSession, listSessions, getLaps, getSamples, deleteSession, deleteAllSessions, getSession } from './sessions';
import type { SessionRecord } from './db';

const sess = (id: number, n = 2): SessionRecord => ({ id, riderId: 'r1', riderName: 'Ann', sport: 'indoor_cycling', startMs: id, durationS: n, distanceM: 10, calories: 1, nSamples: n, avgPower: 100, maxPower: 120, avgHr: 130, maxHr: 140, avgCad: 85, uploaded: null, synced: false });
const lap = { number: 1, startOffsetS: 0, durationS: 2, distanceM: 10, calories: 1, avgPower: 100, avgCad: 85, avgSpeedMs: 5, avgHr: 130, difHrPct: null };
const smp = (t: number) => ({ t, hr: 130, cadence: 85, power: 100, lap: 1, distanceM: t * 5, speedMs: 5 });

describe('riders', () => {
  it('newRider fills vendor defaults and cp = ftp', () => {
    const r = newRider({ name: 'Ann', email: 'a@x', ftpW: 300 });
    expect(r).toMatchObject({ weightKg: 70, ftpW: 300, cpW: 300, wprimeKj: 20, hrMax: 180 });
    expect(r.id).toBeTruthy();
  });
  it('put/list/delete', async () => {
    const r = newRider({ name: 'Ann', email: 'a@x' });
    await putRider(r);
    expect((await listRiders()).map((x) => x.name)).toEqual(['Ann']);
    await deleteRider(r.id);
    expect(await listRiders()).toEqual([]);
  });
});

describe('sessions', () => {
  it('saves session with laps and samples, lists newest first, cascades delete', async () => {
    await saveSession(sess(1000), [lap], [smp(1), smp(2)]);
    await saveSession(sess(2000), [], []);
    expect((await listSessions()).map((s) => s.id)).toEqual([2000, 1000]);
    expect(await getLaps(1000)).toHaveLength(1);
    expect(await getSamples(1000)).toHaveLength(2);
    expect((await getSession(2000))?.nSamples).toBe(2);
    await deleteSession(1000);
    expect(await getLaps(1000)).toHaveLength(0);
    expect(await getSamples(1000)).toHaveLength(0);
    expect(await getSession(1000)).toBeUndefined();
    await deleteAllSessions();
    expect(await listSessions()).toEqual([]);
  });
  it('zero-sample session saves and loads cleanly', async () => {
    await saveSession(sess(3000, 0), [], []);
    expect((await getSession(3000))?.nSamples).toBe(0);
    expect(await getSamples(3000)).toEqual([]);
  });
});
