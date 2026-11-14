# SMRT Speech: build brief for Claude Code

You are building a complete, production-quality iPad web app called **SMRT Speech** in this folder, from an empty directory to a live, installable, offline-capable app. Work through the whole brief autonomously. Do not stop to ask questions unless you hit one of the hard blockers listed in section 16. Where the brief leaves a detail open, make a sensible decision, record it in `DECISIONS.md`, and continue.

Read the entire brief before writing any code.

---

## 1. What SMRT Speech is

SMRT Speech is a word-level language therapy toolkit for adults with aphasia and related communication difficulties. It is used by one speech and language therapist in private practice, on her own iPad, sitting with a patient. It covers four areas, each a module with several activities:

1. **Comprehension** (listening and reading comprehension of single words)
2. **Naming** (spoken word finding)
3. **Reading** (phrase and sentence reading comprehension)
4. **Writing** (single-word spelling with letter tiles)

The four modules share one picture vocabulary of about 700 words, one settings system, one scoring engine, and one patient history and reporting system.

The general category of app (four-skill, word-level aphasia therapy with photo stimuli, cueing, automatic scoring and reports) is well established. SMRT Speech must be an **original implementation**. See section 2.

## 2. Non-negotiable rules

1. **Originality.** Do not copy the name, branding, layout, wording, word lists, cue text, images, audio or any other asset from any existing commercial therapy app. Do not scrape or reference such apps while building. Write all vocabulary, cues, phrases and sentences yourself. Design an original visual identity.
2. **Image licensing.** Every bundled image must be either generated for this project or openly licensed for commercial use and modification. Never use Google Images results, stock-site previews, watermarked images, or anything of unknown licence. See section 6.
3. **Fully offline.** After the first successful load, every feature must work with no network connection at all. No CDNs, no web fonts fetched at runtime, no analytics, no telemetry, no third-party requests of any kind.
4. **Privacy.** All patient data stays on the device in browser storage. Nothing is ever transmitted. Patients are identified by an ID code only. The public repository must contain no patient data and no real person's name: the practitioner's details are entered inside the app at first run, never hard-coded.
5. **UK English.** All interface text, vocabulary, spellings and vocabulary choices are British English (lorry, jumper, trainers, nappy, crisps, tap, bin, pavement, colour). Speech uses a UK English voice.
6. **Aphasia-friendly design.** Large targets, minimal text, plain backgrounds, no time pressure, gentle feedback. See section 11.
7. **No clinical claims.** The app must not claim to diagnose, treat or improve any condition. The naming screener is described as an informal screen, not a standardised assessment.
8. **iPad first.** Target iPadOS Safari running as a Home Screen web app, in both landscape and portrait, from 1024x768 up to 1366x1024 points. It must also work in desktop Chrome and Edge for development and testing.

## 3. Technology

Use this stack unless you find a concrete technical reason not to, in which case record the reason in `DECISIONS.md`:

- **Vite + React + TypeScript** (strict mode).
- **vite-plugin-pwa** (Workbox) for the service worker and web app manifest.
- **Dexie** (IndexedDB) for all persistent data.
- **jsPDF** with **jspdf-autotable** for PDF reports, bundled locally.
- **Zustand** or React context for state. Keep it simple.
- Plain CSS modules or a single hand-written design-token stylesheet. No runtime CSS framework from a CDN.
- **Vitest** for unit tests, **Playwright** (WebKit, iPad viewport) for end-to-end tests.
- **sharp** for image processing in build-time scripts.
- Charts: hand-rolled SVG components. Do not add a heavy chart library.

Project conventions:

- Vite `base` must be set so the app works when served from `https://<user>.github.io/<repo>/`. All asset, manifest, service worker and router paths must be relative to that base. Use hash-based routing so deep links survive on GitHub Pages.
- Keep build-time tooling (image sourcing, content validation) in `tools/`, separate from app code in `src/`.
- Content lives in typed JSON or TypeScript data files under `src/content/`, validated by a script (`npm run validate:content`) that fails the build on any error.

## 4. Vocabulary content

Author an original vocabulary of **700 words**:

| Group | Count |
|---|---|
| Food and drink | 54 |
| Animals | 54 |
| Clothing and accessories | 54 |
| Household objects | 54 |
| Furniture and rooms | 54 |
| Body and personal care | 54 |
| Transport and travel | 54 |
| Places and buildings | 54 |
| People and occupations | 54 |
| Nature, weather and outdoors | 54 |
| Verbs (pictured actions) | 100 |
| Adjectives (pictured properties) | 60 |

