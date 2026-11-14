import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useSession } from '../session/store';
import { Button } from '../ui/kit';

function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

let registered = false;

export function UpdatePrompt() {
  const running = useSession((s) => s.running);
  const online = useOnline();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const update = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (registered) return;
    registered = true;
    try {
      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
      update.current = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
        },
      });
    } catch {
      /* service workers unavailable */
    }
  }, []);

  if (!needRefresh || dismissed || running || !online) return null;

  return (
    <div className="toast" role="status" data-testid="update-toast">
      <span>Update available</span>
      <Button
        icon="download"
        onClick={() => {
          try {
            void update.current?.(true);
          } catch {
            /* ignore */
          }
        }}
        data-testid="update-now"
      >
        Update
      </Button>
      <Button variant="quiet" onClick={() => setDismissed(true)} data-testid="update-later">
        Later
      </Button>
    </div>
  );
}
