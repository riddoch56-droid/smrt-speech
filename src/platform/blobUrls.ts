import { binaryToBlob, type Binary } from './db';

const urls = new Map<string, string>();

/** Returns a stable object URL for a stored binary, created on first use. */
export function blobUrl(key: string, bin: Binary): string {
  let url = urls.get(key);
  if (!url) {
    url = URL.createObjectURL(binaryToBlob(bin));
    urls.set(key, url);
  }
  return url;
}

export function clearBlobUrls() {
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
}