Selection rules: common, concrete, highly imageable, everyday adult vocabulary relevant to life in the UK. Spread across word lengths (3 to 10+ letters) and syllable counts (1 to 5). Avoid childish items, brand names, and anything hard to picture unambiguously. Avoid pairs that would share an indistinguishable picture.

Each word record must include:

```ts
interface Word {
  id: string;                 // stable slug, e.g. "food-apple"
  word: string;               // UK spelling, lower case unless a proper noun
  group: GroupId;             // one of the 12 groups above, or a custom category
  subgroup: string;           // finer semantic cluster, e.g. "fruit", used for hard foils
  wordClass: "noun" | "verb" | "adjective";
  letters: number;            // letter count excluding spaces and hyphens
  syllables: number;
  frequencyBand: 1 | 2 | 3;   // 1 = most common
  multiWord: boolean;         // e.g. "ice cream"
  childFriendly: boolean;     // false for alcohol, weapons, smoking, adult themes
  image: string;              // file name in the image set
  imagePrompt: string;        // plain description used to source or generate the image
  cues: {
    definition: string;       // "You wear it on your head to keep warm."
    sentenceCompletion: string; // "In winter I wear a woolly ___."
    firstLetter: string;
    firstSoundSpoken: string; // how the speech engine should say the first sound, e.g. "huh"
    firstSyllable?: string;
  };
  semantic: {                 // for the Describe activity, meaning prompts
    category: string;         // "It is a type of clothing."
    use: string;
    action: string;
    properties: string;
    location: string;
    association: string;
  };
  phonological: {             // for the Describe activity, sound prompts
    firstSound: string;
    lastSound: string;
    syllables: number;
    rhyme: string | null;
    sameFirstSound: string;   // another word starting with the same sound
  };
}
```

The cue and feature structure follows the standard published clinical approaches of cueing hierarchies, Semantic Feature Analysis and Phonological Components Analysis. Write every cue yourself in plain, adult, respectful language. A cue must never contain the target word.

Also author:

- **Naming screener:** a fixed, frozen list of 30 pictured nouns and verbs, balanced across groups and graded from easier to harder (frequency and length). Stored in its own file with a version number so results stay comparable over time.
- **Reading content:** at least 200 phrase items and at least 200 sentence items, each tied to a specific image. See section 7.3. Write these **after** the images are final, while looking at each image, so the text is true of the picture.

Produce `CONTENT_REVIEW.csv` (word, group, all cues, phrase and sentence text) so the therapist can review and correct the clinical content outside the app.

## 5. Shared session mechanics

These apply across activities unless an activity says otherwise.

**Before a session**, a settings sheet for that activity lets the therapist choose: word groups (multi-select, including custom categories), number of trials (10, 20, 30, or continuous until stopped), and the activity-specific settings. The last settings used are remembered per patient per activity.

**Global settings** (in the Settings screen):

- Auto-advance: on (moves on after a correct answer and a short pause) or off (shows a Next button).
- Show score during the session: on or off. Scores are always recorded and always appear in reports.
- Child-friendly: hides words where `childFriendly` is false.
- Sound effects: on or off.
- Voice: choose from the installed English voices, with a Test button and a speech rate slider. See section 12.
- Letter sounds for tiles: letter names spoken, click only, or silent.
- Word management: browse all words, switch individual words off, replace a picture.
- Custom-word foils: Full (custom words can appear alongside built-in words as wrong choices) or Limited (custom categories only use their own words as foils).

**Scoring model.** Every trial records: word ID, activity, the choices shown, each response with a timestamp, first-attempt correctness, hints used, cues used (by type and order), number of attempts, and response time. A trial counts as **correct** only if the first response was right and no hint was used. If a hint was used or the first response was wrong, the trial is scored **incorrect** but the patient continues until they reach the right answer, so every trial ends on success (errorless completion).

**Feedback.** Correct: a green tick, a soft chime, the target is highlighted and spoken. Incorrect choice: the wrong option fades and shakes gently, with a soft neutral tone. Never use harsh buzzers, red crosses filling the screen, or countdown timers.

**Results screen** after each session: accuracy, hints and cues summary, items missed, a plain-language recommendation, and buttons for Repeat, Practise missed items, View report, and Done.

