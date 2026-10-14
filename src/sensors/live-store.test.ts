import { LiveStore } from './live-store';
const r = (kind: any, value: number, slot: any, at = 1000, extra?: any) => ({ kind, value, at, slot, extra });
describe('LiveStore', () => {
  it('trainer feeds power/cadence/speed when nothing more specific is paired', () => {
    const s = new LiveStore(); s.setPaired(['trainer']);
    expect(s.accept(r('power', 200, 'trainer'))).toBe(true);
    expect(s.accept(r('trainer', 0, 'trainer', 1000, { distanceM: 500, kcal: 12 }))).toBe(true);
    expect(s.snapshot(1500)).toMatchObject({ power: 200, trainerDistanceM: 500, trainerKcal: 12 });
  });
  it('a paired power meter owns power and cadence over the trainer', () => {
    const s = new LiveStore(); s.setPaired(['power', 'trainer']);
    expect(s.accept(r('power', 300, 'power'))).toBe(true);
    expect(s.accept(r('power', 200, 'trainer'))).toBe(false);
    expect(s.snapshot(1500).power).toBe(300);
  });
  it('stale kinds read zero after staleMs', () => {
    const s = new LiveStore(); s.setPaired(['hr']);
    s.accept(r('hr', 150, 'hr', 1000));
    expect(s.snapshot(5999).hr).toBe(150); expect(s.snapshot(6001).hr).toBe(0);
  });
});
