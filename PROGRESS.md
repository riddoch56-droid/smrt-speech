# SMRT Speech: build progress

A fresh session can resume from this file plus `SMRT_SPEECH_BUILD_PROMPT.md`,
`SMRT_Speech_Visual_Asset_Pack/integration/CLAUDE_CODE_INTEGRATION_PROMPT.md`, `DECISIONS.md` and
`HANDOVER.md`.

## Done

| Phase | Status |
|---|---|
| 1. Scaffold, tooling, design tokens, app shell, PWA basics, CI workflow | Done |
| 2. Platform services (storage, speech, audio, recording, share, PIN, wake lock) | Done |
| 3. Vocabulary authoring (700 words) and content validation | Done |
| 4. Image pipeline, sourcing, processing, credits, visual quality control | Done: 557 of 700 words have a reviewed picture (445 after three attempts, 112 more from a fourth, wider round); the rest are in `IMAGE_TODO.md` |
| 5. Session engine and shared settings | Done, unit tested |
| 6. Comprehension module (3 activities) | Done |
| 7. Naming module (4 activities), frozen 30-item screener (version 1) | Done |
| 8. Writing module (4 activities) | Done |
| 9. Reading module (4 activities) with authored phrases and sentences | Done |
| 10. Patients, privacy lock, history, charts | Done |
| 11. Reports: PDF, CSV, share | Done, unit tested |
| 12. Custom content and word management | Done |
| 13. Backup, restore, offline download, update flow | Done |
| 14. Visual design system from the asset pack (light and dark themes) | Done |
| 15. Tests: unit, end to end (WebKit iPad landscape and portrait, offline) | Done; results in `HANDOVER.md` |
| 16. Deploy to GitHub Pages | See `HANDOVER.md` |

## How the picture set was made

Three attempts per word (`tools/images/`): search, visual review of up to eight candidates per
word on review sheets, a second search with a reviewer's phrase, and a third search that also
accepts CC BY-SA. Every chosen picture was then checked again on contact sheets and weak ones were
withdrawn. Decisions are kept in `tools/images/picks/` and `tools/images/state.json`.

## If you carry on from here

- Add pictures for the words in `IMAGE_TODO.md` (in the app, or with the pipeline), then run
  `npx tsx tools/images/finalise.ts`.
- Write reading items for any new pictures: `tools/content/READING_AUTHORING.md`, then
  `npx tsx tools/content/build-reading.ts`.
- After any content change: `npm run validate:content`, `npm run export:review`, `npm test`,
  `npm run build`, `npm run test:e2e`.

## Commands

    npm run dev              development server
    npm test                 unit tests (Vitest)
    npm run test:e2e         end-to-end tests (Playwright; run `npm run build` first)
    npm run validate:content content checks
    npm run export:review    regenerate CONTENT_REVIEW.csv
    npm run assets           reinstall the visual asset pack
    npm run build            lint, typecheck and production build