**Recommendations** are rule-based, shown on the results screen and printed in the report. Implement and document at least:

- 90% or more correct with no hints, twice in a row: suggest the next step up (more choices, Hard difficulty, longer words, fewer tiles given, or the next harder activity in the module).
- 50% or less: suggest the next step down.
- Between: suggest continuing at this level.

**Practice without saving.** A guest mode runs any activity without a patient selected and stores nothing.

## 6. Images

One square image per word, plus any extra images needed for reading sentences.

**Style target:** a clear, realistic photograph (or photorealistic render) of a single subject, centred, on a plain white or very light neutral background, evenly lit, no text, no watermark, no visible brand names or logos, no recognisable public figures. Verbs show one person clearly performing the action. Adjectives show the property unmistakably (for example a broken plate for "broken").

**Sourcing pipeline** (build-time scripts in `tools/images/`):

1. If the environment variable `OPENAI_API_KEY` is set, generate images with the current OpenAI image generation API. Check the current API documentation for the correct model name and parameters; do not rely on memory. Use each word's `imagePrompt` with the shared style description.
2. Otherwise, source openly licensed images from the **Openverse API** and the **Wikimedia Commons API**. Read their current documentation, send a descriptive User-Agent, and respect rate limits. Accept only **CC0**, **Public Domain Mark** and **CC BY** licences. Use CC BY-SA only as a last resort and flag it. Never accept NC or ND licences, and never accept an image with an unclear licence.
3. A mixed set is acceptable. Prefer visual consistency where there is a choice.

**Processing:** convert each image to a 512x512 WebP, fitted (not cropped through the subject) on a white background, quality around 78, target 60 KB or less per image. The total image set must stay under 60 MB.

**Licence record:** write `src/content/image-credits.json` with, for every image: source, source URL, author, licence, licence URL, date retrieved, and modifications made. Generated images are recorded as generated, with the prompt. The app shows this on an "Image credits" screen in Settings.

**Quality control:** build labelled contact sheets (for example 20 images per sheet) and look at every one. For each image confirm that it shows the target clearly, that a naive viewer would name it with the target word, and that it could not be confused with another word in the set. Replace failures, up to three attempts per word. Any word still without a good image is listed in `IMAGE_TODO.md`, flagged `hasImage: false`, and automatically excluded from picture-dependent activities until a picture is added in the app.

## 7. The four modules

### 7.1 Comprehension

| Activity | Stimulus | Choices |
|---|---|---|
| Listen | spoken word | pictures |
| Read | written word | pictures |
| Listen and Read | spoken word | written words |

Settings:

- **Number of choices:** 2, 3, 4, 5, 6, or Auto. Auto starts at 2, goes up by one after three consecutive correct trials, down by one after two consecutive incorrect trials, clamped to 2 to 6.
- **Difficulty:** Easy draws foils from different groups. Hard draws foils from the same subgroup or group. For Listen and Read on Hard, foils are also similar in spelling or sound (same first letter, similar length).
- A **Repeat** button replays the spoken word in the listening activities.
- **Hint:** Listen shows the written word; Read speaks the word; Listen and Read shows the picture.

Lay choices out in a balanced grid sized to the field (2 side by side, 3 in a row, 4 as 2x2, 5 and 6 in two rows), randomised each trial with the target position balanced across the session.

### 7.2 Naming

**Naming Practice.** Shows a picture. The patient tries to say the word. Six cue buttons are always available, in this order, and the therapist or patient may take any cue at any time:

1. Description (definition, shown and spoken)
2. Sentence completion (shown and spoken, with a blank)
3. First letter (shown)
4. First sound (spoken)
5. Written word (shown)
6. Spoken word (the full word is spoken, for repetition)

The response is self-scored with two large buttons, a tick and a cross. The record keeps which cues were used before a correct response, so reports can show which cue types help most. Outcomes: correct without cues, correct with cues, incorrect. A **Record** button captures the patient's attempt and plays it back next to the model for comparison. Recordings are held in memory for that trial only and are never saved.

Extra setting: **syllable filter** (1, 2, 3, 4, 5+).

**Describe.** Shows a picture surrounded by prompt cards. A setting chooses Meaning prompts, Sound prompts, or both.

- Meaning: group, use, action, properties, location, association.
- Sound: first sound, last sound, number of syllables, rhyme, another word with the same first sound.

Each card can be tapped to reveal and speak the stored model answer. The therapist marks each card as said independently, said after the reveal, or not said. The trial ends with a naming attempt, scored with tick or cross.

