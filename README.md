# SMRT Speech

SMRT Speech is a word-level language practice toolkit for adults with aphasia and related
communication difficulties. It is built for one speech and language therapist to use on her own
iPad, sitting with a patient. It runs as an installable, offline web app.

It is an informal practice toolkit. It does not diagnose, treat or claim to improve any condition,
and its naming screen is an informal screen, not a standardised assessment.

## What it does

Four modules share one picture vocabulary of 700 words, one settings system, one scoring engine and
one history and reporting system.

| Module | Activities |
|---|---|
| Comprehension | Listen, Read, Listen and Read |
| Naming | Flashcards, Naming Practice, Describe, Naming Test |
| Reading | Phrase Matching, Phrase Completion, Sentence Matching, Sentence Completion |
| Writing | Copy, Fill in the Blank, Spell What You See, Spell What You Hear |

Also: patients identified by ID code only, an optional privacy PIN, saved session history with
charts, PDF and CSV reports shared through the iPad share sheet, the therapist's own words and
photos, backup and restore, and full offline use after the first load.

## Privacy

- All data stays on the device, in the browser's own storage (IndexedDB). Nothing is transmitted.
- The app makes no third-party requests at runtime: no CDNs, web fonts, analytics or telemetry.
- This repository contains no patient data and no real person's name. The practitioner's details
  are typed into the app at first run and stored only on the device.

## Requirements

- Node.js 22 or later and npm.
- For end-to-end tests: `npx playwright install webkit chromium`.

## Run, test, build

```bash
npm install
npm run dev              # development server
npm test                 # unit tests (Vitest)
npm run validate:content # checks the vocabulary, reading content, pictures and licences
npm run build            # lint, typecheck and production build into dist/
npm run preview          # serve the production build locally
npm run test:e2e         # end-to-end tests (Playwright, WebKit at iPad size); build first
```

## Project layout

```
src/
  app/            routing, home, app store
  content/        the 700 words, reading items, screener, image credits (typed JSON)
  modules/        comprehension, naming, reading, writing activity screens
  session/        trial engine, scoring, foil selection, auto field size, tiles, recommendations
  patients/       patient list, privacy PIN
  history/        history, charts, session detail
  reports/        PDF and CSV generation, aggregation
  custom/         my words, custom reading items, word management, image credits
  settings/       settings, first run, offline download, backup, update prompt
  platform/       storage, speech, sound, recording, share, wake lock, backup, offline cache
  ui/             shared components and the design-token stylesheet
tools/
  content/        authoring rules, normaliser, validator, review export
  images/         image sourcing, review sheets, processing, licence record
tests/
  unit/           Vitest
  e2e/            Playwright
public/
  images/         one 512 x 512 WebP per word
  icons/          app icon (SVG) and generated PNG sizes
```

The trial engine, scoring, foil selection, auto-adjusting field size, tile logic and recommendation
rules are pure functions in `src/session/`, separate from the React components and unit tested.

## Content

- Vocabulary lives in `src/content/words/<group>.json`. After editing, run
  `npx tsx tools/content/normalise.ts` (recomputes derived fields) and `npm run validate:content`.
- `npm run export:review` writes `CONTENT_REVIEW.csv`, the sheet for clinical review of every cue,
  phrase and sentence.
- The naming screen list is `src/content/screener.json`. It is frozen and versioned: if it ever
  changes, increase `version` so old and new results are not compared as like for like.

## Pictures

Every bundled picture is openly licensed (CC0, public domain or CC BY; any CC BY-SA picture is
flagged) and recorded in `src/content/image-credits.json`, which the app shows under
Settings > Image credits. Words without a picture that passed visual review are listed in
`IMAGE_TODO.md`, flagged `hasImage: false`, and left out of picture-dependent activities until a
picture is added (in the app: Settings > Word management > Replace picture).

The pipeline in `tools/images/`:

```bash
npx tsx tools/images/source.ts       # search open-licence sources, shortlist candidates
npx tsx tools/images/strips.ts       # build review sheets (tools/images/sheets/strip-*.jpg)
# look at every sheet; record the best candidate per word in tools/images/picks/*.json
npx tsx tools/images/apply-picks.ts  # process the chosen pictures to 512 x 512 WebP
npx tsx tools/images/retry.ts        # search again for words with no good candidate (three attempts)
npx tsx tools/images/reject.ts       # withdraw pictures that fail the contact-sheet check
npx tsx tools/images/finalise.ts     # write credits, flag gaps, write IMAGE_TODO.md
npx tsx tools/images/sheets.ts       # contact sheets of the final set
```

## Visual design

The look of the app comes from `SMRT_Speech_Visual_Asset_Pack/` (plum and coral, with light and
dark themes for menus, records and settings). Activities always stay white with dark text.

```bash
npm run assets   # install the pack into public/smrt-assets/ and regenerate src/ui/smrt-icons.ts
```

- `src/ui/smrt-tokens.css` is the pack's token file, unchanged. `src/ui/theme.css` adds a few
  documented extension tokens and maps the app's variables onto the pack's.
- `src/ui/Icon.tsx` maps the app's icon names to pack assets; `src/ui/assets.ts` lists the artwork
  for the four modules and fifteen activities.
- The pack's files are precached by the service worker, so the design works offline.
- The artwork was made for this project. It is separate from the vocabulary photographs, whose
  sources and licences are in `src/content/image-credits.json`.

Run `npm run assets` again after changing anything in the pack. See `DECISIONS.md` for the
integration choices.

## Deploy

The app deploys to GitHub Pages from `main` using `.github/workflows/deploy.yml`, which runs the
unit tests and content validation, builds, and publishes `dist/`. Vite's `base` is relative and the
app uses hash routing, so it works under any repository name. See `HANDOVER.md` for the live URL,
iPad installation steps and how to update the app.

## Licence note

The application code and written content were authored for this project. Pictures carry their own
licences, listed in the image credits.
