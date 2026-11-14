import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACTIVITY_IDS, MODULES } from '../../src/session/types';
import { ACTIVITY_ART, asset, BRAND_MARK, MODULE_ART, SHELL_BACKGROUNDS } from '../../src/ui/assets';
import { ICON_NAMES } from '../../src/ui/Icon';
import { SMRT_ASSET_FILES, SMRT_GLYPHS } from '../../src/ui/smrt-icons';
import { resolveTheme } from '../../src/ui/theme';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pack = root + 'SMRT_Speech_Visual_Asset_Pack/SMRT_Speech_Visual_Asset_Pack/';
const installed = root + 'public/smrt-assets/';
const manifest = JSON.parse(readFileSync(pack + 'integration/ASSET_MANIFEST.json', 'utf8')) as { assets: { id: string; svg: string }[] };

describe('visual asset pack', () => {
  it('installs every manifest icon as SVG under public/smrt-assets', () => {
    const missing = manifest.assets.map((a) => a.svg).filter((f) => !existsSync(installed + f));
    expect(missing).toEqual([]);
  });

  it('lists only files that are really installed', () => {
    expect(SMRT_ASSET_FILES.length).toBeGreaterThan(100);
    expect(SMRT_ASSET_FILES.filter((f) => !existsSync(installed + f))).toEqual([]);
  });

  it('installed SVGs are identical to the pack files', () => {
    const changed = manifest.assets.map((a) => a.svg).filter((f) => readFileSync(installed + f, 'utf8') !== readFileSync(pack + f, 'utf8'));
    expect(changed).toEqual([]);
  });

  it('has artwork for all four modules and all fifteen activities', () => {
    expect(Object.keys(MODULE_ART).sort()).toEqual(MODULES.map((m) => m.id).sort());
    expect(Object.keys(ACTIVITY_ART).sort()).toEqual([...ACTIVITY_IDS].sort());
    const used = [...Object.values(MODULE_ART), ...Object.values(ACTIVITY_ART), BRAND_MARK, ...Object.values(SHELL_BACKGROUNDS)];
    expect(used.filter((f) => !SMRT_ASSET_FILES.includes(f))).toEqual([]);
    expect(new Set(Object.values(ACTIVITY_ART)).size).toBe(15);
  });

  it('activity artwork comes from the folder of its own module', () => {
    for (const id of ACTIVITY_IDS) {
      const moduleFolder = id.startsWith('comp-') ? 'comprehension' : id.startsWith('naming-') ? 'naming' : id.startsWith('read-') ? 'reading' : 'writing';
      expect(ACTIVITY_ART[id]).toMatch(new RegExp(`^activities/${moduleFolder}/`));
    }
  });

  it('every interface icon name maps to a pack glyph', () => {
    const glyphs = SMRT_GLYPHS as Record<string, string>;
    const broken = Object.entries(ICON_NAMES).filter(([, key]) => !glyphs[key]);
    expect(broken).toEqual([]);
  });

  it('inline glyphs carry no fixed colour, so they follow the theme', () => {
    for (const [key, markup] of Object.entries(SMRT_GLYPHS)) {
      expect(markup, key).toContain('stroke="currentColor"');
      expect(markup, key).not.toMatch(/#[0-9a-fA-F]{6}/);
    }
  });

  it('builds base-relative addresses with no external host', () => {
    expect(asset('modules/naming.svg')).toMatch(/smrt-assets\/modules\/naming\.svg$/);
    expect(asset('modules/naming.svg')).not.toMatch(/^https?:/);
  });
});

describe('theme choice', () => {
  it('resolves light, dark and system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('stylesheets', () => {
  const tokens = readFileSync(root + 'src/ui/smrt-tokens.css', 'utf8');
  const theme = readFileSync(root + 'src/ui/theme.css', 'utf8');
  const app = readFileSync(root + 'src/ui/app.css', 'utf8');

  it('uses the pack token file unchanged', () => {
    expect(tokens).toBe(readFileSync(pack + 'themes/smrt-tokens.css', 'utf8'));
  });

  it('keeps the therapy canvas white and independent of the theme', () => {
    expect(theme).toMatch(/\.session \{\s*background: #fff;/);
    expect(readFileSync(root + 'src/session/runtime.tsx', 'utf8')).toContain('className="session" data-theme="light"');
  });

  it('loads no remote fonts, stylesheets or images', () => {
    for (const css of [tokens, theme, app]) {
      expect(css).not.toMatch(/https?:\/\//);
      expect(css).not.toMatch(/@import/);
    }
  });

  it('honours reduced motion', () => {
    expect(app).toContain('prefers-reduced-motion');
    expect(tokens).toContain('prefers-reduced-motion');
  });
});