**Naming Test.** The fixed 30-item screener: fixed order, no cues, no feedback, tick or cross scored by the therapist, with a Skip option scored incorrect. The result shows the total and a breakdown by group, with the weaker groups highlighted. Repeat tests are compared over time in the patient history. Label it clearly as an informal screen.

**Flashcards.** A free-practice deck with toggles for show picture, show word, speak word on reveal, shuffle, and optional tick or cross scoring. Next and Back by buttons or swipe. Record and playback available.

### 7.3 Reading

All four activities show a picture with written choices. Number of choices: 2, 3 or 4.

- **Phrase Matching:** choose the phrase that matches the picture (for example "a cup of tea").
- **Phrase Completion:** the phrase has its last word missing; choose the missing word.
- **Sentence Matching:** choose the sentence that matches the picture. Distractors change one element (who, action, or object), so every option must be read carefully.
- **Sentence Completion:** a sentence with one word missing; choose the word. Distractors are plausible and semantically related.

Each phrase and sentence item stores its target and at least three authored distractors. Text must be true of the specific image.

Setting **Read aloud:** Hint only (the Hint button reveals speaker buttons beside each option, and using one scores the trial incorrect) or Always on (speaker buttons always visible, no penalty).

### 7.4 Writing

All four activities use letter tiles and answer slots. Multi-word items are excluded.

- **Fill in the Blank:** picture and word with one letter missing.
- **Copy:** picture and the whole word shown as a model; spell it with tiles.
- **Spell What You See:** picture only.
- **Spell What You Hear:** spoken word only, with a Repeat button.

Settings:

- **Tile level:** Easy (only the letters needed, shuffled), Medium (needed letters plus three or four extra), Hard (the full alphabet).
- **Word length:** toggles for 3, 4, 5, 6, 7, 8, 9 and 10+ letters.

Behaviour:

- Tiles can be dragged into any slot or tapped. A tapped tile fills the leftmost empty slot. Tapping a placed tile returns it.
- Implement dragging with pointer events. HTML5 drag and drop does not work reliably on touch devices.
- When all slots are full a **Check** button appears. Pressing it enters a review step: "Look at your word. Is it right?" with **Change** and **Submit**. Only Submit triggers marking. This is deliberate self-monitoring practice.
- On Submit, correct letters lock in place, wrong letters return to the pool, and the patient continues until correct. The trial is scored on the first Submit.
- **Hint:** removes the extra tiles, then on further presses places the next correct letter. Any hint scores the trial incorrect.

## 8. Patients, history and reports

**Practitioner profile** (Settings, entered at first run): name, credentials, practice name, and an optional contact line. Used only in report headers. There is one practitioner.

**Patients.** A patient record has an ID code (required, unique, free text such as "SS-014"), an optional date added, an archived flag, and optional notes. The ID field shows helper text: "Use an ID code, not a name." Screens: list with search, add, edit, archive, delete (with a typed confirmation).

**Privacy lock.** An optional 4-digit PIN protects the patient list, history, reports and Settings, so a patient holding the iPad during a session cannot browse other records. Store only a salted hash (Web Crypto). Leaving a running session to reach protected screens asks for the PIN. Describe it honestly in the app as a privacy screen, not strong security. A forgotten PIN can be reset by typing a confirmation word, without deleting data.

**History**, per patient:

- Session list, filterable by module, activity and date range.
- Accuracy over time per activity (line chart).
- Breakdown by word group.
- For Naming: which cue types preceded success, and screener results over time.
- Session detail view with the item-by-item record and an editable session note.

**Reports.** Two PDF types, A4 portrait:

1. **Session report:** header (SMRT Speech, practitioner details), patient ID, date and time, duration, module and activity, all settings used, accuracy (correct out of total, percentage), hints used, cue breakdown where relevant, breakdown by word group, an item-by-item table (target, response or choices made, result, hints and cues, time taken), the recommendation, and the session note.
2. **Progress report:** for a chosen patient, date range and set of activities: sessions completed, accuracy trend charts, group breakdown, screener comparison, and a summary table.

Every page has a footer with page numbers, the generation date, and the line "Informal therapy data. Not a standardised assessment."

**Export.** Reports are generated on the device. The Export button uses the Web Share API with a File so the iPad share sheet offers Save to Files, Mail, AirDrop and Print. Fall back to opening the PDF in a new view or downloading it where sharing is unavailable. Also offer CSV export of the same data. File names follow `SMRTSpeech_<patientID>_<activity>_<YYYY-MM-DD>.pdf`.

