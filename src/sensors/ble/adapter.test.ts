import { BleAdapter } from './adapter';
import type { PairedDevice, SensorState } from '../types';
describe('BleAdapter.handleValue', () => {
  it('turns an FTMS packet into power/cadence/speed/trainer readings', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    const dv = new DataView(Uint8Array.from([0x54, 0x02, 0x10, 0x0a, 0xb4, 0x00, 0xe8, 0x03, 0x00, 0xc8, 0x00, 0x8c]).buffer);
    a.handleValue('trainer', 0x2ad2, dv, 1000);
    expect(out.map((x) => [x.kind, x.value])).toEqual([['power', 200], ['cadence', 90], ['speed', 25.76 / 3.6], ['hr', 140], ['trainer', 0]]);
    expect(out[4].extra).toEqual({ distanceM: 1000, kcal: undefined });
  });
  it('CSC crank-only packets become cadence after two events', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    a.handleValue('csc', 0x2a5b, new DataView(Uint8Array.from([0x02, 0x00, 0x00, 0x00, 0x00]).buffer), 0);
    a.handleValue('csc', 0x2a5b, new DataView(Uint8Array.from([0x02, 0x02, 0x00, 0x00, 0x04]).buffer), 1000);
    expect(out).toEqual([{ kind: 'cadence', value: 120, at: 1000, slot: 'csc' }]);
  });
  it('CSC wheel packets emit a speed reading every time, so a stopped or first packet still marks the sensor present', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2000 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    const wheel = (revs: number, ticks: number) => new DataView(Uint8Array.from([0x01, revs & 0xff, revs >> 8, 0, 0, ticks & 0xff, ticks >> 8]).buffer);
    a.handleValue('csc', 0x2a5b, wheel(0, 0), 0);          // first packet primes the counter
    a.handleValue('csc', 0x2a5b, wheel(4, 1024), 1000);    // 4 rev in 1 s × 2 m
    a.handleValue('csc', 0x2a5b, wheel(4, 1024), 2000);    // identical packet: no new event, rate carries
    expect(out.map((x) => x.kind)).toEqual(['speed', 'speed', 'speed']);
    expect(out.map((x) => x.value)).toEqual([0, 8, 8]);
  });
  it('CPS wheel data also emits speed on every wheel-bearing packet', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2000 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    // flags 0x0010 = wheel revolution data present; power 100 W; wheel revs u32; wheel time u16 (1/2048 s)
    const pkt = (revs: number, ticks: number) => new DataView(Uint8Array.from([0x10, 0x00, 100, 0, revs & 0xff, 0, 0, 0, ticks & 0xff, ticks >> 8]).buffer);
    a.handleValue('power', 0x2a63, pkt(0, 0), 0);
    expect(out.filter((x) => x.kind === 'speed')).toEqual([{ kind: 'speed', value: 0, at: 0, slot: 'power' }]);
    a.handleValue('power', 0x2a63, pkt(4, 0x0800), 1000);
    expect(out.filter((x) => x.kind === 'speed').map((x) => x.value)).toEqual([0, 8]);
  });
  it('malformed packets emit nothing', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    a.handleValue('hr', 0x2a37, new DataView(new ArrayBuffer(0)), 0);
    expect(out).toEqual([]);
  });
  it('resetCounters discards stale revolution counters so the next packet only primes', () => {
    const a = new BleAdapter({ circumferenceMm: () => 2096 });
    const out: any[] = []; a.onReading((x) => out.push(x));
    const pkt = (revs: number, ticks: number) => new DataView(Uint8Array.from([0x02, revs & 0xff, revs >> 8, ticks & 0xff, ticks >> 8]).buffer);
    a.handleValue('csc', 0x2a5b, pkt(0, 0), 0);
    a.handleValue('csc', 0x2a5b, pkt(2, 1024), 1000);
    expect(out).toHaveLength(1);
    a.resetCounters('csc');
    a.handleValue('csc', 0x2a5b, pkt(5000, 2048), 2000);
    expect(out).toHaveLength(1);
  });
});

