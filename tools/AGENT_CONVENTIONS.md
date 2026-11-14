# Conventions for anyone adding code to SMRT Speech

Read `SMRT_SPEECH_BUILD_PROMPT.md` (the product brief) for the sections relevant to your task.

## Stack
Vite + React 19 + TypeScript (strict), Zustand, Dexie. No new dependencies. No network requests
at runtime. Hash routing via `src/app/router.ts` (`navigate('/path')`, `goBack()`).

## Read before writing
- `src/session/types.ts`: activities, settings, `TrialRecord`, `SessionRecord`, `SessionSummary`.
- `src/platform/db.ts`: Dexie tables (`db.patients`, `db.sessions`, `db.kv`, `db.customWords`,
  `db.customCategories`, `db.customReading`, `db.wordOverrides`), `Binary`, `kvGet`, `kvSet`.
- `src/app/store.ts`: `useApp` Zustand store (settings, practitioner, patients, PIN, custom content).
  After changing patients call `useApp.getState().refreshPatients()`; after changing custom words,
  categories, reading items or overrides call `useApp.getState().refreshCustom()`.
- `src/app/content.ts`: `useAllWords`, `groupOptions`, `groupLabel`, `wordImageSrc`, `findWord`.
- `src/ui/kit.tsx`: `Button`, `Toggle`, `Segmented`, `MultiChips`, `Modal`, `Screen`, `Field`,
  `ProgressBar`, `formatDate`, `formatDateTime`, `formatDuration`. `src/ui/Icon.tsx` for icon names.
- `src/ui/app.css`: shared classes (`card`, `row`, `stack`, `list`, `list-item`, `table`, `tag`,
  `notice`, `stat-grid`, `stat`, `bar-row`, `input`, `field`, `chips`, `chip`, `muted`, `small`).
- `src/platform/*`: speech, audio, recorder, share, system (PIN hash, storage), backup, offline.
- `src/reports/aggregate.ts`: pure aggregation helpers over sessions.

## Rules
- UK English in all interface text. Patients are identified by an ID code only, never a name.
- No clinical claims. Never say the app diagnoses, treats or improves anything.
- Aphasia-friendly, iPad first: touch targets at least 60x60 px (the `btn` class already is),
  body text at least 20 px, buttons carry an icon and a short label, WCAG AA contrast, never
  colour alone (pair with an icon or text). Works in landscape and portrait from 1024x768.
- Use the shared kit and CSS classes. If you need new styles, put them in a CSS file inside
  YOUR OWN folder and import it from your component. Do NOT edit `src/ui/app.css`, and do not
  edit any file outside the folders named in your task.
- Every screen uses `<Screen title=... back=...>`.
- Add the `data-testid` attributes listed in your task exactly: end-to-end tests rely on them.
- No `any` (lint fails). No unused variables. Hooks rules are linted.

## Checking your work
Other parts of the app are being written at the same time, so the whole project may not compile.
Check only your own files:

    npx tsc --noEmit -p . 2>&1 | grep -E "src/<your-folder>|tests/unit/<your-tests>"
    npx eslint src/<your-folder>

Fix every error in your own files. Do not run `npm run build`, `git` commands or the image tools.
Use uniquely named scratch files if you need any, and delete them afterwards.
Report back briefly: files written, exported names, anything you could not do.
