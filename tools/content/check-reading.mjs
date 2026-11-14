// Checks one authored reading file. Usage: node check-reading.mjs <file>
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = process.argv[2];
const root = fileURLToPath(new URL('../../', import.meta.url));
const wordsDir = root + 'src/content/words/';
const words = new Map();
for (const f of readdirSync(wordsDir).filter((x) => x.endsWith('.json'))) {
  for (const w of JSON.parse(readFileSync(wordsDir + f, 'utf8'))) words.set(w.id, w);
}

let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error('INVALID JSON: ' + e.message);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error('Top level must be an array');
  process.exit(1);
}

const errors = [];
const seen = new Set();
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const wordCount = (s) => s.trim().split(/\s+/).length;
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'and', 'of', 'to', 'in', 'on', 'it', 'there']);

data.forEach((r, i) => {
  const tag = `#${i + 1} ${r?.wordId} ${r?.kind}`;
  if (!r || typeof r !== 'object') return errors.push(`${tag}: not an object`);
  const word = words.get(r.wordId);
  if (!word) return errors.push(`${tag}: unknown wordId`);
  if (word.hasImage === false || !existsSync(root + 'public/images/' + word.image)) errors.push(`${tag}: that word has no picture`);
  if (r.kind !== 'phrase' && r.kind !== 'sentence') return errors.push(`${tag}: kind must be "phrase" or "sentence"`);
  const key = r.wordId + ':' + r.kind;
  if (seen.has(key)) errors.push(`${tag}: more than one ${r.kind} for this picture`);
  seen.add(key);
  if (!str(r.text)) return errors.push(`${tag}: missing text`);
  if (r.text !== r.text.trim() || /\s{2,}/.test(r.text)) errors.push(`${tag}: stray spaces in text`);
  if (/_/.test(r.text)) errors.push(`${tag}: text must not contain a blank`);
  const n = wordCount(r.text);

  if (r.kind === 'phrase') {
    if (n < 2 || n > 6) errors.push(`${tag}: a phrase is 2 to 6 words (found ${n})`);
    if (/[.!?]$/.test(r.text)) errors.push(`${tag}: a phrase has no full stop`);
    if (r.text[0] !== r.text[0].toLowerCase()) errors.push(`${tag}: a phrase starts in lower case`);
    const last = r.text.trim().split(/\s+/).pop();
    if (r.answer !== last) errors.push(`${tag}: answer must be the last word of the phrase ("${last}")`);
  } else {
    if (n < 4 || n > 10) errors.push(`${tag}: a sentence is 4 to 10 words (found ${n})`);
    if (!/^[A-Z]/.test(r.text)) errors.push(`${tag}: a sentence starts with a capital`);
    if (!/\.$/.test(r.text)) errors.push(`${tag}: a sentence ends with a full stop`);
    if (!str(r.answer) || /\s/.test(r.answer)) errors.push(`${tag}: answer must be a single word`);
    else {
      const hits = r.text.match(new RegExp(`\\b${esc(r.answer)}\\b`, 'g')) || [];
      if (hits.length !== 1) errors.push(`${tag}: answer must appear exactly once in the sentence (found ${hits.length})`);
      if (STOP.has(r.answer.toLowerCase())) errors.push(`${tag}: choose a content word as the answer`);
      if (r.text.startsWith(r.answer + ' ')) errors.push(`${tag}: the answer must not be the first word`);
    }
  }

  for (const [field, single] of [['distractors', false], ['answerDistractors', true]]) {
    const list = r[field];
    if (!Array.isArray(list) || list.length < 3) {
      errors.push(`${tag}: ${field} needs at least three entries`);
      continue;
    }
    const target = norm(single ? r.answer : r.text);
    const set = new Set();
    for (const d of list) {
      if (!str(d)) errors.push(`${tag}: empty entry in ${field}`);
      else {
        if (norm(d) === target) errors.push(`${tag}: ${field} contains the right answer`);
        if (set.has(norm(d))) errors.push(`${tag}: duplicate in ${field}: "${d}"`);
        set.add(norm(d));
        if (single && /\s/.test(d.trim())) errors.push(`${tag}: answerDistractors must be single words ("${d}")`);
        if (!single && r.kind === 'sentence' && (!/^[A-Z]/.test(d) || !/\.$/.test(d))) errors.push(`${tag}: distractor sentences need a capital and a full stop ("${d}")`);
        if (!single && r.kind === 'phrase' && /[.!?]$/.test(d)) errors.push(`${tag}: distractor phrases have no full stop ("${d}")`);
      }
    }
  }
});

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
const phrases = data.filter((r) => r.kind === 'phrase').length;
console.log(`OK ${phrases} phrases, ${data.length - phrases} sentences`);
