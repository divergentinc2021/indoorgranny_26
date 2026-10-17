import { readFileSync } from 'node:fs';
import { useClassPlans } from './classplan-store';
import { parseSecondsFile } from '../engine/classplan';
const raw = readFileSync('src/engine/__fixtures__/timers.seconds', 'utf8');
const plans = () => parseSecondsFile(JSON.parse(raw), 'seconds');
const byTitle = (t: string) => useClassPlans.getState().plans.find((p) => p.title.startsWith(t))!;
describe('useClassPlans', () => {
  beforeEach(() => { useClassPlans.setState({ plans: [], selectedId: null, autoPickedOn: null }); });
  afterEach(() => vi.unstubAllGlobals());
  it('add dedupes by id and does not replace', () => {
    expect(useClassPlans.getState().add(plans())).toEqual({ added: 4, skipped: 0 });
    const first = useClassPlans.getState().plans[0];
    expect(useClassPlans.getState().add(plans())).toEqual({ added: 0, skipped: 4 });
    expect(useClassPlans.getState().plans).toHaveLength(4);
    expect(useClassPlans.getState().plans[0]).toBe(first);
  });
  it('todays finds the plan dated that day', () => {
    useClassPlans.getState().add(plans());
    expect(useClassPlans.getState().todays('2026-10-19')?.title).toMatch(/^Session 1 /);
    expect(useClassPlans.getState().todays('2026-10-23')).toBeNull();
  });
  it('autoPickToday selects when nothing selected', () => {
    useClassPlans.getState().add(plans());
    useClassPlans.getState().autoPickToday('2026-10-21');
    expect(useClassPlans.getState().selected()?.title).toMatch(/^Session 11/);
    expect(useClassPlans.getState().autoPickedOn).toBe('2026-10-21');
  });
  it('autoPickToday replaces a selection dated another day', () => {
    useClassPlans.getState().add(plans());
    useClassPlans.getState().select(byTitle('Session 1 ').id);
    useClassPlans.getState().autoPickToday('2026-10-21');
    expect(useClassPlans.getState().selected()?.title).toMatch(/^Session 11/);
  });
  it('autoPickToday keeps a selection already dated today and does not burn autoPickedOn', () => {
    useClassPlans.getState().add(plans());
    useClassPlans.getState().select(byTitle('Session 11').id);
    useClassPlans.getState().autoPickToday('2026-10-21');
    expect(useClassPlans.getState().selected()?.title).toMatch(/^Session 11/);
    expect(useClassPlans.getState().autoPickedOn).toBeNull();
  });
  it('a manual choice sticks for the rest of the day', () => {
    useClassPlans.getState().add(plans());
    useClassPlans.getState().autoPickToday('2026-10-21');
    useClassPlans.getState().select(byTitle('Session 4').id);
    useClassPlans.getState().autoPickToday('2026-10-21');
    expect(useClassPlans.getState().selected()?.title).toMatch(/^Session 4/);
  });
  it('autoPickToday does nothing when no plan is dated today', () => {
    useClassPlans.getState().add(plans());
    useClassPlans.getState().autoPickToday('2026-10-23');
    expect(useClassPlans.getState().selectedId).toBeNull();
    expect(useClassPlans.getState().autoPickedOn).toBeNull();
  });
  it('bundled plans cannot be removed, others can and clear the selection', () => {
    useClassPlans.getState().add(parseSecondsFile(JSON.parse(raw), 'bundled').slice(0, 1));
    const b = useClassPlans.getState().plans[0];
    useClassPlans.getState().remove(b.id);
    expect(useClassPlans.getState().plans).toHaveLength(1);
    useClassPlans.getState().add(plans().slice(1, 2));
    const u = useClassPlans.getState().plans[1];
    useClassPlans.getState().select(u.id);
    useClassPlans.getState().remove(u.id);
    expect(useClassPlans.getState().plans).toHaveLength(1);
    expect(useClassPlans.getState().selectedId).toBeNull();
  });
  it('importFile adds plans; bad input throws and leaves the store unchanged', () => {
    expect(useClassPlans.getState().importFile(raw)).toEqual({ added: 4, skipped: 0 });
    expect(() => useClassPlans.getState().importFile('not json')).toThrow();
    expect(() => useClassPlans.getState().importFile('{"a":1}')).toThrow('Not a Seconds file');
    expect(useClassPlans.getState().plans).toHaveLength(4);
  });
  it('loadBundled adds the fixture plans as bundled', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => ({ json: async () => (u.endsWith('index.json') ? ['2026-10-timers.seconds'] : JSON.parse(raw)) })));
    await useClassPlans.getState().loadBundled();
    expect(useClassPlans.getState().plans).toHaveLength(4);
    expect(useClassPlans.getState().plans.every((p) => p.source === 'bundled')).toBe(true);
    await useClassPlans.getState().loadBundled();
    expect(useClassPlans.getState().plans).toHaveLength(4);
  });
  it('loadBundled swallows an offline failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await expect(useClassPlans.getState().loadBundled()).resolves.toBeUndefined();
  });
});
