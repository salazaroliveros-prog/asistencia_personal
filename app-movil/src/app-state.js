export class AppState {
  state = {};
  listeners = {};

  get(key, fallback) {
    if (this.state[key] !== undefined) return this.state[key];
    if (fallback !== undefined) return fallback;
    throw new Error(`AppState key missing: ${key}`);
  }

  set(key, value) {
    const prev = this.state[key];
    this.state[key] = value;
    if (prev !== value) this.notify(key, value);
  }

  on(key, listener) {
    if (!this.listeners[key]) this.listeners[key] = new Set();
    this.listeners[key].add(listener);
    return () => { this.listeners[key]?.delete(listener); };
  }

  notify(key, value) {
    this.listeners[key]?.forEach((l) => { try { l(value); } catch { /* noop */ } });
  }
}

export const state = new AppState();
