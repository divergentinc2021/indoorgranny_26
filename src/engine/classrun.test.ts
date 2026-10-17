import { ClassRunner } from './classrun';
import type { ClassPlan } from './classplan';

const plan: ClassPlan = {
  id: 'test:three', title: 'Three', dates: [], source: 'bundled', totalS: 480,
  intervals: [
    { name: 'Warm up', displayName: 'Warm up', durationS: 300, zone: 1 },
    { name: 'Sprint', displayName: 'Sprint', durationS: 60, zone: 7 },
    { name: 'Recover', displayName: 'Recover', durationS: 120, zone: 1 },
  ],
};

describe('ClassRunner', () => {
  it('walks boundaries at exact seconds and ends at totalS', () => {
    const r = new ClassRunner(plan, 0);
    expect(r.tick(1)).toMatchObject({ index: 0, remainingS: 299, boundary: false, done: false });
    expect(r.tick(300)).toMatchObject({ index: 1, remainingS: 60, boundary: true, done: false });
    expect(r.tick(360)).toMatchObject({ index: 2, boundary: true, done: false });
    expect(r.tick(480)).toMatchObject({ boundary: true, done: true, interval: null });
    expect(r.tick(481)).toMatchObject({ boundary: false, done: true, interval: null });
  });

  it('anchors class time to the closed warm-up', () => {
    const r = new ClassRunner(plan, 125);
    expect(r.tick(125)).toMatchObject({ index: 0, remainingS: 300, boundary: false });
    expect(r.tick(425)).toMatchObject({ boundary: true, index: 1 });
  });

  it('skip moves the index without moving boundaries', () => {
    const r = new ClassRunner(plan, 0);
    r.tick(100);
    expect(r.skip(100)).toMatchObject({ index: 1, remainingS: 260, boundary: false });
    expect(r.tick(360)).toMatchObject({ index: 2, boundary: true });
    expect(r.tick(480)).toMatchObject({ done: true, boundary: true });
  });

  it('skipping the last interval ends the class', () => {
    const r = new ClassRunner(plan, 0);
    r.skip(0); r.skip(10);
    expect(r.skip(20)).toMatchObject({ done: true, interval: null, boundary: false });
    expect(r.tick(21)).toMatchObject({ done: true, boundary: false });
  });

  it('a late tick past a boundary yields exactly one boundary', () => {
    const r = new ClassRunner(plan, 0);
    r.tick(299);
    expect(r.tick(302)).toMatchObject({ index: 1, boundary: true, remainingS: 58 });
    expect(r.tick(303)).toMatchObject({ index: 1, boundary: false });
  });

  it('a late tick past two boundaries advances twice but reports one boundary', () => {
    const r = new ClassRunner(plan, 0);
    r.tick(299);
    expect(r.tick(370)).toMatchObject({ index: 2, boundary: true, remainingS: 110 });
  });

  it('pct is the fraction of the current remaining window', () => {
    const r = new ClassRunner(plan, 0);
    expect(r.tick(150).pct).toBeCloseTo(0.5);
    expect(r.tick(300).pct).toBeCloseTo(0);
  });

  it('pct after a skip is measured from the skip point', () => {
    const r = new ClassRunner(plan, 0);
    r.skip(100);
    expect(r.tick(130).pct).toBeCloseTo(30 / 260);
  });

  it('status getter reflects the last tick', () => {
    const r = new ClassRunner(plan, 0);
    expect(r.status).toMatchObject({ index: 0, remainingS: 300, boundary: false, done: false });
    r.tick(300);
    expect(r.status).toMatchObject({ index: 1, boundary: true });
  });

  it('a skip right after a boundary the caller has not ticked yet keeps that lap close', () => {
    const r = new ClassRunner(plan, 0);
    r.tick(299);
    expect(r.skip(302)).toMatchObject({ index: 2, boundary: true, remainingS: 178 });
  });
});
