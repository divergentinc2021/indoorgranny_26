import { fmtDuration, fmtDistance, fmtSpeed, fmtDate } from './format';
describe('format', () => {
  it('duration h:mm:ss', () => { expect(fmtDuration(3661)).toBe('1:01:01'); expect(fmtDuration(59)).toBe('0:00:59'); });
  it('distance and speed per unit system', () => {
    expect(fmtDistance(1234, 'metric')).toBe('1.23 km'); expect(fmtDistance(1609.344, 'imperial')).toBe('1.00 mi');
    expect(fmtSpeed(10, 'metric')).toBe('36.0 km/h'); expect(fmtSpeed(10, 'imperial')).toBe('22.4 mph');
  });
  it('vendor date format', () => { expect(fmtDate(Date.UTC(2026, 9, 14, 6, 5, 9) + new Date().getTimezoneOffset() * 60000)).toBe('14 October 2026, 06:05:09'); });
});
