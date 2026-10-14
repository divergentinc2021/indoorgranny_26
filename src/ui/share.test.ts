import { shareOrDownload } from './share';
const urlApi = URL as unknown as Record<string, unknown>;
const orig = { create: urlApi.createObjectURL, revoke: urlApi.revokeObjectURL };
const nav = navigator as unknown as Record<string, unknown>;
afterEach(() => {
  urlApi.createObjectURL = orig.create; urlApi.revokeObjectURL = orig.revoke;
  delete nav.canShare; delete nav.share;
  vi.useRealTimers(); vi.restoreAllMocks();
});
describe('shareOrDownload', () => {
  it('downloads when Web Share with files is unavailable', async () => {
    vi.useFakeTimers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    urlApi.createObjectURL = vi.fn(() => 'blob:x'); const revoke = urlApi.revokeObjectURL = vi.fn();
    expect(await shareOrDownload('a.fit', new Uint8Array([1]), 'application/octet-stream')).toBe('downloaded');
    expect(click).toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled(); // revoke is deferred so the browser can start the download
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
  it('returns cancelled, without downloading, when the share sheet is dismissed', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    nav.canShare = () => true; nav.share = vi.fn(async () => { throw new DOMException('x', 'AbortError'); });
    expect(await shareOrDownload('a.fit', new Uint8Array([1]), 'application/octet-stream')).toBe('cancelled');
    expect(click).not.toHaveBeenCalled();
  });
  it('returns shared when the share succeeds', async () => {
    nav.canShare = () => true; nav.share = vi.fn(async () => {});
    expect(await shareOrDownload('a.fit', new Uint8Array([1]), 'application/octet-stream')).toBe('shared');
  });
});
