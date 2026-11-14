# Claude Code integration prompt: SMRT Speech premium visual system

You have access to the directory `SMRT_Speech_Visual_Asset_Pack`. Read this entire file, `integration/ASSET_MANIFEST.json`, `themes/tokens.json`, and the original `SMRT_SPEECH_BUILD_PROMPT.md` before editing the app.

## Objective
Integrate the supplied ORIGINAL warm-premium plum-and-coral visual system into the existing SMRT Speech iPad-first React/TypeScript PWA. Preserve all functional, clinical, privacy, accessibility, offline, and content requirements in the original build brief. The visual asset pack does NOT replace the 700 vocabulary images, does not supply clinical stimuli, and does not author clinical content.

## Source-of-truth and asset rules
- The original build brief controls features and workflows; this pack controls visual appearance only.
- Read `integration/ASSET_MANIFEST.json` and use EXACT filenames. Never infer a file exists from the reference poster.
- Prefer transparent SVG for app interface icons, transparent PNG for raster contexts, and JPEG only where JPEG is required. Do not place cream-backed JPEG icons on dark surfaces; use SVG/PNG and theme-aware CSS.
- `previews/design-direction-reference.png` is a conceptual art-direction sheet, NOT an accurate inventory, NOT a pixel-perfect screen mock-up, and NOT a source for cropping icons. The actual manifest lists the deliverables.
- Install the supplied `themes/smrt-tokens.css` and use its CSS variables throughout. Extend with documented tokens only where necessary.
- Copy assets into the app's public directory under `public/smrt-assets/`, preserving relative paths. Reference via Vite `import.meta.env.BASE_URL` or equivalent base-safe path. GitHub Pages subpath deployment must work.
- Use `branding/app-icon.svg` for brand identity and supplied PNG sizes for manifest and Apple touch icon. The app wordmark should be accessible live text beside the mark, not baked into a small bitmap.
- Do not add CDN dependencies, remote fonts, analytics, telemetry or network-dependent assets.

## Required coverage
1. Home: four bespoke module tiles from `modules/`; clear patient ID/guest state; large touch targets.
2. Comprehension: Listen, Read, Listen and Read (3 activities).
3. Naming: Naming Practice, Describe, Naming Test, Flashcards (4 activities).
4. Reading: Phrase Matching, Phrase Completion, Sentence Matching, Sentence Completion (4 activities).
5. Writing: Fill in the Blank, Copy, Spell What You See, Spell What You Hear (4 activities).
6. Supporting UI: patient list/add/edit/archive, privacy lock, session setup, session progress, scoring, results, history, reports/PDF/CSV, custom words, settings, offline readiness, backup/restore, credits, help, error and empty states.
7. For activity-specific icons see `activities/<module>/`; for shared icons see `ui/navigation`, `ui/actions`, `ui/feedback`, `ui/patients`, `ui/reports`, `ui/settings`, and `ui/controls`.

## Visual direction
Warm, bespoke, refined clinical tool. Deep plum is the main identity; muted coral is an accent, not a universal button colour. Use soft surfaces, subtle borders, spacious grid layouts and restrained shadows on home, settings, reports and management screens. Comprehension uses mauve, Naming coral, Reading blue and Writing sage as supportive category markers. Do not use colour alone to distinguish meaning.

## Theme handling
Support both light and dark app chrome via `[data-theme]` and persist user preference. Dark theme applies to home, navigation, management and settings. Therapy activity canvases must remain WHITE or near-white with DARK text, irrespective of theme; preserve contrast and do not invert patient pictures. Theme switching must not affect data or activity state. Print/PDF layouts must remain light.

## Therapy UX constraints
- Avoid visual ornament, gradients, decorative waves, animation and shadow-heavy cards inside the actual trial area.
- Body text at least 20 px; target words much larger; interactive targets at least 60x60 CSS px/points as appropriate; use generous spacing.
- Stable placement for Home/progress (top), Hint/Repeat (bottom). Preserve visual focus and minimise reading demands.
- Correct feedback: tick plus accessible text and gentle success colour. Incorrect: neutral encouragement, subtle fade/shake only if motion permitted. No large red crosses or aggressive effects.
- Explicit icons AND text on buttons. Icon-only buttons require accessible names.
- Use `prefers-reduced-motion`, WCAG AA contrast, visible focus rings, proper semantics, large hit areas, and iPad safe-area insets.
- Maintain portrait and landscape responsive layouts for 1024x768 through 1366x1024 points.
- Never substitute decorative icons for the vocabulary photographs or the clinically required image/word content.

## Implementation steps
1. Inspect existing project architecture, current UI and routes. Make a short asset integration map for every screen and component. Do not rewrite functioning logic unnecessarily.
2. Copy assets and register PWA icons. Set theme tokens, shared typography, spacing, radii, border, elevation, focus and button components.
3. Refactor shared app shell/navigation, four module tiles, all 15 activity launch cards and settings sheets.
4. Refactor activity screens for a consistent top bar, stimulus stage, response area, and bottom control rail, retaining all scoring and cue logic.
5. Style all supporting screens, including patient history charts and printed reports; ensure PDF generation uses equivalent light-mode palette but does not require DOM screenshots.
6. Ensure assets are precached or included in offline cache strategy. Test offline after first load; ensure no external requests.
7. Check all icon paths against the manifest; no missing icons. Do not use the poster as a substitute for assets.
8. Run existing content validation, TypeScript, unit tests, Playwright WebKit iPad tests, offline tests, accessibility checks and production build. Fix regressions. Record actual results, never invent passing tests.
9. Update `DECISIONS.md`, `PROGRESS.md`, `README.md`, and `HANDOVER.md` with integration choices, theme behaviour, asset attribution and any limitations.

## Asset provenance
The icon vectors, brand symbol and backgrounds were programmatically created specifically for this pack; `previews/design-direction-reference.png` is AI-generated concept artwork. There are no third-party icon libraries, stock photos or fonts embedded in this pack. If adapting or adding third-party assets, record licences separately. Keep this distinction clear in the image credits.

## Definition of done
All four modules and all 15 activities use the bespoke asset system; every supporting screen has coherent styling; light and dark app themes work; therapy remains uncluttered and light; iPad portrait/landscape work; touch/contrast/focus/reduced-motion checks pass; the app remains fully offline; all pre-existing clinical features, data and reporting remain functional. Provide a concise change summary and verified test outcomes.
