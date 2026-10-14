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

  it('shows power, speed/cadence and per-slot messages for paired, connected slots', () => {
    useSettings.getState().setDevice('power', { slot: 'power', id: 'p', name: 'Stages' });
    useSettings.getState().setDevice('csc', { slot: 'csc', id: 'c', name: 'Wahoo RPM' });
    useSensors.setState({ values: { power: 201.6, speed: 10, cadence: 89.6 }, messages: { trainer: 'Trainer dropped' }, states: { ...idle, power: 'connected', csc: 'connected' } });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText('36.0 km/h · 90 rpm')).toBeInTheDocument();
    expect(screen.getByText('202 W')).toBeInTheDocument();
    expect(screen.getByText('Trainer dropped')).toBeInTheDocument();
  });

  it('does not show another slot value on an unpaired slot', () => {
    useSettings.getState().setDevice('power', { slot: 'power', id: 'p', name: 'Stages' });
    useSensors.setState({ values: { power: 202, cadence: 90, speed: 10, hr: 140 }, states: { ...idle, power: 'connected' } });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getAllByText('202 W')).toHaveLength(1);
    expect(screen.queryByText('140')).not.toBeInTheDocument();
    expect(screen.getByText('— · —')).toBeInTheDocument();
  });

  it('shows no value for a paired slot that is not connected', () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    useSensors.setState({ values: { hr: 123 }, states: { ...idle, hr: 'connecting' } });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.queryByText('123')).not.toBeInTheDocument();
  });

  it('asks before re-pairing an occupied slot, because pair() forgets the old device first', () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pair heart rate/i }));
    expect(pair).not.toHaveBeenCalled();
    expect(screen.getByText(/disconnects Polar H10 first/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(pair).toHaveBeenCalledWith('hr');
    expect(screen.queryByText(/disconnects Polar H10 first/i)).not.toBeInTheDocument();
  });

  it('cancelling the re-pair confirm does not call pair', () => {
    useSettings.getState().setDevice('hr', { slot: 'hr', id: 'x', name: 'Polar H10' });
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /pair heart rate/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(pair).not.toHaveBeenCalled();
    expect(screen.queryByText(/disconnects Polar H10 first/i)).not.toBeInTheDocument();
  });

  it('warns when Web Bluetooth is unavailable', () => {
    render(<MemoryRouter><SensorsScreen /></MemoryRouter>);
    expect(screen.getByText(/web bluetooth is not available/i)).toBeInTheDocument();
  });
});
