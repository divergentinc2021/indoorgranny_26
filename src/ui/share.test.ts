import { shareOrDownload } from './share';
describe('shareOrDownload', () => {
  it('downloads when Web Share with files is unavailable', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    (globalThis.URL as any).createObjectURL = vi.fn(() => 'blob:x'); (globalThis.URL as any).revokeObjectURL = vi.fn();
    expect(await shareOrDownload('a.fit', new Uint8Array([1]), 'application/octet-stream')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});
