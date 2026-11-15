# SMRT Speech: handover

SMRT Speech is a word-level language practice toolkit for use by a speech and language therapist.
It runs in Safari on an iPad, installs to the home screen, and works with no internet connection
after the first load. It does not diagnose or treat any condition, and the Naming Test is an
informal screen, not a standardised assessment.

## 1. Where it is

- **Live app:** https://riddoch56-droid.github.io/smrt-speech/
- **Source:** https://github.com/riddoch56-droid/smrt-speech
- Every push to the `main` branch runs the unit tests and content checks, builds the app and
  publishes it (`.github/workflows/deploy.yml`).

## 2. Install on the iPad

1. Open the live address in **Safari** (not another browser).
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Open SMRT Speech from the home screen icon. Always use that icon from now on: the home-screen
   app keeps its own data, separate from Safari.
4. Follow the three welcome steps. Step 3 downloads the pictures for offline use: wait until it
   says **Ready for offline use: 557 of 557 pictures**. Keep the iPad online and the app open
   until it does. If the download stops, choose **Resume download**.
5. Turn on aeroplane mode once and check an activity opens with its pictures.

## 3. Day to day

- **Patients** are identified by an ID code only. Never enter a name. Choose **Guest** to practise
  with nothing saved.
- **Privacy lock:** set a PIN under Settings, Privacy lock. Once a session has started, Patients,
  History, Reports and Settings ask for the PIN. There is no way to recover a forgotten PIN except
  restoring a backup onto a fresh install, so keep it somewhere safe.
- **Reports:** a session PDF or CSV from the results screen or from History; a progress report
  (PDF or CSV) from a patient's History. Files are named
  `SMRTSpeech_<patientID>_<activity>_<date>` and go to the iPad share sheet.
- **Theme:** Settings, Appearance offers Light, Dark and Match this iPad for menus, records and
  settings. Activities are always white with dark text.

## 4. Backing up and restoring

All data lives on the iPad only. If the app is deleted, or Safari website data is cleared, the
data goes with it. Back up regularly.

- **Back up:** Settings, Backup, **Back up now**. Save the file to Files or iCloud Drive. The home
  screen reminds you after 14 days or 20 sessions without a backup.
- **Restore:** Settings, Backup, **Restore from backup**, choose the file. **Add to what is here**
  keeps everything and adds the file's contents. **Replace everything** deletes what is on the iPad
  first and asks you to type REPLACE.
- A backup contains patient ID codes, sessions, notes, custom words and photos, and settings.
  Treat the file as confidential.

## 5. Updating the app

When a new version has been published and the iPad is online, the app shows **Update available**.
Tap it between sessions; it never appears during an activity. Data is not affected. After an update
that changes pictures, open Settings, Offline use and download again if it does not say Ready.

To publish a change: edit, then `git push` to `main`. To check first: `npm test`,
`npm run validate:content`, `npm run build`, `npm run test:e2e`.

## 6. How the suggestions work

After a scored session the results screen makes one suggestion, by fixed rules:

- **90% or more correct with no hints, twice in a row** (this session and the previous saved
  session of the same activity): suggests a step up, for example more choices, Hard difficulty, a
  harder tile level, longer words, or the next activity in the module.
- **50% or less correct:** suggests a step down, the reverse of the above.
- **Anything else:** continue at this level.

"Correct" means right first time with no hint or cue. In Naming, a word produced after a cue is
recorded as "cued" and reported separately. Guest sessions have no history, so they can never
show "twice in a row". The suggestion is a prompt for clinical judgement, not advice.

## 7. Content status

| Content | Amount | Status |
|---|---|---|
| Words | 700 (10 noun groups of 54, 100 actions, 60 describing words) | First draft: needs therapist review |
| Words with a picture | 557 | Each checked by eye twice |
| Naming Test | 30 items, version 1, frozen 14 November 2026 | Needs therapist review |
| Reading phrases | 556 | Written against the actual pictures; needs review |
| Reading sentences | 549 | Written against the actual pictures; needs review |

