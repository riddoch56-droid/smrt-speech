# Choosing pictures: round 5 review rules

SMRT Speech is a language practice app for adults with aphasia. Each word needs ONE picture that
a person would name with exactly that word. These words have no picture yet, after four earlier
attempts. You are reviewing a much larger set of new candidate pictures for them.

## The sheets

Each review sheet (`strip-NNN.jpg`) shows ONE word. The heading gives the word id, the word in
quotes, and a description of the picture originally wanted. Below it are up to 48 candidate
pictures in lines of eight. Each candidate has a yellow number on a black tag in its top-left
corner (1 to 48). Look at every candidate before deciding.

`strip-index.json` lists which word id is on each sheet.

The description in the heading is a guide to the meaning of the word, not a requirement. A
different picture is fine if it passes the test below: for example a person yawning for
"tired", ducklings walking behind their mother for "follow", someone putting baubles on a
Christmas tree for "decorate". Check the word's group in its id (`people-ref` is a referee,
`body-flannel` a face cloth, `nature-log` a cut log of wood, `furniture-letterbox` the slot
in a front door, `places-chemist` a pharmacy shop, `food-tea` the drink).

## Your decision for each word

List EVERY acceptable candidate number, best first. Give an empty list if none is acceptable.

A candidate is acceptable only if ALL of these hold:

1. It clearly shows the target as the main subject, large enough to see at a glance when the
   picture is shown about 8 cm wide.
2. A naive viewer asked "what is this?" (nouns), "what is the person doing?" (verbs) or "what is it
   like?" (describing words) would answer with the target word, not a different word, a more
   general word or a more specific one.
   - Verbs: one person (or the obvious pair) clearly doing that action, caught mid-action.
   - Describing words: the property is unmistakable and is the obvious thing to say about the
     picture (a plate in pieces for "broken", a nail covered in rust for "rusty"). A picture where
     the natural answer is just the object's name is NOT acceptable.
   - Body parts: the part is the clear centre of the picture, not a whole person.
3. It is a realistic colour photograph: not a drawing, painting, cartoon, diagram, engraving, map
   (unless the word is "map"), logo, museum artefact, sculpture, toy version, tattoo, X-ray or scan,
   and not an old black-and-white or sepia photograph.
4. No text that gives the answer away or dominates the picture: no captions, watermarks or
   prominent brand names. Small incidental lettering is fine. For buildings and shops, ordinary
   signage is fine, but reject a picture in which the target word itself is clearly written.
5. Nothing unsuitable: no nudity or underwear being worn, no injury, medical procedure, distress or
   anything undignified. Clothing words must show the garment on its own or worn in an ordinary,
   fully dressed way.
6. No recognisable public figure, nobody named or posed as an individual at an event, no press or
   publicity photograph of a real person. Ordinary anonymous people are fine. Avoid close portraits
   of children.
7. It would not be confused with a different everyday word (a mug for "cup", a stool for "chair").

Among acceptable candidates, rank higher: a single subject, centred; a plain or uncluttered
background; even lighting; a modern, typical, UK-familiar example of the thing.

**Be strict.** A wrong or ambiguous picture misleads a patient; a missing picture is simply left
out of the app. If you are hesitating between "just about" and no, leave it out.

## Output

Write one JSON file mapping every word id on your sheets to its list, for example:

```json
{ "furniture-gate": [3, 31, 11], "people-nurse": [], "verbs-cough": [27] }
```

Every word id from your sheets must appear exactly once. Report back only: the file path, how
many words you reviewed, and how many got at least one acceptable picture.
