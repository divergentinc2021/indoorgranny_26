import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LogsScreen from './LogsScreen';
import { saveSession, listSessions } from '../data/sessions';
import { shareOrDownload } from './share';
vi.mock('./share', () => ({ shareOrDownload: vi.fn() }));
const rec = { id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling' as const, startMs: 1760000000000, durationS: 3600, distanceM: 25000, calories: 600, nSamples: 3600, avgPower: 150, maxPower: 300, avgHr: 140, maxHr: 170, avgCad: 85, uploaded: null, synced: false };
describe('LogsScreen', () => {
  it('lists sessions with vendor row fields and deletes one', async () => {
    await saveSession({ id: 1760000000000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000000000, durationS: 3600, distanceM: 25000, calories: 600, nSamples: 3600, avgPower: 150, maxPower: 300, avgHr: 140, maxHr: 170, avgCad: 85, uploaded: null, synced: false }, [], []);
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    expect(await screen.findByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('1:00:00')).toBeInTheDocument();
    expect(screen.getByText('25.00 km')).toBeInTheDocument();
    expect(screen.getByText(/600 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(async () => expect(await listSessions()).toHaveLength(0));
  });
  it('shows an alert when sharing fails', async () => {
    await saveSession(rec, [], []);
    vi.mocked(shareOrDownload).mockRejectedValueOnce(new Error('boom'));
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    await screen.findByText('Ann');
    fireEvent.click(screen.getByRole('button', { name: /download fit/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not share: boom');
  });
  it('shows Download FIT on the row without opening Actions, with a plain notice after a download', async () => {
    await saveSession(rec, [], []);
    vi.mocked(shareOrDownload).mockResolvedValueOnce('downloaded');
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    await screen.findByText('Ann');
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /download fit/i }));
    expect(await screen.findByText(/^Saved to Downloads as GrannyGear_.*\.fit\. Open it from Wahoo, Garmin Connect or strava\.com\/upload\.$/)).toBeInTheDocument();
    expect(vi.mocked(shareOrDownload).mock.calls.at(-1)![0]).toMatch(/^GrannyGear_.*_Ann\.fit$/);
  });
  it('shows no notice when the file went through the share sheet', async () => {
    await saveSession(rec, [], []);
    vi.mocked(shareOrDownload).mockResolvedValueOnce('shared');
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    await screen.findByText('Ann');
    fireEvent.click(screen.getByRole('button', { name: /download fit/i }));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText(/Saved to Downloads/)).toBeNull();
  });
  it('the notice disappears after 6 seconds', async () => {
    await saveSession(rec, [], []);
    vi.mocked(shareOrDownload).mockResolvedValueOnce('downloaded');
    render(<MemoryRouter><LogsScreen /></MemoryRouter>);
    await screen.findByText('Ann');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    try {
      fireEvent.click(screen.getByRole('button', { name: /download fit/i }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(await screen.findByText(/Saved to Downloads/)).toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
      expect(screen.queryByText(/Saved to Downloads/)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
