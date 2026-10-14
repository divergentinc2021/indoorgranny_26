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
});
