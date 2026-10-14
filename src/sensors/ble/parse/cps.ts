export interface CyclingPowerReading {
  watts: number; balancePctRight?: number;
  wheelRevs?: number; wheelTime2048?: number; crankRevs?: number; crankTime1024?: number;
}

export function parseCyclingPower(dv: DataView): CyclingPowerReading | null {
  if (dv.byteLength < 4) return null;
  const flags = dv.getUint16(0, true);
  const r: CyclingPowerReading = { watts: Math.max(0, dv.getInt16(2, true)) };
  let o = 4;
  const need = (n: number) => { if (dv.byteLength < o + n) throw new RangeError('short'); };
  try {
    if (flags & 0x0001) { need(1); r.balancePctRight = dv.getUint8(o) / 2; o += 1; }
    if (flags & 0x0004) { need(2); o += 2; }                               // accumulated torque
    if (flags & 0x0010) { need(6); r.wheelRevs = dv.getUint32(o, true); r.wheelTime2048 = dv.getUint16(o + 4, true); o += 6; }
    if (flags & 0x0020) { need(4); r.crankRevs = dv.getUint16(o, true); r.crankTime1024 = dv.getUint16(o + 2, true); o += 4; }
  } catch { return null; }
  return r;
}
