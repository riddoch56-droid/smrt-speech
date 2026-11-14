import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// WCAG 2.x contrast for the colour pairs the app actually uses, in both themes.
const root = fileURLToPath(new URL('../../', import.meta.url));
const css = readFileSync(root + 'src/ui/smrt-tokens.css', 'utf8') + '\n' + readFileSync(root + 'src/ui/theme.css', 'utf8');

function tokens(theme: 'light' | 'dark'): Record<string, string> {
  const out: Record<string, string> = {};
  // Blocks whose selector names this theme (the light blocks also start with :root).
  const blocks = css.matchAll(/([^{}]+)\{([^{}]*)\}/g);
  for (const [, selector, body] of blocks) {
    const sel = selector.replace(/\/\*[\s\S]*?\*\//g, '');
    const mine = theme === 'light' ? /\[data-theme=["']light["']\]/.test(sel) : /\[data-theme=["']dark["']\]/.test(sel);
    if (!mine) continue;
    for (const [, name, value] of body.matchAll(/(--smrt-[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) out[name] = value;
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ['--smrt-text', '--smrt-background'],
  ['--smrt-text', '--smrt-surface'],
  ['--smrt-text', '--smrt-surface-soft'],
  ['--smrt-muted', '--smrt-background'],
  ['--smrt-muted', '--smrt-surface'],
  ['--smrt-on-primary', '--smrt-primary'],
  ['--smrt-primary', '--smrt-surface'],
  ['--smrt-primary-hover', '--smrt-surface-soft'],
  ['--smrt-success', '--smrt-success-soft'],
  ['--smrt-warning', '--smrt-warning-soft'],
  ['--smrt-error', '--smrt-error-soft'],
  ['--smrt-text', '--smrt-accent-soft'],
  ['--smrt-comprehension', '--smrt-surface'],
  ['--smrt-naming', '--smrt-surface'],
  ['--smrt-reading', '--smrt-surface'],
  ['--smrt-writing', '--smrt-surface'],
];

// Edges of controls and the plum part of the focus ring need 3:1 against what is behind them.
const EDGE_PAIRS: [string, string][] = [
  ['--smrt-border-strong', '--smrt-surface'],
  ['--smrt-border-strong', '--smrt-background'],
  ['--smrt-primary', '--smrt-background'],
];

describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
  const t = tokens(theme);

  it('defines every token the checks use', () => {
    for (const name of new Set([...TEXT_PAIRS, ...EDGE_PAIRS].flat())) expect(t[name], name).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it.each(TEXT_PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(EDGE_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe('therapy canvas contrast', () => {
  it('dark text on white is well above 7:1', () => {
    expect(contrast('#32283c', '#ffffff')).toBeGreaterThanOrEqual(7);
  });
  it('the success tick is readable on white', () => {
    expect(contrast(tokens('light')['--smrt-success'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
