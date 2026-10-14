import { getDb, SessionRecord } from './db';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';
export type { SessionRecord };

export async function saveSession(s: SessionRecord, laps: LapRow[], samples: Sample[]) {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await tx.objectStore('sessions').put(s);
  for (const l of laps) await tx.objectStore('laps').put({ ...l, sessionId: s.id });
  for (const x of samples) await tx.objectStore('samples').put({ ...x, sessionId: s.id });
  await tx.done;
}
export async function listSessions() { return (await (await getDb()).getAllFromIndex('sessions', 'byStart')).reverse(); }
export async function getSession(id: number) { return (await getDb()).get('sessions', id); }
export async function getLaps(id: number) { return (await getDb()).getAllFromIndex('laps', 'bySession', id); }
export async function getSamples(id: number) { return (await getDb()).getAllFromIndex('samples', 'bySession', id); }
export async function deleteSession(id: number) {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await tx.objectStore('sessions').delete(id);
  for (const k of await tx.objectStore('laps').index('bySession').getAllKeys(id)) await tx.objectStore('laps').delete(k);
  for (const k of await tx.objectStore('samples').index('bySession').getAllKeys(id)) await tx.objectStore('samples').delete(k);
  await tx.done;
}
export async function deleteAllSessions() {
  const db = await getDb();
  const tx = db.transaction(['sessions', 'laps', 'samples'], 'readwrite');
  await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('laps').clear(), tx.objectStore('samples').clear()]);
  await tx.done;
}
