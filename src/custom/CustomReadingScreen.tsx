import { useState } from 'react';
import { groupLabel, groupOptions, readingImageSrc } from '../app/content';
import { useApp } from '../app/store';
import type { ReadingItem, ReadingKind } from '../content/types';
import { db, type Binary, type CustomReadingRow } from '../platform/db';
import { uid } from '../session/rng';
import { Icon } from '../ui/Icon';
import { Button, Field, Modal, Screen, Segmented } from '../ui/kit';
import { PhotoPicker } from './PhotoPicker';
import './custom.css';

interface Draft {
  id: string | null;
  kind: ReadingKind;
  text: string;
  distractors: string;
  answer: string;
  answerDistractors: string;
  image: Binary | null;
  group: string;
}

function newDraft(): Draft {
  return { id: null, kind: 'phrase', text: '', distractors: '', answer: '', answerDistractors: '', image: null, group: 'household' };
}

function draftFromRow(row: CustomReadingRow): Draft {
  const i = row.item;
  return {
    id: row.id,
    kind: i.kind,
    text: i.text,
    distractors: i.distractors.join('\n'),
    answer: i.answer,
    answerDistractors: i.answerDistractors.join('\n'),
    image: row.image,
    group: i.group,
  };
}

function lines(s: string): string[] {
  return s
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const norm = (s: string) => s.trim().toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces the first whole-word occurrence of the answer with ___, or returns null if it is not in the text. */
function makeCloze(text: string, answer: string): string | null {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}'])(${escapeRe(answer)})(?![\\p{L}\\p{N}'])`, 'iu');
  if (!re.test(text)) return null;
  return text.replace(re, (_m, pre: string) => `${pre}___`);
}

function validateReading(d: Draft): { error: string } | { item: Omit<ReadingItem, 'id' | 'image' | 'childFriendly'> } {
  const text = d.text.trim();
  if (!text) return { error: 'Please type the phrase or sentence.' };
  // Whole-text distractors may contain commas, so split on new lines only.
  const wholeText = d.distractors
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (wholeText.length < 3) return { error: `Please give at least three wrong ${d.kind === 'phrase' ? 'phrases' : 'sentences'}, one on each line. You have ${wholeText.length}.` };
  if (new Set(wholeText.map(norm)).size !== wholeText.length) return { error: 'Two of the wrong options are the same. Each one must be different.' };
  if (wholeText.some((x) => norm(x) === norm(text))) return { error: 'One of the wrong options is the same as the correct text.' };
  const answer = d.answer.trim();
  if (!answer) return { error: 'Please type the missing word for the completion activities.' };
  if (/\s/.test(answer)) return { error: 'The missing word must be a single word.' };
  const cloze = makeCloze(text, answer);
  if (!cloze) return { error: `The missing word "${answer}" is not a word in the text. Check the spelling.` };
  const answerDistractors = lines(d.answerDistractors);
  if (answerDistractors.length < 3) return { error: `Please give at least three wrong words, one on each line. You have ${answerDistractors.length}.` };
  if (answerDistractors.some((x) => /\s/.test(x))) return { error: 'The wrong words must be single words, one on each line.' };
  if (new Set(answerDistractors.map(norm)).size !== answerDistractors.length) return { error: 'Two of the wrong words are the same. Each one must be different.' };
  if (answerDistractors.some((x) => norm(x) === norm(answer))) return { error: 'One of the wrong words is the same as the missing word.' };
  return {
    item: { kind: d.kind, group: d.group, text, distractors: wholeText, cloze, answer, answerDistractors },
  };
}

function ReadingEditor({ initial, onClose }: { initial: Draft; onClose(): void }) {
  const state = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const options = groupOptions(state);

  function set(patch: Partial<Draft>) {
    setD((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const result = validateReading(d);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    const id = d.id ?? `customread-${uid()}`;
    const item: ReadingItem = { ...result.item, id, image: '', childFriendly: true };
    await db.customReading.put({ id, item, image: d.image });
    await useApp.getState().refreshCustom();
    onClose();
  }

  async function remove() {
    if (!d.id) return;
    await db.customReading.delete(d.id);
    await useApp.getState().refreshCustom();
    onClose();
  }

  const noun = d.kind === 'phrase' ? 'phrase' : 'sentence';
  return (
    <Modal
      title={d.id ? 'Edit reading item' : 'Add a reading item'}
      wide
      onClose={onClose}
      actions={
        <>
          <Button variant="primary" icon="save" onClick={() => void save()} data-testid="save-reading">
            Save
          </Button>
          <Button icon="cross" onClick={onClose}>
            Cancel
          </Button>
          {d.id &&
            (confirmDelete ? (
              <>
                <Button variant="danger" icon="trash" onClick={() => void remove()} data-testid="confirm-delete-reading">
                  Yes, delete it
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </>
            ) : (
              <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)} data-testid="delete-reading">
                Delete
              </Button>
            ))}
        </>
      }
    >
      <div className="stack">
        <Segmented<ReadingKind>
          label="Type"
          value={d.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'phrase', label: 'Phrase' },
            { value: 'sentence', label: 'Sentence' },
          ]}
        />
        <div className="field">
          <span>Picture</span>
          <PhotoPicker value={d.image} onChange={(image) => set({ image })} />
          {!d.image && <span className="help">Without a picture the activity will show only the words.</span>}
        </div>
        <Field label={`The ${noun}, true of the picture`} help={d.kind === 'phrase' ? 'For example: a cup of tea' : 'For example: The man is reading a book.'}>
          <input className="input" value={d.text} onChange={(e) => set({ text: e.target.value })} data-testid="reading-text-input" />
        </Field>
        <Field label={`Wrong ${noun}s, at least three (one on each line)`} help="Change one thing each time, so every option must be read carefully.">
          <textarea className="input" value={d.distractors} onChange={(e) => set({ distractors: e.target.value })} data-testid="reading-distractors-input" />
        </Field>
        <Field label="The missing word" help="It must be one of the words in the text above. It becomes the blank in the completion activities.">
          <input className="input" value={d.answer} onChange={(e) => set({ answer: e.target.value })} data-testid="reading-answer-input" />
        </Field>
        <Field label="Wrong words, at least three (one on each line)" help="Single words that could fit but are wrong.">
          <textarea className="input" value={d.answerDistractors} onChange={(e) => set({ answerDistractors: e.target.value })} data-testid="reading-answer-distractors-input" />
        </Field>
        <Field label="Group">
          <select className="input" value={d.group} onChange={(e) => set({ group: e.target.value })} data-testid="reading-group-select">
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p className="error" role="alert" data-testid="reading-error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function CustomReadingScreen() {
  const state = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <Screen
      title="My reading items"
      back
      actions={
        <Button icon="plus" variant="primary" onClick={() => setDraft(newDraft())} data-testid="add-reading">
          Add item
        </Button>
      }
    >
      <p className="muted">Add your own phrases and sentences, each with a photo, for the reading activities.</p>
      {state.customReading.length === 0 && <p className="muted">No reading items yet.</p>}
      <div className="list">
        {state.customReading.map((row) => {
          const src = readingImageSrc(row.item, state);
          return (
            <button
              type="button"
              key={row.id}
              className="list-item"
              onClick={() => setDraft(draftFromRow(row))}
              data-testid={`my-reading-${row.item.text}`}
            >
              {src ? (
                <img className="thumb" src={src} alt="" />
              ) : (
                <span className="thumb" aria-hidden="true">
                  <Icon name="image" size={28} />
                </span>
              )}
              <span className="grow">
                <span className="title">{row.item.text}</span>
                <span className="muted small" style={{ display: 'block' }}>
                  {row.item.kind === 'phrase' ? 'Phrase' : 'Sentence'} · {groupLabel(row.item.group, state)}
                </span>
              </span>
              <Icon name="edit" size={26} />
            </button>
          );
        })}
      </div>
      {draft && <ReadingEditor key={draft.id ?? 'new'} initial={draft} onClose={() => setDraft(null)} />}
    </Screen>
  );
}
