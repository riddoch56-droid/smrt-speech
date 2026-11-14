# Decisions and assumptions

Notable decisions made while building SMRT Speech, with the reason for each.

## Environment

- **`node_modules` is a junction to a local folder outside Google Drive**
  (`.cache\smrt-speech\node_modules` in the user's home folder). The project folder sits inside a Google Drive
  folder; tens of thousands of dependency files there would be slow to sync and prone to file locks.
  On another machine, a plain `npm install` creates an ordinary `node_modules` and everything works
  the same. `vite.config.ts` allows the dev server to read the real path.
- **GitHub CLI was not installed** when the build started, so deployment (section 15 of the brief)
  could not be run by the build session. See `HANDOVER.md`.

## Stack

- Vite 8, React 19, TypeScript 6 (strict), Zustand, Dexie 4, jsPDF 4 with jspdf-autotable 5,
  vite-plugin-pwa 2 (Workbox), Vitest 5, Playwright. No deviation from the brief's stack.
- **Vite `base` is `./`** (relative) rather than `/<repo>/`. With hash routing the document URL never
  changes, so relative asset, manifest and service worker paths work under any repository name.
- **Routing** is a small hand-written hash router (`src/app/router.ts`) instead of a routing library.
- **Styling** is one hand-written stylesheet of design tokens and shared classes (`src/ui/app.css`),
  plus a few per-folder CSS files. No CSS framework.
- **Binary data in IndexedDB** (custom photos, audio clips) is stored as `{ type, data: ArrayBuffer }`
  rather than `Blob`. Blobs in IndexedDB have a history of problems in Safari, and plain buffers are
  also simpler to back up.

## Vocabulary

- **Verbs are stored in their base form** ("sweep", not "sweeping"), so they work as spelling targets
  and in sentence-completion cues.
- **Derived fields are computed, not hand-authored.** `tools/content/normalise.ts` fills in `id`,
  `group`, `wordClass`, `letters`, `multiWord`, `image` and `cues.firstLetter`, so they cannot drift.
- The 700 words were authored group by group against written rules (`tools/content/AUTHORING.md`)
  and checked by script for missing fields, cues containing the target word, and duplicates. Seven
  words that had been chosen by two groups were replaced so every word is unique.
- **All clinical wording is a first draft for the therapist to review** in `CONTENT_REVIEW.csv`.
  Syllable counts, first and last sounds and rhymes were written by hand and have not been checked
  against a pronunciation dictionary.

## Session behaviour

- **A trial is "correct"** only when the first response is right and no hint or cue was used. In
  Naming, a response that is right after one or more cues is recorded as "cued" and reported
  separately; it does not count towards accuracy.
- **Naming trials end on the model.** After the tick or the cross, the written word is shown and
  spoken, so every trial ends with the correct word.
- **Describe** scores the final naming attempt only. The therapist's marks for each prompt card are
  stored with the trial and shown in the report, but revealing a card does not change the score.
- **Naming Test** has no sounds, no feedback and no cues, and is always the same items in the same
  order. Results store the screener version.
- **Flashcards** with scoring switched off are free practice: nothing is scored and nothing is saved.
  With scoring on, only the cards that were marked are recorded.
- **Fill in the Blank on the Easy tile level** offers the missing letter plus two others. The brief's
  rule ("only the letters needed") would leave a single tile and no choice to make.
- **The Hard tile level** shows the alphabet once, with spare copies of any letter the word repeats,
  so every word can be spelled.
- **Writing excludes** multi-word items and any word containing a hyphen or apostrophe.
- **Auto field size** applies to Comprehension. Reading offers 2, 3 or 4 choices as the brief states.
- **Easy foils** are spread across different groups (at most one per group while the pool allows).
  **Hard foils** come from the same subgroup, then the same group. For Listen and Read on Hard, foils
  are ranked by same first letter and similar length.
- **Recommendations** compare with the previous saved session of the same activity for that patient.
  Guest sessions have no history, so they can never show "twice in a row".
- **Leaving a session** offers three choices: keep going, finish and see results (saves what was
  done), or leave without saving.
- **The privacy lock engages when a session starts**, so reaching Patients, History, Reports or
  Settings afterwards asks for the PIN (if one is set).

## Images

- No `OPENAI_API_KEY` was set, so the open-licence route was used: Wikimedia Commons as the main
  source, with Openverse for a limited number of searches (anonymous Openverse use is capped at 20
  requests a minute and 200 a day).
- Commons searches are filtered to files whose structured data says CC0 or CC BY, because most
  Commons photographs are CC BY-SA, which the brief allows only as a flagged last resort.
- Selection is by eye: `tools/images/strips.ts` builds review sheets of up to eight candidates per
  word and the best one is chosen, rather than trusting automatic ranking.
- The build client identifies itself with a descriptive name and no personal contact details.
  Wikimedia allows such clients 10 search requests a minute, so sourcing 700 words took hours.
  Adding a contact address to `USER_AGENT` in `tools/images/lib.ts` raises that limit a great deal;
  that is the owner's choice to make, not the build's.
- **Each word gets up to three attempts.** Attempt one searches the word's own search phrase,
  attempt two a phrase suggested by the reviewer who rejected the first candidates, and attempt three
  also accepts CC BY-SA files. Any CC BY-SA picture carries a `flagged` note in
  `src/content/image-credits.json` and is listed in `HANDOVER.md`.
- **Pictures are downloaded at Wikimedia's standard preview widths** (960, 500 or 330 pixels), never
  the original file. Wikimedia refuses bulk downloads of originals, and the app only needs 512 pixels.
- **Colour words use a swatch drawn by the build** (`tools/images/make-swatches.ts`): a plain blob of
  the colour on white. It is clearer and more consistent than a photograph of a coloured object,
  and it is the project's own work, credited as such.
- **A word with no picture that passed review is kept**, flagged `hasImage: false`. It is left out
  of every activity that needs a picture and still used where no picture is needed. `IMAGE_TODO.md`
  lists these words; a picture can be added in the app under Settings, Word management.

## Offline

- Pictures are **not** in the service worker precache. They are fetched by an explicit, resumable
  download step into a named cache (`smrt-images-v1`) that the service worker serves cache-first.
  This gives the visible progress bar and verified count the brief asks for.

## Visual design system (asset pack integration)

The look of the app comes from `SMRT_Speech_Visual_Asset_Pack/` (plum and coral, light and dark
themes). The build brief still decides features and workflows; the pack decides appearance only.

- **Asset installation.** `npm run assets` (`tools/assets/sync.ts`) copies the pack's SVG artwork,
  app icons and the two app-shell backgrounds to `public/smrt-assets/`, keeping the pack's relative
  paths, and fails if any manifest file is missing. A unit test checks the installed files are
  identical to the pack's and that all 4 modules and 15 activities have artwork.
- **SVG only for icons.** The pack's PNG and JPEG icon variants are not installed: SVG is the pack's
  preferred format and is sharp at any size. The supplied PNG app icons (180, 192, 512) are used for
  the home-screen icon and web manifest.
- **Interface icons are drawn inline from the pack's own vectors.** The pack's icons have a fixed
  plum stroke, which would vanish on dark surfaces and on filled plum buttons. `sync.ts` therefore
  writes `src/ui/smrt-icons.ts`: each icon's line drawing, unchanged, with the stroke set to
  `currentColor`. `src/ui/Icon.tsx` maps the app's icon names to pack assets. Nothing is redrawn and
  no other icon set is used.
- **Module and activity artwork is used as files** (`<img>` from `public/smrt-assets/`), on its own
  cream rounded square, which reads correctly on both light and dark surfaces.
- **Tokens.** `src/ui/smrt-tokens.css` is the pack's token file, unchanged (a test compares them).
  `src/ui/theme.css` adds a small number of documented extension tokens: a darker control outline
  (`--smrt-border-strong`, because the pack border is under 3:1 against white), text colours for
  filled plum and green surfaces, soft tints for notices and tags, a progress-track colour and a soft
  tint per module. It then maps the app's own short variable names onto the pack's variables.
- **Themes.** Settings, Appearance offers Light, Dark and Match this iPad. The choice is saved with
  the other settings (and so travels in a backup); a copy in `localStorage` lets the theme apply
  before storage has been read. Changing theme touches no data and no session state.
- **The therapy canvas is always light.** The session frame carries its own `data-theme="light"`
  and a white background, so activities are white with dark text in either theme and pictures are
  never inverted. The pack's `therapy-light.jpg` and `therapy-dark.jpg` backgrounds are deliberately
  not installed: the pack's own screen map says the therapy canvas must be flat white.
- **Decorative backgrounds** (`backgrounds/light.jpg`, `dark.jpg`) are used on the app shell only
  (home, management, settings).
- **Module colours** (mauve, coral, blue, sage) mark Comprehension, Naming, Reading and Writing as a
  coloured bar and tint. They always appear with the module's artwork and name, never alone.
- **Focus ring.** The pack's coral outline is kept, with a plum inner ring added so the focus
  indicator has at least 3:1 contrast on every surface.
- **Maskable icon.** `public/icons/icon-maskable-512.png` is generated from `branding/app-icon.svg`
  with square corners, because a maskable icon must fill the whole square.
- **Reports.** PDFs are drawn directly by jsPDF (no screenshots) in the light plum palette, whatever
  theme is on screen. Printing forces the light palette too.
- **Charts** take their series colours from the pack tokens, so they follow the theme. Each series
  also has its own marker shape and line style.
- **Contrast is tested.** `tests/unit/contrast.test.ts` checks every text and control-edge colour
  pair the app uses, in both themes, against WCAG AA.
- **Text size.** Body text, activity text and Describe prompts are 20 px or larger. Some
  therapist-facing secondary text is smaller: help lines and captions (17 px), data tables (18 px),
  tags (16 px) and the row of cue buttons in Naming Practice (18 px, so seven fit on one line).
- **Provenance.** The pack's icons, brand mark and backgrounds were created for this project (see
  the pack's integration prompt). `previews/design-direction-reference.png` is AI-generated concept
  art and is not used by the app.
