// Minimal global event bus shared by the game scene and the DOM UI.
type Handler = (...args: any[]) => void;

class Bus {
  private map = new Map<string, Set<Handler>>();
  on(ev: string, fn: Handler) {
    if (!this.map.has(ev)) this.map.set(ev, new Set());
    this.map.get(ev)!.add(fn);
    return () => this.off(ev, fn);
  }
  off(ev: string, fn: Handler) {
    this.map.get(ev)?.delete(fn);
  }
  emit(ev: string, ...args: any[]) {
    this.map.get(ev)?.forEach((fn) => fn(...args));
  }
}

export const bus = new Bus();
