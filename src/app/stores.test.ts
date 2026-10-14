import 'fake-indexeddb/auto';
import { useSettings } from './settings-store';
import { useRiders } from './rider-store';
import { useRide } from './ride-store';
import { useSensors } from './sensor-store';
import { newRider } from '../data/riders';
import { listSessions } from '../data/sessions';

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
  it('the saved session keeps the rider selected at begin, even if another is picked mid-ride', async () => {
    const a = newRider({ name: 'Ada', email: 'a@x' });
    const b = newRider({ name: 'Bob', email: 'b@x' });
    await useRiders.getState().save(a); await useRiders.getState().save(b);
    useRiders.getState().select(a.id);
    useSettings.getState().set({ countdownS: 0 });
    useSensors.getState().live.setPaired([]);
    useRide.getState().begin(); vi.advanceTimersByTime(3000);
    useRiders.getState().select(b.id);
    useRide.getState().stop();
    const saved = await useRide.getState().save();
    expect(saved).toMatchObject({ riderId: a.id, riderName: 'Ada' });
  });
  it('stop puts the closed final lap into the lap table rows', () => {
    useSettings.getState().set({ countdownS: 0 });
    useSensors.getState().live.setPaired([]);
    useRide.getState().begin(); vi.advanceTimersByTime(3000);
    expect(useRide.getState().lapRows).toHaveLength(0);
    useRide.getState().stop();
    expect(useRide.getState().lapRows).toHaveLength(1);
    useRide.getState().discard();
  });
  it('discard resets without writing', async () => {
    const before = await listSessions();
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin(); vi.advanceTimersByTime(1000);
    useRide.getState().stop(); useRide.getState().discard();
    expect(useRide.getState().engine).toBeNull();
    expect(await listSessions()).toEqual(before);
  });
  it('stop during the countdown discards: no ghost session, save refuses', async () => {
    const before = await listSessions();
    useSettings.getState().set({ countdownS: 5 });
    useRide.getState().begin(); vi.advanceTimersByTime(2000);
    expect(useRide.getState().countdownLeft).toBe(3);
    useRide.getState().stop();
    expect(useRide.getState().state).toBe('idle');
    expect(useRide.getState().engine).toBeNull();
    expect(useRide.getState().countdownLeft).toBeNull();
    vi.advanceTimersByTime(10000);
    expect(useRide.getState().state).toBe('idle');
    await expect(useRide.getState().save()).rejects.toThrow('no ride');
    expect(await listSessions()).toEqual(before);
  });
  it('save refuses a ride that is not stopped', async () => {
    useSettings.getState().set({ countdownS: 0 });
    useRide.getState().begin(); vi.advanceTimersByTime(2000);
    await expect(useRide.getState().save()).rejects.toThrow('ride not stopped');
    useRide.getState().discard();
  });
});

describe('sensor store reconnectAll', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); useSettings.setState({ devices: {} }); useSensors.setState({ states: { hr: 'unpaired', power: 'unpaired', csc: 'unpaired', trainer: 'unpaired' } }); });
  const remember = (...slots: ('hr' | 'power' | 'csc' | 'trainer')[]) => { for (const slot of slots) useSettings.getState().setDevice(slot, { slot, id: slot, name: slot }); };
  it('skips slots that are already connecting or connected', async () => {
    remember('hr', 'power', 'csc');
    useSensors.setState({ states: { hr: 'connecting', power: 'connected', csc: 'offline', trainer: 'unpaired' } });
    const connect = vi.spyOn(useSensors.getState().adapter, 'connect').mockResolvedValue();
    await useSensors.getState().reconnectAll();
    expect(connect.mock.calls.map(([d]) => d.slot)).toEqual(['csc']);
  });
  it('connects slots in parallel (two 1 s connects take ~1 s, not 2 s)', async () => {
    remember('hr', 'power');
    let done = 0;
    vi.spyOn(useSensors.getState().adapter, 'connect').mockImplementation(() => new Promise<void>((r) => setTimeout(() => { done++; r(); }, 1000)));
    const all = useSensors.getState().reconnectAll();
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(2);
    await all;
  });
  it('can leave out slots that the screen is pairing through the chooser', async () => {
    remember('hr', 'power');
    useSensors.setState({ states: { hr: 'offline', power: 'offline', csc: 'unpaired', trainer: 'unpaired' } });
    const connect = vi.spyOn(useSensors.getState().adapter, 'connect').mockResolvedValue();
    await useSensors.getState().reconnectAll(['hr']);
    expect(connect.mock.calls.map(([d]) => d.slot)).toEqual(['power']);
  });
});

describe('sensor store pair failure', () => {
  afterEach(() => { vi.restoreAllMocks(); useSettings.setState({ devices: {} }); });
  it('a cancelled chooser leaves a remembered slot offline (not unpaired) and a fresh slot unpaired', async () => {
    vi.spyOn(useSensors.getState().adapter, 'pair').mockRejectedValue(new Error('User cancelled'));
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'h', name: 'Strap' });
    await useSensors.getState().pair('hr');
    expect(useSensors.getState().states.hr).toBe('offline');
    await useSensors.getState().pair('power');
    expect(useSensors.getState().states.power).toBe('unpaired');
  });
});

describe('sensor store', () => {
  it('forget clears the slot kinds from the mirrored values', async () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'h', name: 'Strap' });
    useSensors.setState({ values: { hr: 140, power: 200 } });
    await useSensors.getState().forget('hr');
    expect(useSensors.getState().values).toEqual({ power: 200 });
    expect(useSettings.getState().devices.hr).toBeUndefined();
  });
});
