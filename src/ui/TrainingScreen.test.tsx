import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrainingScreen from './TrainingScreen';
import { useRide } from '../app/ride-store';
import { useSettings } from '../app/settings-store';
import * as sessionsModule from '../data/sessions';
import { RideEngine } from '../engine/ride';
import { useClassPlans } from '../app/classplan-store';
import { isoDay, type ClassPlan } from '../engine/classplan';
vi.mock('../app/alerts', () => ({ classAlert: vi.fn(), prepareAudio: vi.fn() }));
describe('TrainingScreen', () => {
  // jsdom has no canvas: report "no 2D context" quietly so RollingChart skips Chart.js without stderr noise.
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('Start → tiles live → Lap → Stop → confirm → Save prompt', async () => {
    useSettings.getState().set({ countdownS: 0 });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(useRide.getState().state).toBe('recording');
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^lap$/i }));
    expect(useRide.getState().lapRows).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/STOP this session\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /yes, stop/i }));
    expect(screen.getByText(/save it\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(useRide.getState().engine).toBeNull();
  });
  it('the NOW row is gone once the ride is stopped', () => {
    useSettings.getState().set({ countdownS: 0 });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('now')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, stop/i }));
    expect(useRide.getState().state).toBe('stopped');
    expect(screen.queryByText('now')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
  });
  it('tapping the countdown starts the ride now without changing the countdown setting', () => {
    useSettings.getState().set({ countdownS: 5 });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    expect(useRide.getState().countdownLeft).toBe(5);
    fireEvent.click(screen.getByText(/tap to start now/i));
    expect(useRide.getState().state).toBe('recording');
    expect(useRide.getState().countdownLeft).toBeNull();
    expect(useSettings.getState().countdownS).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, stop/i }));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
  });
  it('leaving the screen during the countdown cancels the ride', () => {
    useSettings.getState().set({ countdownS: 5 });
    const { unmount } = render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    expect(useRide.getState().countdownLeft).toBe(5);
    unmount();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(useRide.getState().state).toBe('idle');
    expect(useRide.getState().engine).toBeNull();
    expect(useRide.getState().countdownLeft).toBeNull();
  });
  it('shows the store storage error verbatim in an alert, cleared with it', () => {
    useRide.setState({ storageError: 'Could not save history — your ride is still on screen' });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    expect(screen.getByRole('alert').textContent).toBe('Could not save history — your ride is still on screen');
    act(() => { useRide.setState({ storageError: null }); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('a failed save keeps the dialog open with an alert and a Retry that can succeed', async () => {
    useSettings.getState().set({ countdownS: 0 });
    const spy = vi.spyOn(sessionsModule, 'saveSession').mockRejectedValue(new Error('disk full'));
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, stop/i }));
    spy.mockClear();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^save$/i })); });
    expect(screen.getByText(/save it\?/i)).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toBe('Could not save — your ride is still on screen, tap Save again');
    expect(useRide.getState().state).toBe('stopped');
    spy.mockResolvedValue(undefined);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^retry$/i })); });
    expect(screen.queryByText(/save it\?/i)).not.toBeInTheDocument();
    expect(useRide.getState().state).toBe('idle');
  });
  it('tints the %HR max strips by HR band (90 % -> z5 colour); the power strip stays cyan', () => {
    const e = new RideEngine({ rider: { weightKg: 70, ftpW: 250, wprimeKj: 20, hrMax: 180 }, smoothingN: 1 });
    e.start(); e.tick({ hr: 162, power: 0, cadence: 0, speedMs: 0 });
    act(() => { useRide.setState({ view: e.view }); });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    const strips = screen.getAllByText('90');
    expect(strips).toHaveLength(2);                                   // phone bottom row + tablet row
    for (const s of strips) expect(s).toHaveClass('bg-hr-z5');
    expect(screen.getByText('Power').nextElementSibling).toHaveClass('bg-gg-strip');
    act(() => { useRide.setState({ view: null }); });
  });
  it('renders the AVG/MAX and lap sub-lines with a real middle dot (not U+FFFD)', () => {
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    // The sub-lines are display:none below 600 px but always in the DOM.
    expect(screen.getAllByText('avg 0 · max 0')).toHaveLength(3);
    expect(document.body.textContent).not.toContain('�');
  });
  it('phone layout (412 px): charts hidden, grey START in a navy band, cyan lap area, bar with SIGN OUT', () => {
    const was = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
    try {
      render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
      // jsdom does not apply the stylesheet, so assert the classes that produce the computed styles.
      expect(screen.getByTestId('charts')).toHaveClass('hidden', 'tab:block');
      const start = screen.getByRole('button', { name: /^start$/i });
      expect(start).toHaveClass('bg-gg-btn', 'text-black', 'font-bold', 'uppercase');
      expect(start.closest('div.bg-gg-bg')).not.toBeNull();
      const lapArea = screen.getByRole('table').parentElement!;
      expect(lapArea).toHaveClass('flex-1', 'min-h-0', 'bg-gg-strip');
      expect(screen.getByText('now')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'SIGN OUT' })).toHaveAttribute('href', '/rider');
      // Phone bottom row carries Wbal; the tablet-only tiles (%FTP, Speed) sit in hidden/tab:grid containers.
      expect(screen.getByText(/Wbal/)).toBeInTheDocument();
      expect(screen.getByText('%FTP').closest('div.hidden')).not.toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: was });
    }
  });
});
describe('TrainingScreen class mode', () => {
  const iv = (name: string, displayName: string, durationS: number, zone: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 2) => ({ name, displayName, durationS, zone });
  const PLAN: ClassPlan = { id: 'ui-p1', title: 'Endurance Ride 17 October 2026', dates: [], source: 'seconds', intervals: [iv('Endurance 80+ 5:00', 'Endurance', 300), iv('Sprint 1:00', 'Sprint', 60, 7)], totalS: 360 };
  const SHORT: ClassPlan = { id: 'ui-p2', title: 'Short', dates: [], source: 'seconds', intervals: [iv('Endurance 0:10', 'Endurance', 10)], totalS: 10 };
  const adv = (s: number) => act(() => { vi.advanceTimersByTime(s * 1000); });
  const btn = (n: RegExp | string) => screen.getByRole('button', { name: n });
  const open = (plan: ClassPlan) => { useClassPlans.setState({ plans: [PLAN, SHORT], selectedId: plan.id, autoPickedOn: null }); render(<MemoryRouter><TrainingScreen /></MemoryRouter>); };
  const warmUp = () => { fireEvent.click(btn(/^start$/i)); fireEvent.click(btn(/^warm up$/i)); adv(2); };
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); useSettings.getState().set({ countdownS: 0 }); });
  afterEach(() => { useRide.getState().discard(); useClassPlans.setState({ plans: [], selectedId: null, autoPickedOn: null }); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('START with a selected plan opens the dialog; Cancel closes it with no ride; START with no plan starts at once', () => {
    open(PLAN);
    fireEvent.click(btn(/^start$/i));
    const dlg = screen.getByRole('dialog');
    expect(dlg).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(PLAN.title)).toBeInTheDocument();
    expect(btn(/^warm up$/i)).toBeInTheDocument();
    expect(btn(/^start class$/i)).toHaveFocus();
    fireEvent.click(screen.getByText(/^cancel$/i));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useRide.getState().state).toBe('idle');
    useClassPlans.setState({ selectedId: null });
    fireEvent.click(btn(/^start$/i));
    expect(screen.queryByRole('dialog')).toBeNull();
    adv(2);
    expect(useRide.getState().state).toBe('recording');
  });
  it('WARM UP records without LAP; START CLASS then shows the interval bar', () => {
    open(PLAN); warmUp();
    expect(useRide.getState().state).toBe('recording'); expect(useRide.getState().classPhase).toBe('warmup');
    expect(btn(/^pause$/i)).toBeInTheDocument(); expect(btn(/^stop$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^lap$/i })).toBeNull();
    fireEvent.click(btn(/^start class$/i));
    expect(useRide.getState().classPhase).toBe('class');
    expect(screen.queryByRole('button', { name: /^start class$/i })).toBeNull();
    adv(1);
    const bar = screen.getByRole('button', { name: 'Next interval' });
    expect(bar).toHaveTextContent('Endurance'); expect(bar).toHaveTextContent('4:59');
  });
  it('the dialog START CLASS begins class mode directly', () => {
    open(PLAN);
    fireEvent.click(btn(/^start$/i)); fireEvent.click(btn(/^start class$/i)); adv(2);
    expect(useRide.getState().classPhase).toBe('class');
    expect(screen.getByRole('button', { name: 'Next interval' })).toBeInTheDocument();
  });
  it('tapping the countdown keeps the chosen class mode', () => {
    useSettings.getState().set({ countdownS: 5 });
    open(PLAN);
    fireEvent.click(btn(/^start$/i)); fireEvent.click(btn(/^start class$/i));
    expect(useRide.getState().countdownLeft).toBe(5); expect(screen.queryByRole('button', { name: 'Next interval' })).toBeNull();
    fireEvent.click(screen.getByText(/tap to start now/i));
    expect(useRide.getState().state).toBe('recording'); expect(useRide.getState().classPhase).toBe('class');
  });
  it('bar uses the zone colour and the lighter fill grows with the interval (50% at half time)', () => {
    open(PLAN); warmUp(); fireEvent.click(btn(/^start class$/i)); adv(150);
    const bar = screen.getByRole('button', { name: 'Next interval' });
    expect(bar).toHaveClass('bg-zone-z2', 'overflow-hidden', 'text-black');
    const fill = screen.getByTestId('class-fill');
    expect(fill).toHaveClass('bg-zonefill-z2'); expect(fill).toHaveStyle({ width: '50%' });
  });
  it('PAUSE/STOP take a quarter each and the bar half; LAP returns 5 s after done', () => {
    open(SHORT); fireEvent.click(btn(/^start$/i)); fireEvent.click(btn(/^start class$/i)); adv(2);
    expect(btn(/^pause$/i)).toHaveClass('col-span-1'); expect(btn(/^stop$/i)).toHaveClass('col-span-1');
    expect(screen.getByRole('button', { name: 'Next interval' })).toHaveClass('col-span-2');
    expect(btn(/^pause$/i).parentElement).toHaveClass('grid-cols-4');
    adv(9);
    const done = screen.getByText('Class done — free ride');
    expect(done).toHaveAttribute('role', 'status'); expect(done).not.toHaveAttribute('tabindex'); expect(done).not.toHaveAttribute('aria-label'); expect(done).toHaveClass('bg-zone-z1');
    expect(screen.queryByRole('button', { name: 'Next interval' })).toBeNull();
    expect(screen.queryByTestId('class-fill')).toBeNull();
    const laps = useRide.getState().lapRows.length;
    fireEvent.click(done); expect(useRide.getState().lapRows).toHaveLength(laps);
    adv(5);
    expect(screen.queryByRole('button', { name: 'Next interval' })).toBeNull();
    expect(btn(/^lap$/i).parentElement).toHaveClass('grid-cols-3');
  });
  it('class-row phone buttons are 20 px: no 28 px base class (Tailwind emits 20px before 28px, so order cannot win)', () => {
    open(PLAN); warmUp();
    for (const b of [btn(/^pause$/i), btn(/^stop$/i), btn(/^start class$/i)]) { expect(b).toHaveClass('text-[20px]', 'tab:text-[38px]'); expect(b).not.toHaveClass('text-[28px]'); }
    fireEvent.click(btn(/^start class$/i)); adv(1);
    expect(btn(/^pause$/i)).not.toHaveClass('text-[28px]');
    expect(screen.getByRole('button', { name: 'Next interval' }).firstElementChild!.nextElementSibling).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center', 'h-full');
  });
  it('two rapid clicks on the bar right after START CLASS close no lap (tap guard)', () => {
    open(PLAN); warmUp(); fireEvent.click(btn(/^start class$/i)); adv(1);
    const bar = screen.getByRole('button', { name: 'Next interval' });
    fireEvent.click(bar); fireEvent.click(bar);
    expect(useRide.getState().lapRows).toHaveLength(1);   // only the Warm up lap from START CLASS
    expect(screen.getByRole('button', { name: 'Next interval' })).toHaveTextContent('Endurance');
  });
  it('tapping the bar closes a lap (skips the interval)', () => {
    open(PLAN); warmUp(); fireEvent.click(btn(/^start class$/i)); adv(5);
    const n = useRide.getState().lapRows.length;
    fireEvent.click(screen.getByRole('button', { name: 'Next interval' }));
    expect(useRide.getState().lapRows).toHaveLength(n + 1);
    expect(screen.getByRole('button', { name: 'Next interval' })).toHaveTextContent('Sprint');
  });
  it('STOP during class confirms, drops the bar and shows Save or discard', () => {
    open(PLAN); warmUp(); fireEvent.click(btn(/^start class$/i)); adv(2);
    fireEvent.click(btn(/^stop$/i)); expect(screen.getByText(/STOP this session\?/)).toBeInTheDocument();
    fireEvent.click(btn(/yes, stop/i));
    expect(screen.queryByRole('button', { name: 'Next interval' })).toBeNull();
    expect(screen.getByText(/save it\?/i)).toBeInTheDocument(); expect(useRide.getState().state).toBe('stopped');
    fireEvent.click(btn(/discard/i));
  });
  it('paused during warm up: no START CLASS button', () => {
    open(PLAN); warmUp(); fireEvent.click(btn(/^pause$/i));
    expect(useRide.getState().state).toBe('paused');
    expect(screen.queryByRole('button', { name: /^start class$/i })).toBeNull();
    expect(btn(/^restart$/i)).toBeInTheDocument();
  });
  it('on mount picks the plan dated today when none is selected', () => {
    const today = isoDay(new Date());
    useClassPlans.setState({ plans: [{ ...PLAN, id: 'ui-today', dates: [today] }], selectedId: null, autoPickedOn: null });
    render(<MemoryRouter><TrainingScreen /></MemoryRouter>);
    expect(useClassPlans.getState().selectedId).toBe('ui-today');
  });
});
