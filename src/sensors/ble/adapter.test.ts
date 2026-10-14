import { BleAdapter } from './adapter';
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
