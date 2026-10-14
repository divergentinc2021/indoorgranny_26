import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TrainingScreen from './TrainingScreen';
import { useRide } from '../app/ride-store';
import { useSettings } from '../app/settings-store';
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
