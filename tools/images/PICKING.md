# Choosing pictures: visual review rules

SMRT Speech is a language practice app for adults with aphasia. Each of its 700 words needs ONE
picture that a person would name with exactly that word. You are reviewing candidate pictures.

## The sheets

Each review sheet (`strip-NNN.jpg`) has up to six rows. A row is one word: the heading gives the
word id, the word in quotes, and a description of the picture wanted. Under it are up to eight
candidate pictures, each with a yellow number on a black tag in its top-left corner.

The index file lists which word ids are on each sheet, in row order (top to bottom).

## Your decision for each row

Give the NUMBER of the best acceptable candidate, or 0 if none is acceptable.

A candidate is acceptable only if ALL of these hold:

1. It clearly shows the target, as the main subject, large enough to see at a glance.
2. A naive viewer asked "what is this?" would answer with the target word (not a different word,
   a more general word, or a more specific one). For verbs: one person (or the obvious pair) clearly
   doing that action. For adjectives: the property is unmistakable and is the obvious thing to say.
3. It is a realistic photograph: not a drawing, painting, cartoon, diagram, engraving, map, logo,
   museum artefact, sculpture, toy version, tattoo, or an old black-and-white or sepia photograph.
4. No prominent text, caption, watermark, brand name or logo.
5. Nothing unsuitable: no nudity, injury, distress, or anything undignified. No recognisable
   public figure and nobody who looks like a named individual at an event.
6. It would not be confused with a different everyday word (a mug for "cup", a hare for "rabbit").

Among acceptable candidates, prefer: a single subject, centred; a plain white or light background;
even lighting; a modern, typical, UK-familiar example of the thing.

**Be strict.** A wrong or ambiguous picture misleads a patient; a missing picture is simply left
out of the app. If you are hesitating between "just about" and 0, choose 0.

## Output

Write a JSON object mapping every word id on your sheets to its number, for example:

```json
{ "food-apple": 2, "people-nurse": 0, "verbs-sweep": 0 }
```

Every word id from your sheets must appear exactly once.

For each word you gave 0, also suggest a better search phrase (2 to 4 plain words that a
photo site would match, for example "nurse hospital uniform" or "sweeping floor broom") in a second
JSON object mapping word id to phrase.

Report back only: the two file paths, how many words you reviewed, how many got a picture, and
how many got 0.
