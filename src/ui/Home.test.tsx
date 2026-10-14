import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';
import { useSettings } from '../app/settings-store';
describe('Home', () => {
  it('shows the five vendor tiles and gates on terms', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /terms of service and privacy/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    for (const t of ['TRAINING', 'ACTIVITY LOGS', 'SETTINGS', 'STRUCTURED WORKOUTS', 'SENSORS']) expect(screen.getByRole('link', { name: t })).toBeInTheDocument();
    expect(useSettings.getState().licenseAccepted).toBe(true);
  });

  it('names the terms dialog, focuses Accept and inerts the page behind it until accepted', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    const dialog = screen.getByRole('dialog', { name: /terms of service and privacy/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const accept = screen.getByRole('button', { name: /accept/i });
    expect(accept).toHaveFocus();
    const tile = screen.getByRole('link', { name: 'TRAINING' });
    expect(tile.closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    fireEvent.click(accept);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'TRAINING' }).closest('[inert]')).toBeNull();
  });
});

describe('Home terms dialog (phone parity)', () => {
  it('Decline closes the dialog but keeps the app gated; Review terms reopens it', () => {
    useSettings.getState().set({ licenseAccepted: false });
    render(<MemoryRouter><Home /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useSettings.getState().licenseAccepted).toBe(false);
    expect(screen.getByRole('link', { name: 'TRAINING' }).closest('[inert]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /review terms/i }));
    expect(screen.getByRole('dialog', { name: /terms of service and privacy/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(screen.queryByRole('button', { name: /review terms/i })).not.toBeInTheDocument();
    expect(screen.getByText('improve your performance')).toBeInTheDocument();
  });
});
