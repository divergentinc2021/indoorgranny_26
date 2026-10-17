import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutsScreen from './WorkoutsScreen';
import { useWorkouts } from '../app/workout-store';
import { useClassPlans } from '../app/classplan-store';
import { parseSecondsFile } from '../engine/classplan';
import { fmtDuration } from '../app/format';
const raw = readFileSync('src/engine/__fixtures__/timers.seconds', 'utf8');
const fixture = () => parseSecondsFile(JSON.parse(raw), 'seconds');
const wk = { id: 'w1', title: 'Sweet spot', type: 'PWR', wdate: '2026-10-14', totalduration: 1200, timeS: [600, 600], pwrS: [88, 94], cadS: [90, 90], hrS: [0, 0] };
describe('WorkoutsScreen', () => {
  beforeEach(() => {
    useWorkouts.setState({ workouts: [], selectedId: null });
    useClassPlans.setState({ plans: [], selectedId: null, autoPickedOn: null });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it('lists, selects and removes workouts', async () => {
    useWorkouts.getState().add(wk);
    render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
    fireEvent.click(await screen.findByText('Sweet spot'));
    expect(useWorkouts.getState().selectedId).toBe('w1');
    expect(await screen.findByRole('status')).toHaveTextContent('Sweet spot selected');
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(useWorkouts.getState().workouts).toHaveLength(0);
  });
  it('imports a valid JSON file and rejects an invalid one', async () => {
    const { container } = render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
    const input = container.querySelector('input[accept="application/json"]') as HTMLInputElement;
    const file = (text: string) => ({ text: async () => text }) as unknown as File;
    fireEvent.change(input, { target: { files: [file(JSON.stringify(wk))] } });
    expect(await screen.findByText('Workout imported')).toBeInTheDocument();
    expect(useWorkouts.getState().workouts).toHaveLength(1);
    fireEvent.change(input, { target: { files: [file('{nope')] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not a valid workout file'));
  });
  describe('Class plans', () => {
    const file = (text: string) => ({ text: async () => text }) as unknown as File;
    const seconds = (c: HTMLElement) => c.querySelector('input[accept=".seconds,.json"]') as HTMLInputElement;
    it('has a Class plans heading above Structured workouts', () => {
      render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const a = screen.getByRole('heading', { name: 'Class plans' }); const b = screen.getByRole('heading', { name: 'Structured workouts', level: 2 });
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it('shows title, duration, interval count and a today badge only for a plan dated today', () => {
      vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 19, 9, 0, 0));
      const ps = fixture(); useClassPlans.getState().add(ps);
      render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const s1 = ps.find((p) => p.title.startsWith('Session 1 '))!;
      const row = screen.getByText(s1.title).closest('li') as HTMLElement;
      expect(row).toHaveTextContent(`${fmtDuration(s1.totalS)} · ${s1.intervals.length} intervals`);
      expect(row).toHaveTextContent('today');
      expect(screen.getAllByText('today')).toHaveLength(1);
    });
    it('selects a plan on click and offers Remove only for non-bundled plans', () => {
      const ps = fixture(); useClassPlans.getState().add(ps.slice(0, 1).map((p) => ({ ...p, source: 'bundled' as const }))); useClassPlans.getState().add(ps.slice(1, 2));
      render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      fireEvent.click(screen.getByText(ps[1].title));
      expect(useClassPlans.getState().selectedId).toBe(ps[1].id);
      expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: /remove/i }));
      expect(useClassPlans.getState().plans).toHaveLength(1);
    });
    it('the today badge is a cyan pill on an unselected row and dark-on-cyan (bg-gg-bg text-white) on the selected row', () => {
      vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 19, 9, 0, 0));
      const ps = fixture(); useClassPlans.getState().add(ps);
      const { rerender } = render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const badge = () => screen.getByText('today');
      expect(badge()).toHaveClass('bg-gg-strip', 'text-white'); expect(badge()).not.toHaveClass('bg-gg-bg');
      act(() => { useClassPlans.getState().select(ps[0].id); });
      rerender(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      expect(badge()).toHaveClass('bg-gg-bg', 'text-white'); expect(badge()).not.toHaveClass('bg-gg-strip');
    });
    it('tapping the selected plan deselects it, says so, and the auto-pick does not re-select it that day', () => {
      vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 19, 9, 0, 0));
      const ps = fixture(); useClassPlans.getState().add(ps); useClassPlans.getState().select(ps[0].id);
      render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const row = () => screen.getByText(ps[0].title).closest('li') as HTMLElement;
      expect(row()).toHaveClass('bg-gg-strip');
      fireEvent.click(screen.getByText(ps[0].title));
      expect(useClassPlans.getState().selectedId).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('No class plan selected — START runs a normal ride');
      expect(row()).not.toHaveClass('bg-gg-strip');
      useClassPlans.getState().autoPickToday();
      expect(useClassPlans.getState().selectedId).toBeNull();
    });
    it('Import .seconds opens a file input accepting .seconds,.json', () => {
      const { container } = render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const click = vi.spyOn(seconds(container), 'click');
      fireEvent.click(screen.getByRole('button', { name: 'Import .seconds' }));
      expect(click).toHaveBeenCalled();
    });
    it('rejects a bad file, imports a good one, then reports already imported', async () => {
      const { container } = render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      const input = seconds(container);
      fireEvent.change(input, { target: { files: [file('not json')] } });
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not a Seconds file'));
      fireEvent.change(input, { target: { files: [file(raw)] } });
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Added 4 plans'));
      expect(useClassPlans.getState().plans).toHaveLength(4);
      fireEvent.change(input, { target: { files: [file(raw)] } });
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Already imported'));
    });
    it('loads bundled plans on mount', async () => {
      vi.stubGlobal('fetch', vi.fn(async (u: string) => ({ json: async () => (u.endsWith('index.json') ? ['x.seconds'] : JSON.parse(raw)) })));
      render(<MemoryRouter><WorkoutsScreen /></MemoryRouter>);
      await waitFor(() => expect(useClassPlans.getState().plans).toHaveLength(4));
    });
  });
});
