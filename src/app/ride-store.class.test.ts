import { useRide } from './ride-store';
import { useSettings } from './settings-store';
import { useClassPlans } from './classplan-store';
import * as sessionsModule from '../data/sessions';
import { classAlert } from './alerts';
import type { ClassPlan } from '../engine/classplan';

vi.mock('./alerts', () => ({ classAlert: vi.fn(), prepareAudio: vi.fn() }));

const iv = (name: string, durationS: number) => ({ name, displayName: name, durationS, zone: 2 as const });
const PLAN: ClassPlan = { id: 'p1', title: 'Test class', dates: [], source: 'seconds', intervals: [iv('Endurance 80+ 5:00', 300), iv('Sprint 1:00', 60), iv('Cool down 2:00', 120)], totalS: 480 };
const adv = (s: number) => vi.advanceTimersByTimeAsync(s * 1000);
const st = () => useRide.getState();

describe('ride store class mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    vi.spyOn(sessionsModule, 'saveSession').mockResolvedValue(undefined as never);
    vi.spyOn(sessionsModule, 'deleteSession').mockResolvedValue(undefined as never);
    vi.mocked(classAlert).mockClear();
    useSettings.getState().set({ countdownS: 0, classAlerts: 'both' });
    useClassPlans.setState({ plans: [PLAN], selectedId: PLAN.id });
  });
  afterEach(() => { st().discard(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('class mode auto-laps at each plan boundary with the interval names, then goes done and back to none', async () => {
    st().begin({ classMode: 'class' });
    expect(st().classPhase).toBe('class'); expect(st().classStatus?.index).toBe(0);
    await adv(300);
    expect(st().lapRows).toHaveLength(1);
    expect(st().lapRows[0]).toMatchObject({ durationS: 300, name: 'Endurance 80+ 5:00' });
    await adv(60);
    expect(st().lapRows).toHaveLength(2); expect(st().lapRows[1]).toMatchObject({ durationS: 60, name: 'Sprint 1:00' });
    await adv(120);
    expect(st().lapRows).toHaveLength(3); expect(st().lapRows[2].name).toBe('Cool down 2:00');
    expect(st().classPhase).toBe('done'); expect(st().classStatus?.done).toBe(true);
    await adv(5);
    expect(st().classPhase).toBe('none'); expect(st().classStatus).toBeNull();
    const n = st().lapRows.length;
    st().lap();
    expect(st().lapRows).toHaveLength(n + 1); expect(st().lapRows[n].name).toBeUndefined();
  });

  it('warmup mode does not auto-lap; startClass closes Warm up and anchors the plan at that moment', async () => {
    st().begin({ classMode: 'warmup' });
    expect(st().classPhase).toBe('warmup');
    await adv(124);                                   // engine elapsed is 125
    expect(st().view?.elapsedS).toBe(125);
    st().startClass();
    expect(st().classPhase).toBe('class');
    expect(st().lapRows).toHaveLength(1); expect(st().lapRows[0]).toMatchObject({ name: 'Warm up', durationS: 125 });
    await adv(299);                                   // elapsed 424: one second short of the boundary
    expect(st().lapRows).toHaveLength(1);
    await adv(1);
    expect(st().lapRows).toHaveLength(2); expect(st().lapRows[1]).toMatchObject({ name: 'Endurance 80+ 5:00', durationS: 300 });
  });

  it('warmup with no startClass never auto-laps', async () => {
    st().begin({ classMode: 'warmup' });
    await adv(400);
    expect(st().lapRows).toHaveLength(0); expect(st().classPhase).toBe('warmup');
  });

  it('startClass is a no-op outside warmup', async () => {
    st().begin({ classMode: 'class' }); await adv(10);
    st().startClass();
    expect(st().lapRows).toHaveLength(0); expect(st().classPhase).toBe('class');
  });

  it('a manual lap during class closes with the interval name and keeps the plan boundaries', async () => {
    st().begin({ classMode: 'class' });
    await adv(99);                                    // elapsed 100
    st().lap();
    expect(st().lapRows).toHaveLength(1); expect(st().lapRows[0]).toMatchObject({ name: 'Endurance 80+ 5:00', durationS: 100 });
    expect(st().classStatus?.index).toBe(1);
    await adv(259);                                   // elapsed 359
    expect(st().lapRows).toHaveLength(1);
    await adv(1);                                     // elapsed 360: end of the Sprint interval
    expect(st().lapRows).toHaveLength(2); expect(st().lapRows[1]).toMatchObject({ name: 'Sprint 1:00', durationS: 260 });
  });

  it('a manual lap on the exact boundary second yields one row per interval, no duplicate and none missing', async () => {
    st().begin({ classMode: 'class' });
    await adv(298);                                   // elapsed 299, runner has ticked up to here
    vi.setSystemTime(Date.now() + 1000);              // elapsed rolls to 300 before the next 1 Hz tick
    st().lap();
    expect(st().lapRows.map((r) => r.name)).toEqual(['Endurance 80+ 5:00', 'Sprint 1:00']);
    expect(st().lapRows[0].durationS).toBe(300);
    expect(st().classStatus?.index).toBe(2);
    await adv(1);                                     // the pending tick must not close anything extra
    expect(st().lapRows).toHaveLength(2);
    await adv(180);
    expect(st().lapRows.map((r) => r.name)).toEqual(['Endurance 80+ 5:00', 'Sprint 1:00', 'Cool down 2:00']);
    expect(st().classPhase).toBe('done');
  });

  it('pause freezes the plan: the boundary lands later in wall time and the lap duration is unchanged', async () => {
    st().begin({ classMode: 'class' });
    await adv(100); st().pause();
    await adv(30);
    expect(st().lapRows).toHaveLength(0);
    st().resume();
    await adv(198);                                   // 100 + 198 recorded seconds
    expect(st().lapRows).toHaveLength(0);
    await adv(2);
    expect(st().lapRows).toHaveLength(1); expect(st().lapRows[0].durationS).toBe(300);
  });

  it('stop during class resets the phase and no further laps appear', async () => {
    st().begin({ classMode: 'class' });
    await adv(100);
    st().stop();
    expect(st().classPhase).toBe('none'); expect(st().classStatus).toBeNull();
    expect(st().lapRows).toHaveLength(1); expect(st().lapRows[0].name).toBe('Endurance 80+ 5:00');   // final lap named after the interval
    const n = st().lapRows.length;
    await adv(600);
    expect(st().lapRows).toHaveLength(n); expect(st().classPhase).toBe('none');
  });

  it('stop from paused during class still names the final lap after the interval', async () => {
    st().begin({ classMode: 'class' });
    await adv(100); st().pause(); await adv(20);
    st().stop();
    expect(st().classPhase).toBe('none');
    expect(st().lapRows).toHaveLength(1); expect(st().lapRows[0].name).toBe('Endurance 80+ 5:00');
  });

  it('stop while in the done window cancels the pending reset timer', async () => {
    st().begin({ classMode: 'class' });
    await adv(480); expect(st().classPhase).toBe('done');
    st().stop();
    expect(st().classPhase).toBe('none');
    await adv(10);
    expect(st().classPhase).toBe('none');
  });

  it('save() records the plan id and title', async () => {
    st().begin({ classMode: 'class' });
    await adv(10); st().stop();
    const rec = await st().save();
    expect(rec).toMatchObject({ planId: 'p1', planTitle: 'Test class' });
  });

  it('a ride without class mode carries no plan fields', async () => {
    st().begin(); await adv(5); st().stop();
    const rec = await st().save();
    expect(rec.planId).toBeUndefined(); expect(rec.planTitle).toBeUndefined();
  });

  it('fires classAlert on every boundary with the setting', async () => {
    useSettings.getState().set({ classAlerts: 'vibrate' });
    st().begin({ classMode: 'class' });
    await adv(300); expect(classAlert).toHaveBeenCalledTimes(1);
    await adv(180); expect(classAlert).toHaveBeenCalledTimes(3);
    expect(classAlert).toHaveBeenCalledWith('vibrate');
  });

  it('without a selected plan classMode is ignored: phase none and no alerts', async () => {
    useClassPlans.setState({ selectedId: null });
    st().begin({ classMode: 'class' });
    expect(st().classPhase).toBe('none');
    await adv(400);
    expect(st().lapRows).toHaveLength(0); expect(classAlert).not.toHaveBeenCalled();
  });
});