**`CONTENT_REVIEW.csv`** lists every word (with its cues, semantic and sound prompts) and every
reading item. Please review it: all clinical wording was written for this build and has not been
checked by a clinician. Syllable counts, first and last sounds and rhymes were written by hand.

If the Naming Test list is ever changed, raise `version` in `src/content/screener.json`, so old and
new results are not compared as like for like.

## 8. Pictures

557 of 700 words have a picture. The other 143 are listed in **`IMAGE_TODO.md`**. They are left out
of every activity that needs a picture and still appear where none is needed (Listen and Read,
Spell What You Hear). Add a picture in the app under Settings, Word management, Replace picture.

| Group | With a picture | Without |
|---|---|---|
| Food and drink | 50 | 4 |
| Animals | 54 | 0 |
| Clothing and accessories | 47 | 7 |
| Household objects | 53 | 1 |
| Furniture and rooms | 50 | 4 |
| Body and personal care | 42 | 12 |
| Transport and travel | 53 | 1 |
| Places and buildings | 42 | 12 |
| People and occupations | 36 | 18 |
| Nature, weather and outdoors | 50 | 4 |
| Actions | 53 | 47 |
| Describing words | 27 | 33 |

The first release had 445 pictures after three attempts a word. A fourth, wider search on
15 November 2026 added 112 (see `DECISIONS.md`, Images). The gaps that remain are mostly actions,
describing words and people: openly licensed photographs that show one clear action or property,
of an anonymous person, with nothing unsuitable, are scarce, and four rounds of searching have
now been through what the open sources offer. No picture-generation key was available, so no
pictures were generated.

**Sources:** Wikimedia Commons 513, Openverse 36, drawn by the build 8 (plain colour swatches for
the colour words).

**Licences:** CC BY 275, CC0 147, public domain 56, CC BY-SA 71, made for the app 8. No
NonCommercial or NoDerivatives picture is used. Every picture's source, author and licence is in
`src/content/image-credits.json` and in the app under Settings, Words and pictures, Image credits.

**Share-alike pictures (71, each flagged in the credits file).** A CC BY-SA picture was used only
when no acceptable picture with a more permissive licence was found. Sixteen date from the third
attempt and 55 from the fourth round, where most of the plain, usable photographs of everyday
objects turned out to be share-alike.

- Describing words: broken, flat, melted, mouldy
- Animals: octopus
- Body and personal care: bandage, bone, comb, crutches, finger, hairbrush, knee, shoulder, tissue,
  toe, wheelchair
- Clothing: blouse, cufflinks, earrings, gilet, jeans, jumper, nightie, purse, raincoat, sandals,
  scarf, shirt, vest, waistcoat, wellies
- Food and drink: bun, cauliflower, crumpet, plum, porridge, toast
- Furniture and rooms: blanket, carpet, conservatory, cushion, duvet, pillow, shower, stairs
- Household: mop, torch
- Nature: trunk
- People: baker, farmer, hairdresser, lifeguard, magician, pilot
- Places: allotment, bookshop, campsite, fairground, museum, pub, theatre
- Transport: cone, pram, suitcase, tyre
- Actions: catch, hang, hike, kick, peel, scratch

CC BY-SA asks that adapted versions of a picture carry the same licence. The app credits each one
and resizes it, which the licence allows. If you would rather not carry that condition, replace
these pictures in the app, or delete their files and rerun `npx tsx tools/images/finalise.ts`,
which moves the words back to `IMAGE_TODO.md`.

**Design artwork** (icons, the SMRT Speech mark, backgrounds) comes from
`SMRT_Speech_Visual_Asset_Pack/` and was made for this project. It is separate from the vocabulary
pictures.

## 9. Test results

