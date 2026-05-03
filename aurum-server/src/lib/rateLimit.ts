/**
 * File d'attente FIFO avec throttling par source.
 * Usage : `await mbLimiter.run(() => fetch(...))`
 */
class Limiter {
  private queue: Array<() => void> = [];
  private active = 0;
  private lastStart = 0;
  constructor(private readonly concurrency: number, private readonly minIntervalMs: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      const tryStart = () => {
        if (this.active >= this.concurrency) return void this.queue.push(tryStart);
        const wait = Math.max(0, this.lastStart + this.minIntervalMs - Date.now());
        if (wait > 0) {
          setTimeout(() => {
            if (this.active >= this.concurrency) this.queue.push(tryStart);
            else { this.active++; this.lastStart = Date.now(); resolve(); }
          }, wait);
          return;
        }
        this.active++;
        this.lastStart = Date.now();
        resolve();
      };
      tryStart();
    });

    try {
      return await task();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

// MusicBrainz : 1 req/s strict (User-Agent obligatoire)
export const mbLimiter = new Limiter(1, 1100);
// Last.fm : ~5 req/s officiel
export const lastfmLimiter = new Limiter(3, 250);
// Deezer : ~50 req/5s public
export const deezerLimiter = new Limiter(4, 120);
// iTunes : ~20 req/min (très restrictif)
export const itunesLimiter = new Limiter(2, 1000);
// Spotify : 180 req/min
export const spotifyLimiter = new Limiter(5, 200);
// Wikipedia : pas de limite stricte mais on reste poli
export const wikipediaLimiter = new Limiter(5, 100);
