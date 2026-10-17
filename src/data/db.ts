import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LapRow } from '../engine/laps';
import type { Sample } from '../engine/ride';

export interface Rider { id: string; name: string; email: string; weightKg: number; ftpW: number; cpW?: number; cpExplicit?: boolean; wprimeKj: number; hrMax: number; powerZones?: [string, number][]; createdAt: number }
export interface SessionRecord { id: number; riderId: string; riderName: string; sport: 'indoor_cycling'; startMs: number; durationS: number; distanceM: number; calories: number; nSamples: number; avgPower: number; maxPower: number; avgHr: number; maxHr: number; avgCad: number; uploaded: null | { service: string; remoteId: string }; synced: boolean }
export interface LapRecord extends LapRow { sessionId: number }
export interface SampleRecord extends Sample { sessionId: number }

export interface Schema extends DBSchema {
  riders: { key: string; value: Rider };
  sessions: { key: number; value: SessionRecord; indexes: { byStart: number } };
  laps: { key: [number, number]; value: LapRecord; indexes: { bySession: number } };
  samples: { key: [number, number]; value: SampleRecord; indexes: { bySession: number } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;
export function getDb() {
  dbp ??= openDB<Schema>('indoorgranny', 1, {
    upgrade(db) {
      db.createObjectStore('riders', { keyPath: 'id' });
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byStart', 'startMs');
      db.createObjectStore('laps', { keyPath: ['sessionId', 'number'] }).createIndex('bySession', 'sessionId');
      db.createObjectStore('samples', { keyPath: ['sessionId', 't'] }).createIndex('bySession', 'sessionId');
    },
  });
  return dbp;
}
