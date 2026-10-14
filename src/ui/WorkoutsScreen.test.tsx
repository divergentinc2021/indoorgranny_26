import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutsScreen from './WorkoutsScreen';
import { useWorkouts } from '../app/workout-store';
const wk = { id: 'w1', title: 'Sweet spot', type: 'PWR', wdate: '2026-10-14', totalduration: 1200, timeS: [600, 600], pwrS: [88, 94], cadS: [90, 90], hrS: [0, 0] };
describe('WorkoutsScreen', () => {
  beforeEach(() => {
    useWorkouts.setState({ workouts: [], selectedId: null });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
  });
  afterEach(() => vi.unstubAllGlobals());
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
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const file = (text: string) => ({ text: async () => text }) as unknown as File;
    fireEvent.change(input, { target: { files: [file(JSON.stringify(wk))] } });
    expect(await screen.findByText('Workout imported')).toBeInTheDocument();
    expect(useWorkouts.getState().workouts).toHaveLength(1);
    fireEvent.change(input, { target: { files: [file('{nope')] } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Not a valid workout file'));
  });
});
