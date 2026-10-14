import { Encoder, Profile } from '@garmin/fitsdk';
import type { SessionRecord } from './db';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';

export function buildFit(s: SessionRecord, laps: LapRow[], samples: Sample[]): Uint8Array {
  const enc = new Encoder();
  // SDK typings only declare mesgNum on Encodable<Mesg>; field names are validated at runtime by the encoder.
  const put = (m: object) => enc.writeMesg(m as Parameters<Encoder['writeMesg']>[0]);
  const start = new Date(s.startMs);
  const at = (offsetS: number) => new Date(s.startMs + offsetS * 1000);
  put({ mesgNum: Profile.MesgNum.FILE_ID, type: 'activity', manufacturer: 'development', product: 1, serialNumber: Math.floor(s.startMs / 1000) % 0xffffffff, timeCreated: start });
  put({ mesgNum: Profile.MesgNum.DEVICE_INFO, timestamp: start, deviceIndex: 0, manufacturer: 'development', product: 1, serialNumber: 1 });
  put({ mesgNum: Profile.MesgNum.EVENT, timestamp: start, event: 'timer', eventType: 'start' });
  for (const x of samples) {
    put({ mesgNum: Profile.MesgNum.RECORD, timestamp: at(x.t), heartRate: x.hr, cadence: Math.min(254, Math.round(x.cadence)), power: Math.round(x.power), speed: x.speedMs, distance: x.distanceM });
  }
  for (const l of laps) {
    put({ mesgNum: Profile.MesgNum.LAP, timestamp: at(l.startOffsetS + l.durationS), startTime: at(l.startOffsetS), totalElapsedTime: l.durationS, totalTimerTime: l.durationS, totalDistance: l.distanceM, avgPower: Math.round(l.avgPower), avgHeartRate: Math.round(l.avgHr), avgCadence: Math.round(l.avgCad), totalCalories: Math.round(l.calories), event: 'lap', eventType: 'stop' });
  }
  const end = at(s.durationS);
  put({ mesgNum: Profile.MesgNum.EVENT, timestamp: end, event: 'timer', eventType: 'stopAll' });
  put({ mesgNum: Profile.MesgNum.SESSION, timestamp: end, startTime: start, sport: 'cycling', subSport: 'indoorCycling', totalElapsedTime: s.durationS, totalTimerTime: s.durationS, totalDistance: s.distanceM, totalCalories: Math.round(s.calories), avgPower: Math.round(s.avgPower), maxPower: Math.round(s.maxPower), avgHeartRate: Math.round(s.avgHr), maxHeartRate: Math.round(s.maxHr), avgCadence: Math.round(s.avgCad), avgSpeed: s.durationS ? s.distanceM / s.durationS : 0, numLaps: Math.max(1, laps.length), firstLapIndex: 0, event: 'session', eventType: 'stop' });
  put({ mesgNum: Profile.MesgNum.ACTIVITY, timestamp: end, totalTimerTime: s.durationS, numSessions: 1, type: 'manual', event: 'activity', eventType: 'stop' });
  return enc.close();
}
export function fitFileName(s: SessionRecord): string {
  const d = new Date(s.startMs); const p = (n: number) => String(n).padStart(2, '0');
  return `indoorgranny_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.fit`;
}