## 9. Custom content

- **My Words:** add a word with a photo from the camera or photo library. Crop to square, downscale to 512 px, store as a Blob in IndexedDB. Optional fields: group or custom category, cues, and a recorded audio clip that replaces the synthesised voice for that word.
- Custom words can be available to all patients or assigned to one patient.
- Custom categories can be created, renamed and deleted.
- **Custom reading items:** add a phrase or sentence with distractors and a photo.
- **Replace picture:** any built-in word's picture can be replaced with a photo.
- Custom content is included in backups.

## 10. Data storage and backup

- All data in IndexedDB through Dexie with explicit, versioned schema migrations.
- Call `navigator.storage.persist()` on first run and show the storage status in Settings.
- **Backup:** export everything (patients, sessions, settings, custom words, custom images and audio) as a single file through the share sheet. **Restore:** import that file, with a clear warning and a choice to merge or replace.
- Remind the therapist to back up when it has been 14 days or 20 sessions since the last backup.
- Settings explains plainly that removing the app icon from the Home Screen deletes all data, so a backup should be made first.

## 11. Design

- Create an original, calm, professional identity for SMRT Speech: a small palette (one primary, one accent, neutrals), an original app icon, and a simple wordmark. Supply the icon as SVG and generate all required PNG sizes for the manifest and for `apple-touch-icon`.
- Use the system font stack. Minimum body size 20 px; stimulus words much larger.
- Touch targets at least 60x60 points with generous spacing.
- White or near-white activity backgrounds. Nothing decorative on activity screens.
- Buttons carry an icon and a short label. Controls keep the same position on every activity screen: Home and progress at the top, Hint and Repeat at the bottom.
- Contrast meets WCAG AA. Never rely on colour alone: pair it with icons and shape.
- Respect `prefers-reduced-motion`.
- Home screen: four module tiles, each opening its activities ordered easiest to hardest, with the current patient shown at the top and a clear way to switch patient or use guest mode.
- Support landscape and portrait, and honour safe-area insets.
- Disable text selection, the long-press callout, double-tap zoom and pull-to-refresh bounce on activity screens.

## 12. iPad and offline behaviour

- **Manifest and meta tags:** `display: standalone`, relative `start_url` and `scope`, theme and background colours, icons, plus the Apple meta tags and `viewport-fit=cover`.
- **Offline content:** the service worker precaches the app shell. On first run, an explicit content download step caches every image with a visible progress bar and a final verified count ("Ready for offline use: 700 of 700 pictures"). Settings shows offline readiness and the app version. The download can be resumed and re-verified.
- **Updates:** when a new version is available and the device is online, show an unobtrusive "Update available" prompt. Never interrupt a session to update.
- **Speech:** use `speechSynthesis`. Choose an `en-GB` voice, preferring local voices. Voices load asynchronously on iOS, and the first utterance must be triggered from a user gesture, so prime speech on the first tap. Cancel any current utterance before speaking a new one. Default rate slightly slower than normal. If no UK voice is installed, say so in Settings and explain how to add one in the iPad's own settings.
- **Sound effects:** synthesise with the Web Audio API or bundle very small files. Unlock audio on the first touch.
- **Recording:** `getUserMedia` plus `MediaRecorder`, detecting the supported MIME type at runtime. Handle permission refusal gracefully: recording buttons are hidden and everything else still works.
- **PDF sharing:** check `navigator.canShare` with files before using the share sheet.
- Request a Screen Wake Lock during sessions where supported.

## 13. Suggested structure

```
src/
  app/            routing, layout, providers
  content/        words, reading items, screener, image credits
  modules/
    comprehension/
    naming/
    reading/
    writing/
  session/        trial engine, scoring, foil selection, recommendations
  patients/
  history/
  reports/        pdf and csv generation
  custom/         my words, custom categories
  settings/
  platform/       speech, audio, recording, storage, share, wake lock
  ui/             shared components and design tokens
tools/
  images/         sourcing, processing, contact sheets
  content/        validation, review export
tests/
  unit/
  e2e/
```

Keep the trial engine, scoring, foil selection, auto-adjust and recommendation logic as pure, unit-tested functions, separate from React components.

## 14. Testing

