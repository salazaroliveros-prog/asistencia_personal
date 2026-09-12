export class Backoff {
  constructor(baseMs = 1000, maxMs = 30000, maxAttempts = 10) {
    this.baseMs = baseMs;
    this.maxMs = maxMs;
    this.maxAttempts = maxAttempts;
    this.attempts = 0;
    this.timer = null;
  }

  get delayMs() {
    const base = Math.min(this.baseMs * Math.pow(2, this.attempts), this.maxMs);
    const jitter = Math.random() * base * 0.25;
    return Math.min(Math.round(base + jitter), this.maxMs);
  }

  get canRetry() { return this.attempts < this.maxAttempts; }

  reset() {
    this.attempts = 0;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  schedule(fn) {
    if (this.timer) return;
    if (!this.canRetry) return;
    this.timer = setTimeout(() => { this.timer = null; this.attempts++; fn(); }, this.delayMs);
  }

  cancel() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }
}
