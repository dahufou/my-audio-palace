// File d'attente FIFO avec throttling par source (X requêtes / Y ms).
// Évite les 503 (MusicBrainz: 1 req/s) et 403 (iTunes anti-spam).

type Task<T> = () => Promise<T>;

class Limiter {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(
    private readonly concurrency: number,
    private readonly minIntervalMs: number,
  ) {}
  private lastStart = 0;

  async run<T>(task: Task<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      const tryStart = () => {
        if (this.active >= this.concurrency) {
          this.queue.push(tryStart);
          return;
        }
        const wait = Math.max(0, this.lastStart + this.minIntervalMs - Date.now());
        if (wait > 0) {
          setTimeout(() => {
            if (this.active >= this.concurrency) {
              this.queue.push(tryStart);
            } else {
              this.active++;
              this.lastStart = Date.now();
              resolve();
            }
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

// MusicBrainz: 1 req/s, séquentiel
export const mbLimiter = new Limiter(1, 1100);
// iTunes: max 3 simultanés, 250ms entre starts
export const itunesLimiter = new Limiter(3, 250);
// Deezer: assez permissif
export const deezerLimiter = new Limiter(4, 150);
// Cover Art Archive (musicbrainz host): même limiteur que MB
export const caaLimiter = mbLimiter;
