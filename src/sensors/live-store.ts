import { SensorKind, SensorReading, Slot, SLOT_KINDS, SLOT_PRIORITY } from './types';
import type { LiveInput } from '../engine/ride';
export class LiveStore {
  staleMs = 5000;
  private paired: Slot[] = [];
  private v = new Map<SensorKind, { value: number; at: number; extra?: SensorReading['extra'] }>();
  setPaired(slots: Slot[]) { this.paired = SLOT_PRIORITY.filter((s) => slots.includes(s)); }
  owner(kind: SensorKind): Slot | undefined { return this.paired.find((s) => SLOT_KINDS[s].includes(kind)); }
  accept(r: SensorReading): boolean {
    if (this.owner(r.kind) !== r.slot) return false;
    this.v.set(r.kind, { value: r.value, at: r.at, extra: r.extra });
    return true;
  }
  private get(kind: SensorKind, now: number) { const e = this.v.get(kind); return e && now - e.at <= this.staleMs ? e : undefined; }
  snapshot(now: number): LiveInput {
    const t = this.get('trainer', now);
    return { hr: this.get('hr', now)?.value ?? 0, power: this.get('power', now)?.value ?? 0, cadence: this.get('cadence', now)?.value ?? 0, speedMs: this.get('speed', now)?.value ?? 0, speedSensorPresent: !!this.get('speed', now) || !!this.get('trainer', now), trainerDistanceM: t?.extra?.distanceM, trainerKcal: t?.extra?.kcal };
  }
}
