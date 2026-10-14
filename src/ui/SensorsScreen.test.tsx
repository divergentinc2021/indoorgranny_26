import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SensorsScreen from './SensorsScreen';
import { useSensors } from '../app/sensor-store';
import { useSettings } from '../app/settings-store';

const idle = { hr: 'unpaired', power: 'unpaired', csc: 'unpaired', trainer: 'unpaired' } as const;

describe('SensorsScreen', () => {
  const pair = vi.fn(async () => {});
  const forget = vi.fn(async () => {});
  beforeEach(() => {
    pair.mockClear(); forget.mockClear();
    useSettings.setState({ devices: {} });
    useSensors.setState({ pair, forget, values: {}, messages: {}, states: { ...idle } });
  });

  it('renders four slots, shows paired name + live value, calls pair/forget', () => {
    useSensors.setState({ values: { hr: 123 }, states: { ...idle, hr: 'connected' } });
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText('Polar H10')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pair power/i })); expect(pair).toHaveBeenCalledWith('power');
    fireEvent.click(screen.getByRole('button', { name: /forget heart rate/i })); expect(forget).toHaveBeenCalledWith('hr');
  });

  it('shows power, speed/cadence and per-slot messages', () => {
    useSensors.setState({ values: { power: 201.6, speed: 10, cadence: 89.6 }, messages: { trainer: 'Trainer dropped' }, states: { ...idle, power: 'connected' } });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText('36.0 km/h · 90 rpm')).toBeInTheDocument();
    expect(screen.getAllByText('202 W').length).toBeGreaterThan(0);
    expect(screen.getByText('Trainer dropped')).toBeInTheDocument();
  });

  it('asks before re-pairing an occupied slot, because pair() forgets the old device first', () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pair heart rate/i }));
    expect(pair).not.toHaveBeenCalled();
    expect(screen.getByText(/forgets Polar H10 first/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(pair).toHaveBeenCalledWith('hr');
    expect(screen.queryByText(/forgets Polar H10 first/i)).not.toBeInTheDocument();
  });

  it('cancelling the re-pair confirm does not call pair', () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pair heart rate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(pair).not.toHaveBeenCalled();
    expect(screen.queryByText(/forgets Polar H10 first/i)).not.toBeInTheDocument();
  });

  it('warns when Web Bluetooth is unavailable', () => {
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText(/web bluetooth is not available/i)).toBeInTheDocument();
  });
});
