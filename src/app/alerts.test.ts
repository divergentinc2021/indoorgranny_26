// The module keeps one AudioContext, so each test loads a fresh copy of it.
const load = async () => { vi.resetModules(); return import('./alerts'); };

const osc = () => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
const gain = () => ({ gain: { value: 0 }, connect: vi.fn() });
const ctxStub = () => { const o = osc(); const g = gain(); const ctx = { state: 'running', currentTime: 0, destination: {}, resume: vi.fn(), createOscillator: vi.fn(() => o), createGain: vi.fn(() => g) }; return { ctx, o, g }; };

describe('class alerts', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('vibrate calls navigator.vibrate(200) and creates no oscillator', async () => {
    const { ctx } = ctxStub(); vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    const vib = vi.fn(); vi.stubGlobal('navigator', { vibrate: vib });
    const { classAlert, prepareAudio } = await load();
    prepareAudio(); classAlert('vibrate');
    expect(vib).toHaveBeenCalledWith(200); expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
  it('beep plays a 880 Hz sine for 150 ms and does not vibrate', async () => {
    const { ctx, o, g } = ctxStub(); vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    const vib = vi.fn(); vi.stubGlobal('navigator', { vibrate: vib });
    const { classAlert, prepareAudio } = await load();
    prepareAudio(); classAlert('beep');
    expect(vib).not.toHaveBeenCalled();
    expect(o.type).toBe('sine'); expect(o.frequency.value).toBe(880); expect(g.gain.value).toBe(0.2);
    expect(o.start).toHaveBeenCalled(); expect(o.stop).toHaveBeenCalledWith(0.15);
  });
  it("'both' vibrates and beeps; 'off' does nothing", async () => {
    const { ctx } = ctxStub(); vi.stubGlobal('AudioContext', vi.fn(() => ctx));
    const vib = vi.fn(); vi.stubGlobal('navigator', { vibrate: vib });
    const { classAlert, prepareAudio } = await load();
    prepareAudio(); classAlert('both');
    expect(vib).toHaveBeenCalledWith(200); expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    classAlert('off');
    expect(vib).toHaveBeenCalledTimes(1); expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });
  it('never throws when AudioContext and vibrate are missing', async () => {
    vi.stubGlobal('AudioContext', undefined); vi.stubGlobal('navigator', {});
    const { classAlert, prepareAudio } = await load();
    expect(() => { prepareAudio(); classAlert('both'); classAlert('vibrate'); classAlert('beep'); }).not.toThrow();
  });
  it('never throws when the audio graph or vibrate throws', async () => {
    vi.stubGlobal('AudioContext', vi.fn(() => ({ state: 'running', createOscillator: () => { throw new Error('nope'); }, resume: vi.fn() })));
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('nope'); } });
    const { classAlert, prepareAudio } = await load();
    expect(() => { prepareAudio(); classAlert('both'); }).not.toThrow();
  });
});
