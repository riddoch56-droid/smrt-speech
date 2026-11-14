// Small platform helpers: persistent storage, wake lock and the privacy PIN hash.

export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usageMb: number | null;
  quotaMb: number | null;
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export async function storageStatus(): Promise<StorageStatus> {
  const out: StorageStatus = { supported: false, persisted: false, usageMb: null, quotaMb: null };
  try {
    if (navigator.storage?.persisted) {
      out.supported = true;
      out.persisted = await navigator.storage.persisted();
    }
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      out.usageMb = e.usage !== undefined ? Math.round((e.usage / 1048576) * 10) / 10 : null;
      out.quotaMb = e.quota !== undefined ? Math.round(e.quota / 1048576) : null;
    }
  } catch {
    /* ignore */
  }
  return out;
}

let wakeLock: { release(): Promise<void> } | null = null;

export async function acquireWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
  } catch {
    wakeLock = null;
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch {
    /* ignore */
  }
  wakeLock = null;
}

export interface PinRecord {
  salt: string;
  hash: string;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256);
  return toHex(bits);
}

/** Only a salted hash of the PIN is ever stored. */
export async function hashPin(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return { salt: toHex(salt.buffer), hash: await derive(pin, salt) };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  return (await derive(pin, fromHex(record.salt))) === record.hash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
