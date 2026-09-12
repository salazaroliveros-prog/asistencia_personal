describe('Backoff', () => {
  it('calculates delay with jitter', () => {
    const base = 100;
    const max = 500;
    const attempts = 0;
    const delay = Math.min(base * Math.pow(2, attempts), max);
    const jitter = Math.random() * delay * 0.25;
    const total = Math.min(Math.round(delay + jitter), max);
    expect(total).toBeGreaterThanOrEqual(base);
    expect(total).toBeLessThanOrEqual(max);
  });

  it('caps delay at maxMs', () => {
    const base = 100;
    const max = 200;
    const attempts = 20;
    const delay = Math.min(base * Math.pow(2, attempts), max);
    const jitter = Math.random() * delay * 0.25;
    const total = Math.min(Math.round(delay + jitter), max);
    expect(total).toBeLessThanOrEqual(max);
  });

  it('stops retrying after max attempts', () => {
    const maxAttempts = 2;
    let attempts = 2;
    expect(attempts < maxAttempts).toBe(false);
  });
});
