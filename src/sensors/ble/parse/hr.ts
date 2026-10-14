export interface HeartRateReading { bpm: number; contact: boolean | null; rrMs: number[] }

export function parseHeartRate(dv: DataView): HeartRateReading | null {
  if (dv.byteLength < 2) return null;
  const flags = dv.getUint8(0);
  const u16 = (flags & 0x01) !== 0;
  let o = 1;
  if (dv.byteLength < o + (u16 ? 2 : 1)) return null;
  const bpm = u16 ? dv.getUint16(o, true) : dv.getUint8(o);
  o += u16 ? 2 : 1;
  const contactSupported = (flags & 0x04) !== 0;
  const contact = contactSupported ? (flags & 0x02) !== 0 : null;
  if (flags & 0x08) { if (dv.byteLength < o + 2) return null; o += 2; }
  const rrMs: number[] = [];
  if (flags & 0x10) {
    while (o + 2 <= dv.byteLength) { rrMs.push(Math.round((dv.getUint16(o, true) * 1000) / 1024)); o += 2; }
  }
  return { bpm, contact, rrMs };
}
