import 'fake-indexeddb/auto';
import { useRide } from './ride-store';
import { useSettings } from './settings-store';
import { getSamples, getSession } from '../data/sessions';

describe('ride store partial flush', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); });
  it('writes samples every 10 s while recording', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin();
    await vi.advanceTimersByTimeAsync(21000);
    const id = useRide.getState().engine!.startMs;
    expect((await getSamples(id)).length).toBeGreaterThanOrEqual(20);
    expect((await getSession(id))?.nSamples).toBeGreaterThanOrEqual(20);
    useRide.getState().stop(); useRide.getState().discard();
    expect(await getSession(id)).toBeUndefined();          // discard removes the partial write
  });
});
