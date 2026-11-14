// Explicit offline content download: every picture is fetched into a named cache that
// the service worker also serves from, then counted to verify.

export const IMAGE_CACHE = 'smrt-images-v1';

export function imageUrl(file: string): string {
  return new URL(`images/${file}`, document.baseURI).href;
}

export function cachesAvailable(): boolean {
  return typeof caches !== 'undefined';
}

/** How long to wait for the browser's picture storage before giving up. */
export const STORAGE_TIMEOUT_MS = 12_000;

export class StorageUnavailableError extends Error {
  constructor() {
    super('Picture storage did not respond');
    this.name = 'StorageUnavailableError';
  }
}

/** A storage call that never answers must not leave the screen waiting for ever. */
export function withTimeout<T>(work: Promise<T>, ms = STORAGE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StorageUnavailableError()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function openImageCache(): Promise<Cache> {
  return withTimeout(caches.open(IMAGE_CACHE));
}

export interface OfflineCount {
  cached: number;
  total: number;
  missing: string[];
}

export async function verifyImages(files: readonly string[]): Promise<OfflineCount> {
  if (!cachesAvailable()) return { cached: 0, total: files.length, missing: files.slice() };
  const cache = await openImageCache();
  const keys = new Set((await withTimeout(cache.keys())).map((r) => r.url.split('?')[0]));
  const missing = files.filter((f) => !keys.has(imageUrl(f)));
  return { cached: files.length - missing.length, total: files.length, missing };
}

/**
 * Downloads whatever is missing. Safe to call again: it resumes where it stopped.
 * Reports progress after every file and returns the verified count.
 */
export async function downloadImages(
  files: readonly string[],
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<OfflineCount> {
  if (!cachesAvailable()) return { cached: 0, total: files.length, missing: files.slice() };
  const cache = await openImageCache();
  const before = await verifyImages(files);
  let done = before.cached;
  onProgress(done, files.length);
  const queue = before.missing.slice();
  const worker = async () => {
    for (;;) {
      const file = queue.shift();
      if (!file || signal?.aborted) return;
      try {
        const url = imageUrl(file);
        const res = await fetch(url, { cache: 'no-cache', signal });
        // Only a real picture counts: some servers answer a missing file with an HTML page.
        if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) {
          await cache.put(url, res);
          done++;
        }
      } catch {
        /* left for the next attempt */
      }
      onProgress(done, files.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return verifyImages(files);
}

/** Removes cached pictures that are no longer part of the image set. */
export async function pruneImages(files: readonly string[]): Promise<void> {
  if (!cachesAvailable()) return;
  const cache = await openImageCache();
  const wanted = new Set(files.map(imageUrl));
  for (const req of await cache.keys()) if (!wanted.has(req.url.split('?')[0])) await cache.delete(req);
}
