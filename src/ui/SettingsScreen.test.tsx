import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsScreen from './SettingsScreen';
import { useSettings } from '../app/settings-store';
describe('SettingsScreen', () => {
  it('exposes the vendor keys and writes them to the store', () => {
    render(<MemoryRouter><SettingsScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/unit system/i), { target: { value: 'imperial' } });
    fireEvent.change(screen.getByLabelText(/countdown/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/smoothing/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/wheel/i), { target: { value: '2096' } });
    fireEvent.click(screen.getByLabelText(/structured workout/i));
    expect(useSettings.getState()).toMatchObject({ unitSystem: 'imperial', countdownS: 5, smoothingN: 10, wheelMm: 2096, structuredWorkoutEnabled: true });
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });
});
