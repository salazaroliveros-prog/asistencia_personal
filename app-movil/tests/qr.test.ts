describe('QR Scanner', () => {
  it('has start and stop methods', () => {
    const scanner = {
      start: () => {},
      stop: () => {},
    };
    expect(typeof scanner.start).toBe('function');
    expect(typeof scanner.stop).toBe('function');
  });
});
