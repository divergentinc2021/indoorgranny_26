import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionDetail from './SessionDetail';
import { saveSession } from '../data/sessions';
const at = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/logs/:id" element={<SessionDetail />} /></Routes></MemoryRouter>);
describe('SessionDetail', () => {
  beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); }); // jsdom has no canvas
  afterEach(() => vi.restoreAllMocks());
  it('shows the summary and lap rows but no NOW row for a finished session', async () => {
    await saveSession({ id: 1760000100000, riderId: 'r', riderName: 'Ann', sport: 'indoor_cycling', startMs: 1760000100000, durationS: 120, distanceM: 1000, calories: 20, nSamples: 0, avgPower: 150, maxPower: 300, avgHr: 140, maxHr: 170, avgCad: 85, uploaded: null, synced: false },
      [{ number: 1, startOffsetS: 0, durationS: 120, distanceM: 1000, calories: 20, avgPower: 150, avgCad: 85, avgSpeedMs: 8, avgHr: 140, maxPower: 200, maxHr: 150, difHrPct: null }], []);
    at('/logs/1760000100000');
    expect(await screen.findByText(/Ann · 0:02:00 · avg 150 W · avg 140 bpm · 20 kcal/)).toBeInTheDocument();
    const rows = screen.getAllByRole('row').map((r) => r.textContent);
    expect(rows).toHaveLength(2); // header + the one lap
    expect(rows[1]).toContain('1');
    expect(screen.queryByText('NOW')).not.toBeInTheDocument();
  });
  it('shows Session not found for a bad id', async () => {
    at('/logs/abc');
    expect(await screen.findByText('Session not found')).toBeInTheDocument();
  });
  it('shows Session not found for an unknown id', async () => {
    at('/logs/42');
    expect(await screen.findByText('Session not found')).toBeInTheDocument();
  });
});
