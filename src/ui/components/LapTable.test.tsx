import { render, screen } from '@testing-library/react';
import LapTable from './LapTable';
import { powerZones } from '../../engine/zones';
const rows = [
  { number: 1, startOffsetS: 0, durationS: 60, distanceM: 500, calories: 10, avgPower: 150, avgCad: 85, avgSpeedMs: 8, avgHr: 130, difHrPct: null },
  { number: 2, startOffsetS: 60, durationS: 60, distanceM: 600, calories: 12, avgPower: 260, avgCad: 90, avgSpeedMs: 10, avgHr: 143, difHrPct: 10 },
];
describe('LapTable', () => {
  it('renders the vendor columns newest first with zone colouring and a NOW row', () => {
    render(<LapTable rows={rows} now={{ number: 3, durationS: 5, distanceM: 20, avgPower: 100, avgHr: 120, avgCad: 80, avgSpeedMs: 7 }} zones={powerZones(250)} unit="metric" />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Lap', 'Time', 'Avg Speed', 'Distance', 'Avg Power', 'Avg HR', '%dif HR', 'Avg CAD']);
    const cells = screen.getAllByRole('row').map((r) => r.textContent);
    expect(cells[1]).toContain('now'); expect(cells[2]).toContain('2'); expect(cells[2]).toContain('+10.0%');
    expect(screen.getAllByRole('row')[2].className).toContain('z4'); // 260 W at FTP 250 -> zone index 3 -> z4
  });
});
