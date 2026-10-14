import { powerZones, zoneIndex, hrBand, DEFAULT_FTP } from './zones';
describe('powerZones', () => {
  it('builds 7 Coggan zones from FTP 250 matching the vendor table within rounding', () => {
    const z = powerZones(250);
    expect(z.map((x) => x.lowerW)).toEqual([0, 138, 188, 225, 263, 300, 375]);
    expect(z[0].upperW).toBe(137);
    expect(z[6].upperW).toBeNull();
    expect(z.map((x) => x.name)).toEqual(['Active recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Neuromuscular']);
  });
  it('custom list overrides, upper = next lower − 1', () => {
    const z = powerZones(250, [['Easy', 0], ['Hard', 200]]);
    expect(z).toEqual([
      { name: 'Easy', lowerW: 0, upperW: 199, cls: 'z1' },
      { name: 'Hard', lowerW: 200, upperW: null, cls: 'z2' },
    ]);
  });
  it('falls back to DEFAULT_FTP when ftp is 0/NaN', () => { expect(powerZones(0)[3].lowerW).toBe(225); expect(DEFAULT_FTP).toBe(250); });
  it('zoneIndex picks the band', () => { const z = powerZones(250); expect(zoneIndex(z, 0)).toBe(0); expect(zoneIndex(z, 225)).toBe(3); expect(zoneIndex(z, 999)).toBe(6); });
});
describe('hrBand', () => {
  it('maps %HRmax to five bands', () => {
    expect(hrBand(50)).toBe('z1'); expect(hrBand(60)).toBe('z2'); expect(hrBand(75)).toBe('z3'); expect(hrBand(85)).toBe('z4'); expect(hrBand(86)).toBe('z5');
  });
});
