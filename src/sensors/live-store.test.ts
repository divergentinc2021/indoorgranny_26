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
  it('speedSensorPresent is true with a fresh speed or trainer reading, false otherwise and after stale', () => {
    const s = new LiveStore(); s.setPaired(['csc', 'trainer']);
    expect(s.snapshot(1000).speedSensorPresent).toBe(false);
    s.accept(r('speed', 0, 'csc', 1000));                 // a stopped wheel still counts as present
    expect(s.snapshot(1500).speedSensorPresent).toBe(true);
    expect(s.snapshot(6001).speedSensorPresent).toBe(false);
    const t = new LiveStore(); t.setPaired(['trainer']);
    t.accept(r('trainer', 0, 'trainer', 1000, { distanceM: 5 }));
    expect(t.snapshot(1500).speedSensorPresent).toBe(true);
    const c = new LiveStore(); c.setPaired(['csc']);
    c.accept(r('cadence', 80, 'csc', 1000));              // cadence-only sensor does not count
    expect(c.snapshot(1500).speedSensorPresent).toBe(false);
  });
});
