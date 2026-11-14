import { asset, SHELL_BACKGROUNDS } from './assets';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

/** Browser-bar colour for each theme (the pack's background tokens). */
const CHROME: Record<Theme, string> = { light: '#FAF5F2', dark: '#261F2D' };

// The saved setting lives with the other settings in the app's own storage. This small copy
// lets the right theme be applied before that storage has been read, so there is no flash.
const KEY = 'smrt-theme';

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'system') return prefersDark ? 'dark' : 'light';
  return choice === 'dark' ? 'dark' : 'light';
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

let current: ThemeChoice = 'light';

/**
 * Sets the theme of the app chrome. Activities are not affected: the therapy canvas carries
 * its own light theme (see SessionFrame), and nothing here touches data or session state.
 */
export function applyTheme(choice: ThemeChoice): void {
  current = choice;
  if (typeof document === 'undefined') return;
  const theme = resolveTheme(choice, prefersDark());
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme]);
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private browsing: the setting is still saved with the app's settings */
  }
}

/** Call once at start-up, before the first render. */
export function initTheme(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  // Full addresses, so the files resolve the same way from any stylesheet or sub-path.
  const full = (rel: string) => new URL(asset(rel), document.baseURI).href;
  root.setProperty('--smrt-bg-light', `url("${full(SHELL_BACKGROUNDS.light)}")`);
  root.setProperty('--smrt-bg-dark', `url("${full(SHELL_BACKGROUNDS.dark)}")`);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  applyTheme(saved === 'dark' || saved === 'system' ? saved : 'light');
  if (typeof matchMedia === 'function') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (current === 'system') applyTheme('system');
    });
  }
}
