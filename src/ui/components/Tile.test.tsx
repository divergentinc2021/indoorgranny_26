import { render, screen } from '@testing-library/react';
import Tile from './Tile';

// Phone type scale (412 px screenshots): strip values 28, captions 17; compact bottom row 16 / 20. Tablet (tab:) values unchanged.
describe('Tile phone type scale', () => {
  it('main tile: 17 px caption, 28 px value, tablet sizes kept', () => {
    render(<Tile label="Power" value={123} />);
    expect(screen.getByText('Power')).toHaveClass('text-[17px]', 'tab:text-[25px]');
    expect(screen.getByText('123')).toHaveClass('text-[28px]', 'tab:text-[45px]', 'bg-gg-strip', 'text-white');
  });
  it('bare (elapsed) tile: 28 px value', () => {
    render(<Tile size="bare" label="Elapsed" value="00:00:00" />);
    expect(screen.getByText('00:00:00')).toHaveClass('text-[28px]', 'tab:text-[45px]');
  });
  it('compact tile: 16 px caption, 20 px value', () => {
    render(<Tile size="compact" label="KJ" value={5} />);
    expect(screen.getByText('KJ')).toHaveClass('text-[16px]');
    expect(screen.getByText('5')).toHaveClass('text-[20px]');
  });
  it('a strip class replaces the default cyan strip', () => {
    render(<Tile label="x" value={9} strip="bg-hr-z5 text-black" />);
    expect(screen.getByText('9')).toHaveClass('bg-hr-z5', 'text-black');
    expect(screen.getByText('9')).not.toHaveClass('bg-gg-strip');
  });
});
