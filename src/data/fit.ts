import { Encoder, Profile } from '@garmin/fitsdk';
import type { SessionRecord } from './db';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';

/**
 * The SDK silently ignores keys that are not in the profile (and null/undefined values), so a typo
 * in a field name would be dropped with no error. This guard exists for that reason.
 */
export function assertKnownFields(mesgNum: number, mesg: object): void {
  const def = (Profile.messages as Record<number, { fields: Record<string, { name: string }> } | undefined>)[mesgNum];
  if (!def) throw new Error(`FIT: unknown message ${mesgNum}`);
  const known = new Set(Object.values(def.fields).map((f) => f.name));
  for (const key of Object.keys(mesg)) {
    if (key !== 'mesgNum' && !known.has(key)) throw new Error(`FIT: unknown field "${key}" for message ${mesgNum}`);
  }
}

export function buildFit(s: SessionRecord, laps: LapRow[], samples: Sample[]): Uint8Array {
  const enc = new Encoder();
  // SDK typings only declare mesgNum on Encodable<Mesg>, hence the cast; names are checked by assertKnownFields.
  const put = (m: { mesgNum: number; [k: string]: unknown }) => {
    assertKnownFields(m.mesgNum, m);
    enc.writeMesg(m as Parameters<Encoder['writeMesg']>[0]);
  };
  const num = (v: number, max = Infinity) => (Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : undefined);
  const start = new Date(s.startMs);
  const at = (offsetS: number) => new Date(s.startMs + offsetS * 1000);
  put({ mesgNum: Profile.MesgNum.FILE_ID, type: 'activity', manufacturer: 'development', product: 1, serialNumber: Math.floor(s.startMs / 1000) % 0xffffffff, timeCreated: start });
  put({ mesgNum: Profile.MesgNum.DEVICE_INFO, timestamp: start, deviceIndex: 0, manufacturer: 'development', product: 1, serialNumber: 1 });
  put({ mesgNum: Profile.MesgNum.EVENT, timestamp: start, event: 'timer', eventType: 'start' });
  for (const x of samples) {
    put({ mesgNum: Profile.MesgNum.RECORD, timestamp: at(x.t), heartRate: x.hr > 0 ? Math.round(x.hr) : undefined, cadence: num(x.cadence, 254), power: num(x.power), speed: x.speedMs, distance: x.distanceM });
  }
  for (const l of laps) {
    put({ mesgNum: Profile.MesgNum.LAP, timestamp: at(l.startOffsetS + l.durationS), startTime: at(l.startOffsetS), totalElapsedTime: l.durationS, totalTimerTime: l.durationS, totalDistance: l.distanceM, avgPower: Math.round(l.avgPower), maxPower: num(l.maxPower), avgHeartRate: l.avgHr > 0 ? Math.round(l.avgHr) : undefined, maxHeartRate: l.maxHr > 0 ? Math.round(l.maxHr) : undefined, avgCadence: Math.round(l.avgCad), totalCalories: Math.round(l.calories), event: 'lap', eventType: 'stop' });
  }
  const end = at(s.durationS);
  put({ mesgNum: Profile.MesgNum.EVENT, timestamp: end, event: 'timer', eventType: 'stopAll' });
  put({ mesgNum: Profile.MesgNum.SESSION, timestamp: end, startTime: start, sport: 'cycling', subSport: 'indoorCycling', totalElapsedTime: s.durationS, totalTimerTime: s.durationS, totalDistance: s.distanceM, totalCalories: Math.round(s.calories), avgPower: Math.round(s.avgPower), maxPower: Math.round(s.maxPower), avgHeartRate: s.avgHr > 0 ? Math.round(s.avgHr) : undefined, maxHeartRate: s.maxHr > 0 ? Math.round(s.maxHr) : undefined, avgCadence: Math.round(s.avgCad), avgSpeed: s.durationS ? s.distanceM / s.durationS : 0, numLaps: Math.max(1, laps.length), firstLapIndex: 0, event: 'session', eventType: 'stop' });
  put({ mesgNum: Profile.MesgNum.ACTIVITY, timestamp: end, totalTimerTime: s.durationS, numSessions: 1, type: 'manual', event: 'activity', eventType: 'stop' });
  return enc.close();
}
export function fitFileName(s: SessionRecord): string {
  const d = new Date(s.startMs); const p = (n: number) => String(n).padStart(2, '0');
  return `indoorgranny_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.fit`;
}
