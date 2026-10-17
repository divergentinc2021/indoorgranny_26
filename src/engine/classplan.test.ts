import { readFileSync } from 'node:fs';
import { datesFromTitle, displayNameOf, isoDay, parseSecondsFile, slug, zoneFor } from './classplan';

const raw = readFileSync('src/engine/__fixtures__/timers.seconds', 'utf8');
const fixture = JSON.parse(raw);
const items = fixture.packs.flatMap((p: { items: unknown[] }) => p.items) as { intervals: { duration: number; name: string }[] }[];

describe('parseSecondsFile', () => {
  const plans = parseSecondsFile(fixture, 'bundled');
  it('parses the four plans with their interval counts and totals', () => {
    expect(plans.map((p) => p.intervals.length)).toEqual([27, 38, 59, 35]);
    expect(plans.map((p) => p.totalS)).toEqual([3060, 3090, 3020, 3090]);
    expect(plans.every((p) => p.source === 'bundled')).toBe(true);
  });
  it('totals match the raw fixture durations', () => {
    expect(plans.map((p) => p.totalS)).toEqual(items.map((it) => it.intervals.reduce((s, i) => s + i.duration, 0)));
  });
  it('derives stable, distinct ids and dates', () => {
    expect(plans[0].id).toBe('4B224910-38AC-4DE5-A5AC-325E61F65251:session-1-score-65-19-20-october-2026');
    expect(plans[1].id.startsWith('7BCAB4C9-')).toBe(true);
    expect(plans[2].id.startsWith('7BCAB4C9-')).toBe(true);
    expect(new Set(plans.map((p) => p.id)).size).toBe(4);
    expect(plans[0].dates).toEqual(['2026-10-19', '2026-10-20']);
    expect(plans[3].dates).toEqual(['2026-10-28', '2026-10-29']);
  });
  it('defaults source to seconds', () => expect(parseSecondsFile(fixture)[0].source).toBe('seconds'));
  it('every fixture interval resolves by keyword, not colour', () => {
    const needColour = plans.flatMap((p) => p.intervals.map((i) => i.name)).filter((n) => !/sprint|neuro|leg speed|wind[\s-]?up|anaerobic|vo2|threshold|tempo|endurance|easy|recover|cool|warm/i.test(n));
    expect(needColour).toEqual([]);
  });
  it('drops indefinite and non-positive intervals but keeps the plan', () => {
    const mk = (extra: object[]) => ({ name: 'T', identifier: 'X', intervals: [{ name: 'Tempo 1:00', duration: 60, color: 4, indefinite: false }, ...extra] });
    const [p] = parseSecondsFile(mk([{ name: 'Open', duration: 0, indefinite: true }, { name: 'Zero', duration: 0 }, { name: 'Neg', duration: -5 }, { name: 'Str', duration: '60' }]));
    expect(p.intervals.map((i) => i.name)).toEqual(['Tempo 1:00']);
    expect(p.totalS).toBe(60);
  });
  it('drops a plan with no usable intervals', () => {
    const f = { packs: [{ items: [{ name: 'Empty', identifier: 'E', intervals: [{ name: 'Open', duration: 0, indefinite: true }] }, { name: 'Ok', identifier: 'O', intervals: [{ name: 'Easy', duration: 30, color: 0 }] }] }] };
    expect(parseSecondsFile(f).map((p) => p.title)).toEqual(['Ok']);
  });
  it('accepts a bare item and a bare {intervals}', () => {
    expect(parseSecondsFile(items[0])).toHaveLength(1);
    expect(parseSecondsFile({ intervals: [{ name: 'Easy', duration: 30, color: 0 }] })).toHaveLength(1);
  });
  it('throws on junk', () => {
    expect(() => parseSecondsFile({})).toThrow('Not a Seconds file');
    expect(() => parseSecondsFile('x')).toThrow('Not a Seconds file');
    expect(() => parseSecondsFile(null)).toThrow('Not a Seconds file');
  });
});

describe('slug', () => it('lowercases and collapses', () => expect(slug('Session 11 ( Score 74) 21 - 22 October 2026')).toBe('session-11-score-74-21-22-october-2026')));

describe('datesFromTitle', () => {
  it('handles ranges, single days and none', () => {
    expect(datesFromTitle('Session 1 Score 65 19-20 October 2026')).toEqual(['2026-10-19', '2026-10-20']);
    expect(datesFromTitle('Session 11 ( Score 74) 21 - 22 October 2026')).toEqual(['2026-10-21', '2026-10-22']);
    expect(datesFromTitle('Session 4 ( Score 56) 28-29 October 2026')).toEqual(['2026-10-28', '2026-10-29']);
    expect(datesFromTitle('Ride 3 November 2026')).toEqual(['2026-11-03']);
    expect(datesFromTitle('ride 3 NOVEMBER 2026')).toEqual(['2026-11-03']);
    expect(datesFromTitle('Warm up session')).toEqual([]);
  });
});

describe('zoneFor', () => {
  it('keyword table, then colour, then 2', () => {
    const cases: [string, number | undefined, number][] = [['Sprint 0:30', 1, 7], ['Wind Up Leg Speed 0:20', 1, 7], ['Mid-Upper VO2 80+ 2:00', 6, 5], ['Mid Threshold 80+ 1:00', 3, 4], ['Low Tempo 80+ 1:00', 4, 3], ['Endurance 80+ 5:00', 5, 2], ['Cool Down 2:00', 0, 1], ['Easy Pedal 2:00', 0, 1], ['Mystery', 2, 6], ['Mystery', undefined, 2], ['Sprint', 5, 7], ['Mystery', 99, 2]];
    for (const [n, c, z] of cases) expect(zoneFor(n, c)).toBe(z);
  });
});

describe('displayNameOf', () => {
  it('strips counters, times and cadence tags', () => {
    expect(displayNameOf('Ain 2 1/2 Low Endurance 80+ 1:00')).toBe('Low Endurance');
    expect(displayNameOf('2/7 Low Tempo 80+ 1:00')).toBe('Low Tempo');
    expect(displayNameOf('Upper VO2 100+ 0:30')).toBe('Upper VO2');
    expect(displayNameOf('Cool Down 2:00')).toBe('Cool Down');
    expect(displayNameOf('Wind Up Leg Speed 0:20')).toBe('Wind Up Leg Speed');
  });
});

describe('isoDay', () => it('uses local date parts', () => expect(isoDay(new Date(2026, 9, 19, 23, 30))).toBe('2026-10-19')));
