import { parseHeartRate } from './hr';
import { parseCsc } from './csc';
import { parseCyclingPower } from './cps';
import { parseIndoorBikeData } from './ftms';

const dv = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);

describe('parseHeartRate 0x2A37', () => {
  it('reads uint8 HR with no contact info', () => {
    expect(parseHeartRate(dv(0x00, 72))).toEqual({ bpm: 72, contact: null, rrMs: [] });
  });
  it('reads uint16 HR, contact detected, energy skipped, two RR intervals', () => {
    // flags: bit0=1 (u16), bits1-2=11 (contact supported+detected), bit3=1 energy, bit4=1 RR
    const r = parseHeartRate(dv(0x1f, 0x2c, 0x01, 0x10, 0x27, 0x00, 0x04, 0x33, 0x03));
    expect(r).toEqual({ bpm: 300, contact: true, rrMs: [1000, 800] });
  });
  it('returns null on empty or truncated packets', () => {
    expect(parseHeartRate(dv())).toBeNull();
    expect(parseHeartRate(dv(0x01, 0x2c))).toBeNull();
  });
});

describe('parseCsc 0x2A5B', () => {
  it('wheel + crank present', () => {
    const r = parseCsc(dv(0x03, 0x10, 0x27, 0x00, 0x00, 0x00, 0x04, 0x64, 0x00, 0x00, 0x08));
    expect(r).toEqual({ wheelRevs: 10000, wheelTime1024: 1024, crankRevs: 100, crankTime1024: 2048 });
  });
  it('crank only — fields start at offset 1 (vendor bug fixed)', () => {
    expect(parseCsc(dv(0x02, 0x64, 0x00, 0x00, 0x08))).toEqual({ crankRevs: 100, crankTime1024: 2048 });
  });
  it('returns null when flags promise more bytes than present', () => {
    expect(parseCsc(dv(0x03, 0x10, 0x27))).toBeNull();
  });
});

describe('parseCyclingPower 0x2A63', () => {
  it('power only', () => {
    expect(parseCyclingPower(dv(0x00, 0x00, 0xfa, 0x00))).toEqual({ watts: 250 });
  });
  it('balance + crank revolution data', () => {
    // flags 0x0021: bit0 balance present, bit5 crank data
    const r = parseCyclingPower(dv(0x21, 0x00, 0x2c, 0x01, 0x64, 0x05, 0x00, 0x00, 0x04));
    expect(r).toEqual({ watts: 300, balancePctRight: 50, crankRevs: 5, crankTime1024: 1024 });
  });
  it('negative power is clamped to 0, truncated packet is null', () => {
    expect(parseCyclingPower(dv(0x00, 0x00, 0xff, 0xff))).toEqual({ watts: 0 });
    expect(parseCyclingPower(dv(0x20, 0x00, 0x2c, 0x01))).toBeNull();
  });
});

describe('parseIndoorBikeData 0x2AD2', () => {
  it('KICKR-style packet: speed, cadence, power, distance, hr', () => {
    // flags 0x0254: bit2 cadence, bit4 distance, bit6 power, bit9 hr; bit0=0 so speed present
    const r = parseIndoorBikeData(dv(0x54, 0x02, 0x10, 0x0a, 0xb4, 0x00, 0xe8, 0x03, 0x00, 0xc8, 0x00, 0x8c));
    expect(r).toEqual({ speedKmh: 25.76, cadenceRpm: 90, distanceM: 1000, powerW: 200, hrBpm: 140 });
  });
  it('more-data packet without speed, with kcal and elapsed', () => {
    // flags 0x0901: bit0=1 (no speed), bit8 energy, bit11 elapsed
    const r = parseIndoorBikeData(dv(0x01, 0x09, 0x2c, 0x01, 0x90, 0x01, 0x05, 0x3c, 0x00));
    expect(r).toEqual({ kcalTotal: 300, elapsedS: 60 });
  });
  it('treats kcal 0xFFFF (data not available) as absent', () => {
    const r = parseIndoorBikeData(dv(0x01, 0x09, 0xff, 0xff, 0x90, 0x01, 0x05, 0x3c, 0x00));
    expect(r).toEqual({ elapsedS: 60 });
  });
  it('returns null on truncation', () => {
    expect(parseIndoorBikeData(dv(0x54, 0x02, 0x10))).toBeNull();
  });
});
