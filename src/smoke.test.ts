describe('toolchain', () => {
  it('runs vitest with jsdom and fake-indexeddb', () => {
    expect(typeof indexedDB).toBe('object');
    expect(document.createElement('div')).toBeTruthy();
  });
});
