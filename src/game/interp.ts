// Smooth motion of what another game tells us about (playing together): positions come with the sender's own
// time and are played back a little later than they happened, between the two words that surround that moment.
// The internet delivers words unevenly – two at once, then none for a while – and moving a monster when a word
// arrives (as before) made it stutter with every hiccup of the connection; played back by the sender's clock
// it moves exactly as it moved there, and a late word still arrives before it is needed.

/** how far behind the sender the picture is kept (a word of the host comes every 67 ms) */
const DELAY = 110;
/** a word that is later than that: the last known movement carries on for at most this long */
const EXTRAPOLATE = 160;

/** the sender's clock as seen here: the smallest gap between its time and ours over the last few seconds
 *  (the fastest word), so the playback follows the connection's best moments, not its worst */
export class Clock {
  private ds: number[] = [];
  private i = 0;
  min = NaN;

  seen(sentAt: number, now = performance.now()) {
    if (!Number.isFinite(sentAt)) return;
    const d = now - sentAt;
    if (this.ds.length < 48) this.ds.push(d);
    else this.ds[this.i++ % 48] = d;
    let m = Infinity;
    for (const v of this.ds) if (v < m) m = v;
    this.min = m;
  }

  /** the sender's time to show now */
  playback(now = performance.now()) {
    return now - this.min - DELAY;
  }

  get ready() {
    return Number.isFinite(this.min);
  }
}

/** the last few positions of one thing at the sender's times */
export class Track {
  private t: number[] = [];
  private x: number[] = [];
  private y: number[] = [];

  push(t: number, x: number, y: number) {
    const n = this.t.length;
    // the same moment again, or an older word than the last one: only the newest counts
    if (n && t <= this.t[n - 1]) {
      if (t === this.t[n - 1]) {
        this.x[n - 1] = x;
        this.y[n - 1] = y;
      }
      return;
    }
    this.t.push(t);
    this.x.push(x);
    this.y.push(y);
    if (this.t.length > 8) {
      this.t.shift();
      this.x.shift();
      this.y.shift();
    }
  }

  /** forget the past (a jump: stairs, a teleport) */
  reset(t: number, x: number, y: number) {
    this.t = [t];
    this.x = [x];
    this.y = [y];
  }

  get size() {
    return this.t.length;
  }

  /** where it was at the sender's time `rt` */
  at(rt: number, out: { x: number; y: number }) {
    const t = this.t;
    const n = t.length;
    if (!n) return false;
    if (n === 1 || rt <= t[0]) {
      out.x = this.x[0];
      out.y = this.y[0];
      return true;
    }
    const b = n - 1;
    if (rt <= t[b]) {
      let i = b;
      while (i > 1 && rt < t[i - 1]) i--;
      const k = (rt - t[i - 1]) / Math.max(1, t[i] - t[i - 1]);
      out.x = this.x[i - 1] + (this.x[i] - this.x[i - 1]) * k;
      out.y = this.y[i - 1] + (this.y[i] - this.y[i - 1]) * k;
      return true;
    }
    // newer than the newest word: the movement goes on for a moment, then it waits
    const a = b - 1;
    const dt = Math.max(1, t[b] - t[a]);
    const vx = (this.x[b] - this.x[a]) / dt,
      vy = (this.y[b] - this.y[a]) / dt;
    out.x = this.x[b];
    out.y = this.y[b];
    // a jump between two words is not a speed
    if (Math.abs(vx) + Math.abs(vy) < 0.5) {
      const over = Math.min(EXTRAPOLATE, rt - t[b]);
      out.x += vx * over;
      out.y += vy * over;
    }
    return true;
  }
}