function fakeBluetooth(opts: { discoveryFailures?: number; dispatchOnDisconnect?: boolean } = {}) {
  let failures = opts.discoveryFailures ?? 0;
  const dev = new EventTarget() as EventTarget & { id: string; name: string; gatt: any };
  const ch = { startNotifications: vi.fn(async () => ch), addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const svc = { getCharacteristic: vi.fn(async () => ch) };
  const gatt: any = {
    connected: false,
    getPrimaryService: vi.fn(async () => { if (failures > 0) { failures--; throw new Error('service not found'); } return svc; }),
    disconnect: vi.fn(() => { gatt.connected = false; if (opts.dispatchOnDisconnect !== false) dev.dispatchEvent(new Event('gattserverdisconnected')); }),
  };
  gatt.connect = vi.fn(async () => { gatt.connected = true; return gatt; });
  Object.assign(dev, { id: 'dev-1', name: 'Fake HRM', gatt });
  const bt = { requestDevice: vi.fn(async () => dev), getDevices: vi.fn(async () => [dev]) } as unknown as Bluetooth;
  return { bt, dev, gatt, ch };
}

describe('BleAdapter connection lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });
  const track = (a: BleAdapter) => { const states: SensorState[] = []; a.onState((_slot, s) => states.push(s)); return states; };

  it('a forget during the retry backoff stays unpaired and never reconnects', async () => {
    const f = fakeBluetooth({ discoveryFailures: 1 });
    const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: f.bt });
    const states = track(a);
    const pairing = a.pair('hr');
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.gatt.connect).toHaveBeenCalledTimes(1);
    const d: PairedDevice = { slot: 'hr', id: 'dev-1', name: 'Fake HRM' };
    await a.disconnect(d);
    await vi.advanceTimersByTimeAsync(10000);
    await pairing;
    expect(f.gatt.connect).toHaveBeenCalledTimes(1);
    expect(states).not.toContain('connected');
    expect(states[states.length - 1]).toBe('unpaired');
  });

  it('a failed service discovery closes the GATT link instead of leaving it open', async () => {
    const f = fakeBluetooth({ discoveryFailures: 99 });
    const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: f.bt });
    const states = track(a);
    const pairing = a.pair('hr');
    await vi.advanceTimersByTimeAsync(100);
    expect(f.gatt.disconnect).toHaveBeenCalledTimes(1);
    expect(f.gatt.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(20000);
    await pairing;
    expect(f.gatt.connect).toHaveBeenCalledTimes(4);
    expect(f.gatt.disconnect).toHaveBeenCalledTimes(4);
    expect(states[states.length - 1]).toBe('offline');
  });

  it('a late gattserverdisconnected after forget does not change state or reconnect', async () => {
    const f = fakeBluetooth({ dispatchOnDisconnect: false });
    const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: f.bt });
    const states = track(a);
    const d = await a.pair('hr');
    expect(states[states.length - 1]).toBe('connected');
    await a.disconnect(d);
    expect(states[states.length - 1]).toBe('unpaired');
    const before = states.length;
    f.dev.dispatchEvent(new Event('gattserverdisconnected'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(states).toHaveLength(before);
    expect(states[states.length - 1]).toBe('unpaired');
    expect(f.gatt.connect).toHaveBeenCalledTimes(1);
  });

  it('pair on an occupied slot disconnects the previous device first', async () => {
    const f = fakeBluetooth({ dispatchOnDisconnect: false });
    const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: f.bt });
    await a.pair('hr');
    await a.pair('hr');
    expect(f.gatt.disconnect).toHaveBeenCalledTimes(1);
    expect(f.ch.removeEventListener).toHaveBeenCalledTimes(1);
    expect(f.ch.addEventListener).toHaveBeenCalledTimes(2);
  });

  it('adds the value listener only after notifications have started', async () => {
    const f = fakeBluetooth();
    const order: string[] = [];
    f.ch.startNotifications.mockImplementation(async () => { order.push('start'); return f.ch; });
    f.ch.addEventListener.mockImplementation(() => { order.push('listen'); });
    const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: f.bt });
    await a.pair('hr');
    expect(order).toEqual(['start', 'listen']);
  });

  describe('connect without a device object', () => {
    const d: PairedDevice = { slot: 'hr', id: 'dev-1', name: 'Fake HRM' };
    const msgs = (a: BleAdapter) => { const out: [SensorState, string | undefined][] = []; a.onState((_s, st, m) => out.push([st, m])); return out; };
    it('reports offline with the chooser hint when getDevices is unavailable', async () => {
      const bt = { requestDevice: vi.fn() } as unknown as Bluetooth;
      const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: bt });
      const out = msgs(a);
      await a.connect(d);
      expect(out).toEqual([['offline', 'Tap Reconnect to choose the device again']]);
      expect(a.needsChooser('hr')).toBe(true);
      expect(bt.requestDevice).not.toHaveBeenCalled();
    });
    it('reports the same when getDevices returns nothing', async () => {
      const bt = { requestDevice: vi.fn(), getDevices: vi.fn(async () => []) } as unknown as Bluetooth;
      const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: bt });
      const out = msgs(a);
      await a.connect(d);
      expect(out).toEqual([['offline', 'Tap Reconnect to choose the device again']]);
      expect(a.needsChooser('hr')).toBe(true);
    });
    it('keeps the chooser flag when the user cancels the chooser', async () => {
      const bt = { requestDevice: vi.fn(async () => { throw new Error('User cancelled'); }) } as unknown as Bluetooth;
      const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: bt });
      await a.connect(d);
      await expect(a.pair('hr')).rejects.toThrow('User cancelled');
      expect(a.needsChooser('hr')).toBe(true);
    });
    it('clears the chooser flag once pair() succeeds', async () => {
      const f = fakeBluetooth({ dispatchOnDisconnect: false });
      const a = new BleAdapter({ circumferenceMm: () => 2096, bluetooth: { requestDevice: f.bt.requestDevice } as unknown as Bluetooth });
      await a.connect(d);
      expect(a.needsChooser('hr')).toBe(true);
      await a.pair('hr');
      expect(a.needsChooser('hr')).toBe(false);
    });
  });
});