- **Unit tests** for: scoring rules, hint and cue accounting, foil selection on Easy and Hard, auto-adjusting field size, tile and slot logic, word filters, recommendation rules, report aggregation, backup and restore round trip, and content validation.
- **End-to-end tests** (Playwright, WebKit, iPad viewport): complete a short session in each of the 15 activities; create a patient and confirm the session appears in history; generate a session PDF and a progress PDF and confirm they are non-empty; reload with the network disabled and complete a session offline; export and restore a backup.
- `npm run validate:content` must pass: 700 words, no duplicate IDs, every field present, no cue containing its target word, every enabled word has an image file and a credits entry, image sizes within budget.
- `npm run build` must finish with no TypeScript errors and no lint errors.

## 15. Deployment

Deploy to **GitHub Pages** from a **public** repository using a GitHub Actions workflow.

1. Check `git --version`, `node --version` and `gh auth status`.
2. Initialise the repository and commit as you go, one meaningful commit per phase at least.
3. Create the remote with `gh repo create smrt-speech --public --source=. --push`. If the name is taken on this account, use `smrt-speech-app`.
4. Add `.github/workflows/deploy.yml` that installs, runs unit tests and content validation, builds, and deploys with the official Pages actions.
5. Enable Pages with GitHub Actions as the source (via `gh api`), then confirm the workflow run succeeds.
6. Fetch the live URL and verify that the app, the manifest, the service worker and a sample image all return successfully.
7. Add `<meta name="robots" content="noindex">` so the site is not indexed.
8. Add a `.gitignore` covering `node_modules`, build output, `.env` files and raw unprocessed image downloads. Never commit an API key.

## 16. How to work

**Phases.** Work in this order and keep `PROGRESS.md` updated after every phase, with what is done, what is next, and any open issues, so that a fresh session can resume from that file alone:

1. Scaffold, tooling, design tokens, app shell, PWA basics, CI workflow.
2. Platform services: storage, speech, audio, recording, share.
3. Vocabulary authoring and content validation.
4. Image pipeline, sourcing, processing, credits, visual quality control.
5. Session engine and shared settings.
6. Comprehension module.
7. Naming module.
8. Writing module.
9. Reading content authoring (using the final images) and Reading module.
10. Patients, privacy lock, history, charts.
11. Reports: PDF, CSV, share.
12. Custom content and word management.
13. Backup, restore, offline content download, update flow.
14. Full test pass, accessibility pass, polish.
15. Deploy and verify.
16. Handover documents.

If you run low on context, finish the current unit of work, commit, update `PROGRESS.md`, and say clearly that the next session should start with "Read SMRT_SPEECH_BUILD_PROMPT.md and PROGRESS.md and continue."

**Hard blockers** (the only reasons to stop and ask):

- Node.js, Git or the GitHub CLI is missing, or `gh` is not signed in. Give the exact command to fix it.
- Neither image route works at all (no API key and the open-licence APIs are unreachable).
- A destructive action would be needed outside this project folder.

**Never** fabricate a licence, an attribution or a test result. If something could not be done or verified, say so in `HANDOVER.md`.

## 17. Handover

Finish by writing:

- `README.md`: what the app is, how to run, test, build and deploy it.
- `HANDOVER.md`: the live URL; step-by-step iPad installation; how to update the app later; how backup and restore work; the recommendation rules; known limitations; anything not completed or not verified; and the contents of `IMAGE_TODO.md` summarised.
- `DECISIONS.md`: every notable decision and assumption.
- `CONTENT_REVIEW.csv`: for the therapist's clinical review.

Then give a short final summary: the live URL, test results, the number of words with verified images, the image source mix and licences, and the list of anything that needs a human decision.

## 18. Definition of done

- All 15 activities across the four modules work as specified on an iPad-sized WebKit viewport, in landscape and portrait.
- 700 authored words, validated; images present for as many as passed quality control, with the remainder listed in `IMAGE_TODO.md` and excluded cleanly.
- Every image has a recorded source and licence, visible in the app.
- Patients by ID code, saved history, charts, session and progress PDFs, CSV export, share sheet export.
- Custom words, custom photos, picture replacement, word switching.
- Backup and restore proven by an automated round-trip test.
- The app loads and runs a full session with the network disabled.
- No network request is made at runtime to any third party.
- Unit tests, end-to-end tests, content validation and the production build all pass.
- The app is live on GitHub Pages and the URL has been verified.
- Handover documents are complete and honest about any gaps.
