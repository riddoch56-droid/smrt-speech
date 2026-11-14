import { useCallback, useEffect, useRef, useState } from 'react';
import { bundledImageFiles } from '../content';
import { kvSet } from '../platform/db';
import { cachesAvailable, downloadImages, pruneImages, StorageUnavailableError, verifyImages, type OfflineCount } from '../platform/offline';

const STORAGE_MESSAGE =
  'This browser did not respond when asked to store pictures, so they cannot be kept for offline use here. Open the app in Safari, add it to the Home Screen and try again.';
import { Button, ProgressBar } from '../ui/kit';

const FILES = bundledImageFiles();

export function OfflinePanel({ autoStart }: { autoStart?: boolean }) {
  const supported = cachesAvailable();
  const total = FILES.length;
  const [count, setCount] = useState<OfflineCount | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const record = useCallback(async (c: OfflineCount) => {
    if (mounted.current) setCount(c);
    try {
      await kvSet('offlineReady', { cached: c.cached, total: c.total, checked: new Date().toISOString() });
    } catch {
      /* not critical */
    }
  }, []);

  const verify = useCallback(async () => {
    if (!supported || total === 0) return;
    setBusy(true);
    setError('');
    try {
      await record(await verifyImages(FILES));
    } catch (err) {
      if (mounted.current) setError(err instanceof StorageUnavailableError ? STORAGE_MESSAGE : 'Could not check the stored pictures.');
    }
    if (mounted.current) setBusy(false);
  }, [supported, total, record]);

  const download = useCallback(async () => {
    if (!supported || total === 0) return;
    setBusy(true);
    setError('');
    setProgress({ done: 0, total });
    try {
      const result = await downloadImages(FILES, (done, t) => {
        if (mounted.current) setProgress({ done, total: t });
      });
      if (result.cached === result.total) await pruneImages(FILES);
      await record(result);
      if (mounted.current && result.cached < result.total) {
        setError('Some pictures could not be downloaded. Check the connection and choose Resume download.');
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof StorageUnavailableError ? STORAGE_MESSAGE : 'The download stopped. Check the connection and choose Resume download.');
      }
    }
    if (mounted.current) {
      setProgress(null);
      setBusy(false);
    }
  }, [supported, total, record]);

  useEffect(() => {
    if (!supported || total === 0 || started.current) return;
    started.current = true;
    if (autoStart) void download();
    else void verify();
  }, [autoStart, supported, total, download, verify]);

  const complete = count !== null && count.cached === count.total && count.total > 0;
  let status = error && count === null ? 'Pictures are not stored for offline use yet.' : 'Checking...';
  if (!supported) status = 'Offline download is not available here: this browser cannot store pictures for offline use.';
  else if (total === 0) status = 'No pictures are bundled in this build.';
  else if (complete) status = `Ready for offline use: ${count.cached} of ${count.total} pictures`;
  else if (count) status = `${count.cached} of ${count.total} pictures downloaded`;

  const downloadLabel = count !== null && count.cached > 0 && !complete ? 'Resume download' : 'Download pictures';

  return (
    <div className="stack" data-testid="offline-panel">
      <p data-testid="offline-status" role="status" className={!supported ? 'notice warn' : undefined}>
        {status}
      </p>
      {busy && progress && (
        <div className="stack" data-testid="offline-progress">
          <ProgressBar value={progress.done} max={progress.total} label="Download progress" />
          <p className="small muted">
            Downloading: {progress.done} of {progress.total}
          </p>
        </div>
      )}
      {error && (
        <p className="notice warn" role="alert">
          {error}
        </p>
      )}
      {supported && total > 0 && (
        <div className="row">
          {!complete && (
            <Button icon="download" variant="primary" onClick={() => void download()} disabled={busy} data-testid="offline-download">
              {downloadLabel}
            </Button>
          )}
          <Button icon="repeat" onClick={() => void verify()} disabled={busy} data-testid="offline-verify">
            Check again
          </Button>
        </div>
      )}
      <p className="small muted">
        Pictures are stored on this iPad so the app works with no connection. This is the only time the app uses the internet.
      </p>
    </div>
  );
}
