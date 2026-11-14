import { describe, expect, it } from 'vitest';
import { StorageUnavailableError, withTimeout } from '../../src/platform/offline';

describe('withTimeout', () => {
  it('passes a prompt answer straight through', async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it('passes a failure straight through', async () => {
    await expect(withTimeout(Promise.reject(new Error('no')), 50)).rejects.toThrow('no');
  });

  it('gives up on storage that never answers', async () => {
    const never = new Promise<number>(() => {});
    await expect(withTimeout(never, 20)).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});
