export interface IndoorBikeReading {
  speedKmh?: number; cadenceRpm?: number; distanceM?: number; powerW?: number;
  kcalTotal?: number; hrBpm?: number; elapsedS?: number;
}

export function parseIndoorBikeData(dv: DataView): IndoorBikeReading | null {
  if (dv.byteLength < 2) return null;
  const f = dv.getUint16(0, true);
  const r: IndoorBikeReading = {};
  let o = 2;
  const need = (n: number) => { if (dv.byteLength < o + n) throw new RangeError('short'); };
  try {
    if ((f & 0x0001) === 0) { need(2); r.speedKmh = dv.getUint16(o, true) / 100; o += 2; }
    if (f & 0x0002) { need(2); o += 2; }                                            // avg speed
    if (f & 0x0004) { need(2); r.cadenceRpm = dv.getUint16(o, true) / 2; o += 2; }
    if (f & 0x0008) { need(2); o += 2; }                                            // avg cadence
    if (f & 0x0010) { need(3); r.distanceM = dv.getUint8(o) | (dv.getUint8(o + 1) << 8) | (dv.getUint8(o + 2) << 16); o += 3; }
    if (f & 0x0020) { need(2); o += 2; }                                            // resistance
    if (f & 0x0040) { need(2); r.powerW = Math.max(0, dv.getInt16(o, true)); o += 2; }
    if (f & 0x0080) { need(2); o += 2; }                                            // avg power
    if (f & 0x0100) { need(5); r.kcalTotal = dv.getUint16(o, true); o += 5; }      // total, per hour, per minute
    if (f & 0x0200) { need(1); r.hrBpm = dv.getUint8(o); o += 1; }
    if (f & 0x0400) { need(1); o += 1; }                                            // MET
    if (f & 0x0800) { need(2); r.elapsedS = dv.getUint16(o, true); o += 2; }
  } catch { return null; }
  return r;
}
