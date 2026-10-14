import { PairedDevice, SensorReading, SensorSource, SensorState, Slot } from '../types';
import { UUIDS, ALL_SERVICES } from './uuids';
import { parseHeartRate } from './parse/hr';
import { parseCsc } from './parse/csc';
import { parseCyclingPower } from './parse/cps';
import { parseIndoorBikeData } from './parse/ftms';
import { RevCounter, speedMs, cadenceRpm } from './derive';

const SLOT_SERVICE: Record<Slot, number> = { hr: UUIDS.HR_SERVICE, power: UUIDS.CPS_SERVICE, csc: UUIDS.CSC_SERVICE, trainer: UUIDS.FTMS_SERVICE };
const SLOT_CHAR: Record<Slot, number> = { hr: UUIDS.HR_MEASUREMENT, power: UUIDS.CPS_MEASUREMENT, csc: UUIDS.CSC_MEASUREMENT, trainer: UUIDS.FTMS_INDOOR_BIKE };

export class BleAdapter implements SensorSource {
  id = 'ble';
  private readingCbs = new Set<(r: SensorReading) => void>();
  private stateCbs = new Set<(slot: Slot, s: SensorState, msg?: string) => void>();
  private devices = new Map<Slot, BluetoothDevice>();
  private wheel = new Map<Slot, RevCounter>();
  private crank = new Map<Slot, RevCounter>();
  private readonly bt: Bluetooth | undefined;
  constructor(private readonly o: { circumferenceMm: () => number; bluetooth?: Bluetooth }) { this.bt = o.bluetooth ?? (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined); }
  static available() { return typeof navigator !== 'undefined' && !!navigator.bluetooth; }

  onReading(cb: (r: SensorReading) => void) { this.readingCbs.add(cb); return () => this.readingCbs.delete(cb); }
  onState(cb: (slot: Slot, s: SensorState, msg?: string) => void) { this.stateCbs.add(cb); return () => this.stateCbs.delete(cb); }
  private emit(r: SensorReading) { this.readingCbs.forEach((cb) => cb(r)); }
  private setState(slot: Slot, s: SensorState, msg?: string) { this.stateCbs.forEach((cb) => cb(slot, s, msg)); }

  /** Drop this slot's revolution counters: cumulative counts can restart after a reconnect. */
  resetCounters(slot: Slot) { this.wheel.delete(slot); this.crank.delete(slot); }

  async pair(slot: Slot): Promise<PairedDevice> {
    if (!this.bt) throw new Error('Web Bluetooth is not available in this browser. Use Chrome on Android.');
    const prev = this.devices.get(slot);
    if (prev) await this.disconnect({ slot, id: prev.id, name: prev.name ?? 'Unnamed' });
    const dev = await this.bt.requestDevice({ filters: [{ services: [SLOT_SERVICE[slot]] }], optionalServices: ALL_SERVICES });
    const d: PairedDevice = { slot, id: dev.id, name: dev.name ?? 'Unnamed' };
    this.devices.set(slot, dev);
    await this.connectDevice(slot, dev);
    return d;
  }

  async connect(d: PairedDevice): Promise<void> {
    let dev = this.devices.get(d.slot);
    if (!dev && this.bt?.getDevices) dev = (await this.bt.getDevices()).find((x) => x.id === d.id);
    if (!dev) { this.setState(d.slot, 'offline', 'Tap Reconnect to choose the device again'); return; }
    this.devices.set(d.slot, dev);
    await this.connectDevice(d.slot, dev);
  }

  async disconnect(d: PairedDevice): Promise<void> {
    const dev = this.devices.get(d.slot); this.devices.delete(d.slot);
    this.resetCounters(d.slot);
    this.dropListener(d.slot);
    dev?.gatt?.disconnect(); this.setState(d.slot, 'unpaired');
  }

  private listeners = new Map<Slot, { ch: BluetoothRemoteGATTCharacteristic; fn: (ev: Event) => void }>();
  private dropListener(slot: Slot) {
    const l = this.listeners.get(slot); if (!l) return;
    l.ch.removeEventListener('characteristicvaluechanged', l.fn); this.listeners.delete(slot);
  }

  /** True while this device is still the one the slot is paired to (false once forgotten or replaced). */
  private current(slot: Slot, dev: BluetoothDevice) { return this.devices.get(slot) === dev; }

