# Vocabulary authoring rules (SMRT Speech)

SMRT Speech is a word-level language therapy toolkit for adults with aphasia, used by a
UK speech and language therapist. You are writing ORIGINAL vocabulary records. Do not copy
word lists, cue wording or any content from any existing therapy app or published word list.
Write everything yourself.

## Output

Write one JSON file: a single array of records, UTF-8, no comments, no trailing commas.
Each record has exactly this shape:

```json
{
  "word": "kettle",
  "subgroup": "kitchen appliances",
  "syllables": 2,
  "frequencyBand": 1,
  "childFriendly": true,
  "imagePrompt": "A stainless steel electric kettle standing on its base",
  "searchQuery": "electric kettle",
  "cues": {
    "definition": "You boil water in it to make a hot drink.",
    "sentenceCompletion": "To make a cup of tea, first I fill the ___.",
    "firstSoundSpoken": "kuh",
    "firstSyllable": "ket"
  },
  "semantic": {
    "category": "It is a kitchen appliance.",
    "use": "You use it to boil water.",
    "action": "It heats up and switches itself off.",
    "properties": "It has a handle, a spout and a lid.",
    "location": "You find it on the kitchen worktop.",
    "association": "It makes me think of tea and coffee."
  },
  "phonological": {
    "firstSound": "k",
    "lastSound": "l",
    "rhyme": "settle",
    "sameFirstSound": "candle"
  }
}
```

## Word selection

- British English spelling and British vocabulary (lorry, jumper, trainers, nappy, crisps,
  tap, bin, pavement, colour, aubergine, courgette, torch, wardrobe).
- Common, concrete, highly imageable, everyday ADULT vocabulary relevant to life in the UK.
  Nothing babyish. No brand names. No proper nouns.
- Every word must be easy to show in ONE clear photograph that a naive viewer would name with
  exactly that word. Avoid pairs whose pictures would be indistinguishable (sofa/couch,
  jumper/sweater, rug/mat): pick one.
- Stay strictly inside your group's boundaries (given in your task) so groups do not overlap.
  No word may appear twice.
- Spread word length from 3 letters to 10+ letters and syllables from 1 to 4 or 5.
  At least 8 words of 3 or 4 letters and at least 6 words of 8+ letters.
- At most 5 multi-word items (e.g. "ice cream"). Lower case throughout. No hyphens unless
  the standard UK spelling needs one.
- Use 6 to 9 subgroups (finer semantic clusters such as "fruit"), each with AT LEAST 6 words.
  Subgroups drive "hard" wrong-answer choices, so words in a subgroup must be related but
  visually distinct.
- `frequencyBand`: 1 = very common everyday word, 2 = common, 3 = less common. Aim for roughly
  a third in each band.
- `childFriendly`: false only for alcohol, smoking, weapons or adult themes.
- `syllables`: count for standard southern British pronunciation.

## Cues and prompts (the clinical content)

Plain, adult, respectful language. Short sentences. Never patronising.

- **No cue or prompt may contain the target word**, any word that is part of a multi-word
  target, or an inflection of it (plural, -ing, -ed, -er). This applies to every text field
  in `cues` and `semantic`, and to `rhyme` and `sameFirstSound`.
- `cues.definition`: one sentence describing the thing without naming it.
- `cues.sentenceCompletion`: a natural sentence with exactly one `___` (three underscores)
  where the target word goes, preferably at the end. The sentence should strongly predict the
  word. It must read correctly with the target inserted exactly as spelled in `word`.
- `cues.firstSoundSpoken`: how a speech synthesiser should SAY the first sound, spelled so it
  is pronounced correctly: "buh", "kuh", "sss", "mmm", "shh", "ch", "fff", "ay", "ee", "oh".
- `cues.firstSyllable`: the first syllable as written, only for words of 2+ syllables. Omit the
  key entirely for one-syllable words.
- `semantic.*`: six full-sentence model answers a therapist could reveal:
  category (what kind of thing), use (what it is for, or why you do it), action (what it does or
  what you do with it), properties (what it looks, feels or sounds like), location (where you
  find it or do it), association (what it makes you think of).
  For verbs and adjectives, adapt naturally (e.g. category "It is something you do with your
  hands." or "It describes how something feels.").
- `phonological.firstSound` and `lastSound`: the sound written simply as a letter or digraph
  ("k", "sh", "ch", "th", "ee", "ay", "er", "ng"). Sounds, not letters: "knife" starts with "n",
  "phone" starts with "f", "cheese" ends with "z".
- `phonological.rhyme`: one common real word that genuinely rhymes, or `null` if none exists.
- `phonological.sameFirstSound`: a different common word starting with the same SOUND, not from
  the same subgroup.

## Images

- `imagePrompt`: a plain description of a clear, realistic photograph of a single subject,
  centred, on a plain white or very light background. No text, logos or brands. Verbs: one
  adult clearly performing the action. Adjectives: an object showing the property unmistakably
  (a broken plate for "broken").
- `searchQuery`: a short (1 to 4 word) phrase likely to find such a photo on Wikimedia Commons
  or Openverse.

## Before you finish

Run the checker and fix every error it reports, repeating until it prints OK:

    node tools/content/check-authored.mjs <your-file> <expected-count>

Report back only: the file path, the final checker line, and the list of words (comma separated).
