# Reading content authoring rules (SMRT Speech)

SMRT Speech is a language practice toolkit for adults with aphasia, used by a UK speech and language
therapist. You are writing ORIGINAL phrase and sentence items for its Reading module. Do not copy
items from any existing therapy app or published material.

Each item is tied to ONE specific picture. The patient sees the picture and chooses the written
phrase or sentence that matches it, or the missing word. So:

**Everything you write must be plainly true of the exact picture you are looking at**, and every
wrong choice must be plainly false of it. Look at each picture before you write. If you cannot see
a detail (a colour, how many, what someone is holding), do not mention it.

## The four activities your items feed

- Phrase Matching: picture + 2 to 4 phrases; choose the matching phrase.
- Phrase Completion: the phrase with its LAST word missing; choose the missing word.
- Sentence Matching: picture + 2 to 4 sentences; choose the matching sentence.
- Sentence Completion: the sentence with one word missing; choose the word.

## Output

One JSON file: an array of records, UTF-8, no comments, no trailing commas.

```json
[
  {
    "wordId": "food-apple",
    "kind": "phrase",
    "text": "a shiny red apple",
    "distractors": ["a bunch of grapes", "a slice of bread", "a green pear"],
    "answer": "apple",
    "answerDistractors": ["onion", "tomato", "ball"]
  },
  {
    "wordId": "food-apple",
    "kind": "sentence",
    "text": "The apple has a short stalk.",
    "distractors": ["The pear has a short stalk.", "The apple has a long leaf.", "The apple has been cut in half."],
    "answer": "stalk",
    "answerDistractors": ["handle", "tail", "lid"]
  }
]
```

- `wordId`: the id of the picture's word, exactly as given in your sheet index.
- At most ONE phrase and ONE sentence per picture. Skip a picture entirely if it is unclear, odd,
  or you cannot write something true and useful about it.

## Phrases

- A short noun phrase or verb phrase of 2 to 6 words, lower case, no full stop:
  "a cup of tea", "a pair of scissors", "two brown eggs", "sweeping the floor", "a wooden chair".
- Not a full sentence.
- `answer` is the LAST word of the phrase, exactly as written (the app blanks the last word).
- `distractors`: at least three whole phrases of similar length and shape that are clearly FALSE of
  the picture. Make them plausible phrases about related things, not nonsense.
- `answerDistractors`: at least three single words that fit the phrase grammatically in place of the
  last word but are clearly false of the picture. Avoid near-synonyms and anything arguably true
  (if the picture shows a mug, "cup" is not a fair wrong answer).

## Sentences

- One simple sentence of 4 to 10 words, starting with a capital and ending with a full stop.
  Plain, adult, respectful. Present tense. Prefer "The man is ...", "The kettle is ...",
  "There are ...". Use "man", "woman", "person" or "people" for anyone shown; never guess a name,
  age, job or relationship unless the picture's word says so (a picture for "nurse" may say nurse).
- `distractors`: at least three sentences, each changing exactly ONE element of the target (who,
  the action, or the object/property) so that every option has to be read carefully, and each
  clearly false of the picture.
- `answer`: one word that appears exactly once in the sentence (not the first word, not "the", "a",
  "is", "are"). Choose a content word.
- `answerDistractors`: at least three single words of the same kind that fit the gap grammatically,
  are plausible and semantically related, and are clearly false of the picture.

## General

- British English spelling and vocabulary (colour, lorry, jumper, trousers, crisps, pavement).
- No brand names. No clinical or judgemental language about people.
- All options in an item must be distinct. No wrong option may also be true of the picture.
- Vary your sentence frames; do not write every sentence as "This is a ...".

## Before you finish

Run the checker and fix every error, repeating until it prints OK:

    node tools/content/check-reading.mjs <your-file>

Report back only: the file path, the final checker line, and the ids of any pictures you skipped
with a few words on why (for example "blurry", "shows two different things", "not what the word says").