  private async connectDevice(slot: Slot, dev: BluetoothDevice, attempt = 0): Promise<void> {
    if (!this.current(slot, dev)) return;
    this.setState(slot, 'connecting');
    try {
      const gatt = await dev.gatt!.connect();
      if (!this.current(slot, dev)) { gatt.disconnect(); return; }
      const svc = await gatt.getPrimaryService(SLOT_SERVICE[slot]);
      const ch = await svc.getCharacteristic(SLOT_CHAR[slot]);
      this.resetCounters(slot);
      await ch.startNotifications();
      if (!this.current(slot, dev)) { gatt.disconnect(); return; }
      this.dropListener(slot);
      const fn = (ev: Event) => {
        const v = (ev.target as BluetoothRemoteGATTCharacteristic).value; if (v) this.handleValue(slot, SLOT_CHAR[slot], v, Date.now());
      };
      ch.addEventListener('characteristicvaluechanged', fn);
      this.listeners.set(slot, { ch, fn });
      dev.addEventListener('gattserverdisconnected', () => {
        if (!this.current(slot, dev)) return;
        this.setState(slot, 'offline', 'Disconnected, reconnecting…');
        this.reconnect(slot, dev);
      }, { once: true });
      this.setState(slot, 'connected');
    } catch (e) {
      if (!this.current(slot, dev)) return;
      dev.gatt?.disconnect(); // do not leave a half-set-up GATT link open
      if (attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); return this.connectDevice(slot, dev, attempt + 1); }
      this.setState(slot, 'offline', (e as Error).message);
    }
  }
  private reconnect(slot: Slot, dev: BluetoothDevice) { void this.connectDevice(slot, dev, 0); }

  /** Pure dispatch, exported for tests. */
  handleValue(slot: Slot, char: number, dv: DataView, at: number) {
    if (char === UUIDS.HR_MEASUREMENT) { const r = parseHeartRate(dv); if (r) this.emit({ kind: 'hr', value: r.bpm, at, slot }); return; }
    if (char === UUIDS.CSC_MEASUREMENT) {
      const r = parseCsc(dv); if (!r) return;
      if (r.wheelRevs !== undefined && r.wheelTime1024 !== undefined) { const c = this.counter(this.wheel, slot, 1024, 32); const rate = c.push(r.wheelRevs, r.wheelTime1024, at); if (rate !== null) this.emit({ kind: 'speed', value: speedMs(rate, this.o.circumferenceMm()), at, slot }); }
      if (r.crankRevs !== undefined && r.crankTime1024 !== undefined) { const c = this.counter(this.crank, slot, 1024, 16); const rate = c.push(r.crankRevs, r.crankTime1024, at); if (rate !== null) this.emit({ kind: 'cadence', value: cadenceRpm(rate), at, slot }); }
      return;
    }
    if (char === UUIDS.CPS_MEASUREMENT) {
      const r = parseCyclingPower(dv); if (!r) return;
      this.emit({ kind: 'power', value: r.watts, at, slot });
      if (r.crankRevs !== undefined && r.crankTime1024 !== undefined) { const c = this.counter(this.crank, slot, 1024, 16); const rate = c.push(r.crankRevs, r.crankTime1024, at); if (rate !== null) this.emit({ kind: 'cadence', value: cadenceRpm(rate), at, slot }); }
      if (r.wheelRevs !== undefined && r.wheelTime2048 !== undefined) { const c = this.counter(this.wheel, slot, 2048, 32); const rate = c.push(r.wheelRevs, r.wheelTime2048, at); if (rate !== null) this.emit({ kind: 'speed', value: speedMs(rate, this.o.circumferenceMm()), at, slot }); }
      return;
    }
    if (char === UUIDS.FTMS_INDOOR_BIKE) {
      const r = parseIndoorBikeData(dv); if (!r) return;
      if (r.powerW !== undefined) this.emit({ kind: 'power', value: r.powerW, at, slot });
      if (r.cadenceRpm !== undefined) this.emit({ kind: 'cadence', value: r.cadenceRpm, at, slot });
      if (r.speedKmh !== undefined) this.emit({ kind: 'speed', value: r.speedKmh / 3.6, at, slot });
      if (r.hrBpm !== undefined && r.hrBpm > 0) this.emit({ kind: 'hr', value: r.hrBpm, at, slot });
      this.emit({ kind: 'trainer', value: 0, at, slot, extra: { distanceM: r.distanceM, kcal: r.kcalTotal } });
    }
  }
  private counter(map: Map<Slot, RevCounter>, slot: Slot, timeHz: number, revBits: 16 | 32) {
    let c = map.get(slot); if (!c) { c = new RevCounter({ timeHz, revBits }); map.set(slot, c); } return c;
  }
}
