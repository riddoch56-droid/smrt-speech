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
   says **Ready for offline use: 639 of 639 pictures**. Keep the iPad online and the app open
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
| Words with a picture | 639 | Each checked by eye twice |
| Naming Test | 30 items, version 1, frozen 14 November 2026 | Needs therapist review |
| Reading phrases | 638 | Written against the actual pictures; needs review |
| Reading sentences | 631 | Written against the actual pictures; needs review |

**`CONTENT_REVIEW.csv`** lists every word (with its cues, semantic and sound prompts) and every
reading item. Please review it: all clinical wording was written for this build and has not been
checked by a clinician. Syllable counts, first and last sounds and rhymes were written by hand.

If the Naming Test list is ever changed, raise `version` in `src/content/screener.json`, so old and
new results are not compared as like for like.

## 8. Pictures

639 of 700 words have a picture. The other 61 are listed in **`IMAGE_TODO.md`**. They are left out
of every activity that needs a picture and still appear where none is needed (Listen and Read,
Spell What You Hear). Add a picture in the app under Settings, Word management, Replace picture.

| Group | With a picture | Without |
|---|---|---|
| Food and drink | 53 | 1 |
| Animals | 54 | 0 |
| Clothing and accessories | 51 | 3 |
| Household objects | 54 | 0 |
| Furniture and rooms | 54 | 0 |
| Body and personal care | 46 | 8 |
| Transport and travel | 54 | 0 |
| Places and buildings | 51 | 3 |
| People and occupations | 46 | 8 |
| Nature, weather and outdoors | 54 | 0 |
| Actions | 73 | 27 |
| Describing words | 49 | 11 |

The first release had 445 pictures after three attempts a word. On 15 November 2026 a fourth,
wider search added 112, and three further rounds (five to seven), each showing a reviewer up to
48 fresh candidates a word, added 82 more (see `DECISIONS.md`, Images). No picture was generated.

The 61 words still without a picture are:

- 27 actions: bathe, chase, cough, cry, drop, floss, fold, frown, give, greet, help, hop,
  interview, kneel, rinse, share, snore, sprinkle, squeeze, taste, tear, tickle, tidy, undress,
  wake, whistle, wink
- 11 describing words: big, full, heavy, loud, new, shiny, short, soft, square, sticky, young
- 8 people: architect, gran, groom, judge, midwife, paramedic, teenager, twins
- 8 body and personal care words: ankle, cheek, flannel, forehead, heel, knuckle, shampoo, thigh
- 7 others: earmuffs, skirt, tights, cream, cafe, clinic, post office

What the open sources offer for these is mostly named or well-known people, pictures of injuries,
brand names, or pictures a viewer would name by the object and not by the word. Seven rounds have
now been through Wikimedia Commons thoroughly. Openverse allows 200 searches a day without an
account, so one more pass there on a later day could add a few.

**Sources:** Wikimedia Commons 575, Openverse 56 (mostly Flickr), drawn by the build 8 (plain colour swatches for
the colour words).

**Licences:** CC BY 301, CC0 159, public domain 65, CC BY-SA 106, made for the app 8. No
NonCommercial or NoDerivatives picture is used. Every picture's source, author and licence is in
`src/content/image-credits.json` and in the app under Settings, Words and pictures, Image credits.

**Share-alike pictures (106, each flagged in the credits file).** A CC BY-SA picture was used only
when no acceptable picture with a more permissive licence was found. Sixteen date from the third
attempt, 55 from the fourth round and 35 from rounds five to seven: most of the plain, usable
photographs of everyday things on Wikimedia Commons turned out to be share-alike.

- Describing words: broken, bumpy, flat, long, melted, mouldy, round, sad, smooth, tall,
  transparent, wet
- Animals: octopus
- Body and personal care: bandage, bone, comb, crutches, finger, hairbrush, knee, shoulder, tissue,
  toe, toenail, wheelchair
- Clothing: blouse, cufflinks, earrings, gilet, jeans, jumper, knickers, nightie, purse, pyjamas,
  raincoat, sandals, scarf, shirt, trousers, vest, waistcoat, wellies
- Food and drink: bun, cauliflower, crumpet, plum, porridge, toast
- Furniture and rooms: blanket, carpet, conservatory, cushion, duvet, gate, letterbox, pillow,
  shower, stairs
- Household: charger, mop, torch
- Nature: log, trunk
- People: baker, farmer, gardener, grandad, hairdresser, librarian, lifeguard, magician, mime,
  nurse, optician, pilot
- Places: allotment, bank, bookshop, campsite, chemist, courthouse, fairground, hospital, museum,
  pub, theatre
- Transport: cone, pram, suitcase, tyre, windscreen
- Actions: catch, crawl, follow, hang, hike, kick, listen, peel, scratch, scrub, shout,
  somersault, twist, weigh

CC BY-SA asks that adapted versions of a picture carry the same licence. The app credits each one
and resizes it, which the licence allows. If you would rather not carry that condition, replace
these pictures in the app, or delete their files and rerun `npx tsx tools/images/finalise.ts`,
which moves the words back to `IMAGE_TODO.md`.

**Design artwork** (icons, the SMRT Speech mark, backgrounds) comes from
`SMRT_Speech_Visual_Asset_Pack/` and was made for this project. It is separate from the vocabulary
pictures.

## 9. Test results

Run on 15 November 2026 against the production build, after the seventh picture round.

| Check | Result |
|---|---|
| Unit tests (`npm test`) | 388 passed, 0 failed (15 files) |
| Content validation (`npm run validate:content`) | Passed: 0 errors, 107 warnings (1 for the 61 words without a picture, 106 for the share-alike pictures) |
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

**After the 15 November 2026 update** (557 pictures) the publish workflow succeeded and the live
address was checked by request only: the page, the service worker and a sample of the new pictures
are served, the live page loads the same script bundle as the tested local build, and a new picture
is byte-for-byte the local file. The browser checks above were not repeated against the live
address; they passed against the same build locally.

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
- Some pictures show non-UK examples (for instance a passport and a lorry from other countries,
  a charger in an American socket, and a courthouse, a university and a hotel abroad).
- Some pictures added in rounds five to seven are the best available, not ideal: the chemist is a
  national chain's shop front, "asleep" and "sleep" both show a person sleeping, and each
  describing word shows one typical example. Please look through the 82 newest pictures.
- Some therapist-facing secondary text is smaller than 20 px (see `DECISIONS.md`).
- Openly licensed photographs of people show real individuals. Close portraits of identifiable
  people in an official role were excluded, but please look through the People group.

## 11. Decisions that need a human

1. **Clinical review** of `CONTENT_REVIEW.csv` and of the 30 Naming Test items.
2. **The 106 share-alike pictures:** keep or replace (section 8).
3. **The 61 words without a picture:** add your own photographs in the app, run one more
   Openverse pass on a later day, supply a picture-generation key and extend the pipeline, or
   leave them out.
4. **Faster picture sourcing:** Wikimedia allows far more searches per minute to clients that give
   a contact address. Adding one to `USER_AGENT` in `tools/images/lib.ts` is your choice; the build
   did not send any personal details.
5. **Repository visibility:** the repository is public, as GitHub Pages on a free account requires.
   It contains no patient data and no practitioner details; those are entered in the app and stay
   on the iPad.

See `DECISIONS.md` for the reasoning behind choices made during the build.
