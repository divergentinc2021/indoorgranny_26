import 'fake-indexeddb/auto';
import { useSettings } from './settings-store';
import { useRiders } from './rider-store';
import { useRide } from './ride-store';
import { useSensors } from './sensor-store';
import { newRider } from '../data/riders';

describe('settings store', () => {
  it('has vendor defaults and persists device per slot', () => {
    const s = useSettings.getState();
    expect(s).toMatchObject({ unitSystem: 'metric', countdownS: 0, smoothingN: 1, wheelMm: 1782, structuredWorkoutEnabled: false, licenseAccepted: false });
    s.setDevice('hr', { slot: 'hr', id: 'x', name: 'Strap' });
    expect(useSettings.getState().devices.hr?.name).toBe('Strap');
    expect(JSON.parse(localStorage.getItem('ig.settings')!).state.devices.hr.id).toBe('x');
  });
});

describe('ride store', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }); });
  afterEach(() => { vi.useRealTimers(); });
  it('begin → countdown → recording → save writes a session for the current rider', async () => {
    const r = newRider({ name: 'Ann', email: 'a@x' });
    await useRiders.getState().save(r); useRiders.getState().select(r.id);
    useSettings.getState().set({ countdownS: 5 });
    useSensors.getState().live.setPaired([]);
    useRide.getState().begin();
    expect(useRide.getState().countdownLeft).toBe(5);
    vi.advanceTimersByTime(5000);
    expect(useRide.getState().state).toBe('recording');
    vi.advanceTimersByTime(3000);
    expect(useRide.getState().view?.elapsedS).toBeGreaterThanOrEqual(3);
    useRide.getState().lap(); expect(useRide.getState().lapRows).toHaveLength(1);
    useRide.getState().stop();
    const saved = await useRide.getState().save();
    expect(saved).toMatchObject({ riderId: r.id, riderName: 'Ann', sport: 'indoor_cycling' });
    expect(saved.nSamples).toBeGreaterThanOrEqual(3);
    expect(useRide.getState().state).toBe('idle');
  });
  it('discard resets without writing', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin(); vi.advanceTimersByTime(1000);
    useRide.getState().stop(); useRide.getState().discard();
    expect(useRide.getState().engine).toBeNull();
  });
});
