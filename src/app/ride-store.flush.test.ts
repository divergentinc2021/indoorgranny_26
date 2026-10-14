import 'fake-indexeddb/auto';
import { useRide } from './ride-store';
import { useSettings } from './settings-store';
import * as sessionsModule from '../data/sessions';
import { getSamples, getSession } from '../data/sessions';

describe('ride store partial flush', () => {
  // Fake only these: fake-indexeddb needs the real setTimeout/setImmediate to complete transactions.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); useRide.getState().discard(); });
  it('writes samples every 10 s while recording', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin();
    await vi.advanceTimersByTimeAsync(21000);
    const id = useRide.getState().engine!.startMs;
    expect((await getSamples(id)).length).toBeGreaterThanOrEqual(20);
    expect((await getSession(id))?.nSamples).toBeGreaterThanOrEqual(20);
    useRide.getState().stop(); useRide.getState().discard();
    // discard now waits for the last flush before deleting, so the removal lands asynchronously
    for (let i = 0; i < 50 && (await getSession(id)); i++) await new Promise((r) => setTimeout(r, 5));
    expect(await getSession(id)).toBeUndefined();          // discard removes the partial write
    expect((await getSamples(id)).length).toBe(0);
  });
  it('does not re-flush every second while paused', async () => {
    const spy = vi.spyOn(sessionsModule, 'saveSession');
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin();
    await vi.advanceTimersByTimeAsync(10000);
    expect(spy).toHaveBeenCalledTimes(1);
    useRide.getState().pause();
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).toHaveBeenCalledTimes(1);
    useRide.getState().resume();
    await vi.advanceTimersByTimeAsync(10000);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
