import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Shell from './Shell';

describe('Shell headers', () => {
  it('no header carries conflicting horizontal padding utilities (px-2 and px-4 together)', () => {
    const { container } = render(<MemoryRouter><Shell title="Training" bar={<span>bar</span>}>x</Shell></MemoryRouter>);
    const plain = render(<MemoryRouter><Shell title="Settings">x</Shell></MemoryRouter>);
    for (const h of [...container.querySelectorAll('header'), ...plain.container.querySelectorAll('header')]) {
      expect(h.classList.contains('px-2') && h.classList.contains('px-4')).toBe(false);
    }
  });
  it('the Training bar keeps px-2 and the default bar px-4', () => {
    const { container } = render(<MemoryRouter><Shell title="Training" bar={<span>bar</span>}>x</Shell></MemoryRouter>);
    expect(container.querySelector('header.px-2')).not.toBeNull();
    const plain = render(<MemoryRouter><Shell title="Settings">x</Shell></MemoryRouter>);
    expect(plain.container.querySelector('header.px-4')).not.toBeNull();
  });
});
