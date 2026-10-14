import { parseWorkout, workoutAt, targetWatts } from './workout';
const w = { id: 'w1', title: 'Test', type: 'PWR', wdate: '2026-10-14', totalduration: 30, timeS: [10, 20], pwrS: [50, 100], cadS: [80, 90], hrS: [60, 80] };
describe('workout', () => {
  it('parses a valid workout and rejects ragged arrays', () => {
    expect(parseWorkout(w)?.title).toBe('Test');
    expect(parseWorkout({ ...w, pwrS: [50] })).toBeNull();
    expect(parseWorkout({ ...w, type: 'XX' })).toBeNull();
    expect(parseWorkout('nope')).toBeNull();
  });
  it('locates the step and remaining time', () => {
    const p = parseWorkout(w)!;
    expect(workoutAt(p, 0)).toEqual({ step: 0, remainingS: 10, pctFtp: 50, cadence: 80, pctHr: 60 });
    expect(workoutAt(p, 10)).toEqual({ step: 1, remainingS: 20, pctFtp: 100, cadence: 90, pctHr: 80 });
    expect(workoutAt(p, 29)!.remainingS).toBe(1);
    expect(workoutAt(p, 30)).toBeNull();
  });
  it('target watts', () => { expect(targetWatts(100, 250)).toBe(250); expect(targetWatts(55, 250)).toBe(138); });
});
