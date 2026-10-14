export interface CscReading { wheelRevs?: number; wheelTime1024?: number; crankRevs?: number; crankTime1024?: number }

export function parseCsc(dv: DataView): CscReading | null {
  if (dv.byteLength < 1) return null;
  const flags = dv.getUint8(0);
  let o = 1;
  const r: CscReading = {};
  if (flags & 0x01) {
    if (dv.byteLength < o + 6) return null;
    r.wheelRevs = dv.getUint32(o, true); r.wheelTime1024 = dv.getUint16(o + 4, true); o += 6;
  }
  if (flags & 0x02) {
    if (dv.byteLength < o + 4) return null;
    r.crankRevs = dv.getUint16(o, true); r.crankTime1024 = dv.getUint16(o + 2, true); o += 4;
  }
  return r;
}