Run on 15 November 2026 against the production build, after the fourth picture round.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 388 passed, 0 failed (15 files) |
| Content validation (`npm run validate:content`) | Passed: 0 errors, 72 warnings (1 for the 143 words without a picture, 71 for the share-alike pictures) |
| TypeScript and ESLint (part of `npm run build`) | Clean |
| End to end (`npm run test:e2e`) | 35 passed, 0 failed |

The 35 end-to-end tests are:

- all 15 activities played from start to results in WebKit at iPad landscape size (1180 x 820),
  each also checking that no request leaves the app's own address;
- the same 15 at iPad portrait size (820 x 1180);
- a patient session saved to history and exported as PDF and CSV, guest sessions not stored, and
  the privacy PIN (WebKit);
- backup exported and restored on a clean install (WebKit);
- offline: after the first load and picture download, the app reloads with the network disabled
  and completes a session with pictures (Chromium).

The offline test runs in Chromium only. Playwright's WebKit build for Windows does not answer
Cache Storage calls, so the picture download cannot be exercised there. **Offline use in Safari on
an iPad has therefore not been verified by a test** and is the first thing to check on the device
(section 2, steps 4 and 5). If picture storage ever fails to respond, the app now says so after 12
seconds instead of waiting.

The unit tests include checks on the design system: the installed artwork matches the asset pack,
all 4 modules and 15 activities have artwork, every icon name maps to a pack icon, and every text
and control-edge colour pair meets WCAG AA contrast in both themes.

**The deployed site was checked after the first release** (14 November 2026, 445 pictures): the page, web manifest,
service worker, artwork and pictures are all served from the live address; in WebKit a reading
session ran from start to results with no request to any other address and no script errors; in
Chromium the 445 pictures downloaded and a session then ran with the network switched off. That
offline check passed three times out of four: the one failure came straight after publishing and
did not recur.

Screens were also checked by eye from screenshots in both themes, at 1180 x 820, 1024 x 768,
820 x 1180 and 768 x 1024.

## 10. Not verified, and known limitations

Nothing here has been tried on a real iPad. The end-to-end tests run in Playwright's WebKit engine
at iPad sizes on a desktop computer, which is close to Safari but not the same. Please check these
on the device:

- **Voices:** the app uses the iPad's built-in speech. It prefers a British English voice and
  warns if none is installed (Settings, Accessibility, Spoken Content, Voices on the iPad).
- **Add to Home Screen**, the offline download, and reopening the app in aeroplane mode.
- **The share sheet** for PDFs, CSVs and backups.
- **Recording** in Naming and custom words (microphone permission).
- **Camera and photo library** for custom words.
- **Dragging letter tiles** with a finger in the Writing activities.
- **Storage:** iPadOS can clear the data of a website that has not been used for some weeks. The
  app asks for persistent storage, and installing to the home screen helps, but backups are the
  real protection.

Other limitations:

- Adjective pictures show a typical example (a snail for "slow", burnt toast for "burnt"). They
  suit comprehension better than naming.
- Some pictures show non-UK examples (for instance a passport and a lorry from other countries).
- Some therapist-facing secondary text is smaller than 20 px (see `DECISIONS.md`).
- Openly licensed photographs of people show real individuals. Close portraits of identifiable
  people in an official role were excluded, but please look through the People group.

## 11. Decisions that need a human

1. **Clinical review** of `CONTENT_REVIEW.csv` and of the 30 Naming Test items.
2. **The 71 share-alike pictures:** keep or replace (section 8).
3. **The 143 words without a picture:** add your own photographs in the app, supply a
   picture-generation key and extend the pipeline, or leave them out. Further searching of the
   open sources is unlikely to add many more.
4. **Faster picture sourcing:** Wikimedia allows far more searches per minute to clients that give
   a contact address. Adding one to `USER_AGENT` in `tools/images/lib.ts` is your choice; the build
   did not send any personal details.
5. **Repository visibility:** the repository is public, as GitHub Pages on a free account requires.
   It contains no patient data and no practitioner details; those are entered in the app and stay
   on the iPad.

See `DECISIONS.md` for the reasoning behind choices made during the build.
