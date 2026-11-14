import { useSyncExternalStore } from 'react';

// Hash-based routing so deep links survive on GitHub Pages.

function read(): string {
  const h = typeof window === 'undefined' ? '' : window.location.hash;
  const path = h.replace(/^#/, '');
  return path.startsWith('/') ? path : '/';
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, read, () => '/');
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, replace = false) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) {
    window.location.replace(target);
  } else if (window.location.hash !== target) {
    window.location.hash = target;
  }
}

export function goBack(fallback = '/') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback);
}
