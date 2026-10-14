export type SensorKind = 'hr' | 'power' | 'cadence' | 'speed' | 'trainer';
export type Slot = 'hr' | 'power' | 'csc' | 'trainer';
export const SLOT_PRIORITY: Slot[] = ['hr', 'power', 'csc', 'trainer'];
export const SLOT_KINDS: Record<Slot, SensorKind[]> = { hr: ['hr'], power: ['power', 'cadence'], csc: ['speed', 'cadence'], trainer: ['power', 'cadence', 'speed', 'hr', 'trainer'] };
export interface SensorReading { kind: SensorKind; value: number; at: number; slot: Slot; extra?: { distanceM?: number; kcal?: number } }
export type SensorState = 'unpaired' | 'connecting' | 'connected' | 'offline';
export interface PairedDevice { slot: Slot; id: string; name: string }
export interface SensorSource {
  id: string;
  pair(slot: Slot): Promise<PairedDevice>;
  connect(d: PairedDevice): Promise<void>;
  disconnect(d: PairedDevice): Promise<void>;
  onReading(cb: (r: SensorReading) => void): () => void;
  onState(cb: (slot: Slot, s: SensorState, msg?: string) => void): () => void;
}
