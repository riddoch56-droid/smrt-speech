import { useEffect, useRef, useState } from 'react';
import { groupLabel, groupOptions, wordImageSrc } from '../app/content';
import { useApp } from '../app/store';
import { binaryToBlob, blobToBinary, db, type Binary, type CustomCategory, type CustomWordRow } from '../platform/db';
import { recordingSupported, startRecording, type ActiveRecording } from '../platform/recorder';
import { uid } from '../session/rng';
import { Icon } from '../ui/Icon';
import { Button, Field, Modal, Screen } from '../ui/kit';
import { buildCustomWord, estimateSyllables } from './imageTools';
import { PhotoPicker } from './PhotoPicker';
import './custom.css';

interface Draft {
  id: string | null;
  word: string;
  image: Binary | null;
  audio: Binary | null;
  group: string;
  syllables: number;
  syllablesTouched: boolean;
  patientId: string;
  definition: string;
  sentenceCompletion: string;
  firstSoundSpoken: string;
  firstSyllable: string;
}

function newDraft(): Draft {
  return {
    id: null,
    word: '',
    image: null,
    audio: null,
    group: 'household',
    syllables: 1,
    syllablesTouched: false,
    patientId: '',
    definition: '',
    sentenceCompletion: '',
    firstSoundSpoken: '',
    firstSyllable: '',
  };
}

function draftFromRow(row: CustomWordRow): Draft {
  const w = row.word;
  return {
    id: row.id,
    word: w.word,
    image: row.image,
    audio: row.audio,
    group: w.group,
    syllables: w.syllables,
    syllablesTouched: true,
    patientId: w.patientId ?? '',
    definition: w.cues.definition,
    sentenceCompletion: w.cues.sentenceCompletion,
    firstSoundSpoken: w.cues.firstSoundSpoken,
    firstSyllable: w.cues.firstSyllable ?? '',
  };
}

function CategorySection() {
  const categories = useApp((s) => s.categories);
  const customWords = useApp((s) => s.customWords);
  const customReading = useApp((s) => s.customReading);
  const [editing, setEditing] = useState<CustomCategory | 'new' | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  function start(c: CustomCategory | 'new') {
    setEditing(c);
    setName(c === 'new' ? '' : c.name);
    setMessage('');
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage('Please type a name for the category.');
      return;
    }
    const editingId = editing && editing !== 'new' ? editing.id : null;
    const clash = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editingId);
    if (clash) {
      setMessage('There is already a category with that name.');
      return;
    }
    const id = editingId ?? `cat-${uid()}`;
    await db.customCategories.put({ id, name: trimmed });
    await useApp.getState().refreshCustom();
    setEditing(null);
    setMessage('');
  }

  async function remove(c: CustomCategory) {
    const inUse = customWords.filter((w) => w.word.group === c.id).length + customReading.filter((r) => r.item.group === c.id).length;
    if (inUse > 0) {
      setMessage(`"${c.name}" still has ${inUse} item${inUse === 1 ? '' : 's'} in it. Move or delete them first, then delete the category.`);
      return;
    }
    await db.customCategories.delete(c.id);
    await useApp.getState().refreshCustom();
    setMessage('');
  }

  return (
    <section className="card stack" aria-label="My categories">
      <div className="row spread">
        <h2>My categories</h2>
        <Button icon="plus" onClick={() => start('new')} data-testid="add-category">
          Add category
        </Button>
      </div>
      {categories.length === 0 && !editing && <p className="muted">No categories yet. Words can also go in any of the built-in groups.</p>}
      <div className="list">
        {categories.map((c) => (
          <div key={c.id} className="list-item" data-testid={`category-${c.name}`}>
            <span className="grow title">{c.name}</span>
            <Button icon="edit" onClick={() => start(c)}>
              Rename
            </Button>
            <Button icon="trash" variant="danger" onClick={() => void remove(c)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
      {editing && (
        <div className="stack">
          <Field label={editing === 'new' ? 'New category name' : 'Category name'}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void save()}
              data-testid="category-name-input"
            />
          </Field>
          <div className="row">
            <Button variant="primary" icon="save" onClick={() => void save()} data-testid="save-category">
              Save category
            </Button>
            <Button icon="cross" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}

function AudioControls({ audio, onChange }: { audio: Binary | null; onChange(b: Binary | null): void }) {
  const [recording, setRecording] = useState(false);
  const [, setRefused] = useState(false);
  const active = useRef<ActiveRecording | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      active.current?.cancel();
      player.current?.pause();
    },
    [],
  );

  async function toggle() {
    if (recording && active.current) {
      const rec = active.current;
      active.current = null;
      setRecording(false);
      const blob = await rec.stop();
      if (blob.size > 0) onChange(await blobToBinary(blob));
      return;
    }
    try {
      active.current = await startRecording();
      setRecording(true);
    } catch {
      setRefused(true);
    }
  }

  function play() {
    if (!audio) return;
    player.current?.pause();
    const url = URL.createObjectURL(binaryToBlob(audio));
    const el = new Audio(url);
    el.onended = () => URL.revokeObjectURL(url);
    player.current = el;
    void el.play();
  }

  const canRecord = recordingSupported();
  if (!canRecord && !audio) return null;
  return (
    <div className="stack">
      <span className="label">Recorded voice (optional)</span>
      <span className="help small muted">A recording replaces the computer voice for this word.</span>
      <div className="row">
        {canRecord && (
          <Button icon={recording ? 'stop' : 'mic'} variant={recording ? 'danger' : 'default'} onClick={() => void toggle()} data-testid="record-clip">
            {recording ? 'Stop recording' : audio ? 'Record again' : 'Record'}
          </Button>
        )}
        {audio && !recording && (
          <>
            <Button icon="play" onClick={play} data-testid="play-clip">
              Play
            </Button>
            <Button icon="trash" variant="danger" onClick={() => onChange(null)} data-testid="remove-clip">
              Remove recording
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function WordEditor({ initial, onClose }: { initial: Draft; onClose(): void }) {
  const state = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const options = groupOptions(state);
  const patients = state.patients.filter((p) => !p.archived || p.id === initial.patientId);

  function set(patch: Partial<Draft>) {
    setD((prev) => ({ ...prev, ...patch }));
  }

  async function save() {
    const text = d.word.trim();
    if (!text) {
      setError('Please type the word.');
      return;
    }
    const sc = d.sentenceCompletion.trim();
    if (sc && !sc.includes('___')) {
      setError('The sentence cue needs a blank, written as three underscores: ___');
      return;
    }
    const id = d.id ?? `custom-${uid()}`;
    const word = buildCustomWord({
      id,
      word: text,
      group: d.group,
      syllables: d.syllables,
      patientId: d.patientId || null,
      cues: {
        definition: d.definition.trim(),
        sentenceCompletion: sc,
        firstSoundSpoken: d.firstSoundSpoken.trim(),
        firstSyllable: d.firstSyllable.trim() || undefined,
      },
    });
    word.hasImage = !!d.image;
    word.hasAudio = !!d.audio;
    await db.customWords.put({ id, word, image: d.image, audio: d.audio });
    await useApp.getState().refreshCustom();
    onClose();
  }

  async function remove() {
    if (!d.id) return;
    await db.customWords.delete(d.id);
    await useApp.getState().refreshCustom();
    onClose();
  }

  return (
    <Modal
      title={d.id ? 'Edit word' : 'Add a word'}
      wide
      onClose={onClose}
      actions={
        <>
          <Button variant="primary" icon="save" onClick={() => void save()} data-testid="save-word">
            Save word
          </Button>
          <Button icon="cross" onClick={onClose}>
            Cancel
          </Button>
          {d.id &&
            (confirmDelete ? (
              <>
                <Button variant="danger" icon="trash" onClick={() => void remove()} data-testid="confirm-delete-word">
                  Yes, delete it
                </Button>
                <Button onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </>
            ) : (
              <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)} data-testid="delete-word">
                Delete word
              </Button>
            ))}
        </>
      }
    >
      <div className="stack">
        <Field label="Word">
          <input
            className="input"
            value={d.word}
            onChange={(e) => {
              const word = e.target.value;
              set({ word, ...(d.syllablesTouched ? {} : { syllables: estimateSyllables(word) }) });
            }}
            data-testid="word-text-input"
          />
        </Field>
        <div className="field">
          <span>Picture</span>
          <PhotoPicker value={d.image} onChange={(image) => set({ image })} />
        </div>
        <div className="custom-columns">
          <Field label="Group">
            <select className="input" value={d.group} onChange={(e) => set({ group: e.target.value })} data-testid="word-group-select">
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Syllables" help="A guess from the spelling. Change it if it is wrong.">
            <input
              className="input"
              type="number"
              min={1}
              max={8}
              value={d.syllables}
              onChange={(e) => set({ syllables: Math.max(1, Number(e.target.value) || 1), syllablesTouched: true })}
              data-testid="word-syllables-input"
            />
          </Field>
          <Field label="Who is this word for?">
            <select className="input" value={d.patientId} onChange={(e) => set({ patientId: e.target.value })} data-testid="word-patient-select">
              <option value="">Everyone</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description cue (optional)" help="For example: A hot drink made from leaves.">
          <input className="input" value={d.definition} onChange={(e) => set({ definition: e.target.value })} data-testid="word-definition-input" />
        </Field>
        <Field label="Sentence cue (optional)" help="Write ___ where the word goes. For example: I would like a cup of ___.">
          <input className="input" value={d.sentenceCompletion} onChange={(e) => set({ sentenceCompletion: e.target.value })} data-testid="word-sentence-input" />
        </Field>
        <AudioControls audio={d.audio} onChange={(audio) => set({ audio })} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function MyWordsScreen() {
  const state = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);

  return (
    <Screen
      title="My words"
      back
      actions={
        <Button icon="plus" variant="primary" onClick={() => setDraft(newDraft())} data-testid="add-word">
          Add word
        </Button>
      }
    >
      <CategorySection />
      <section className="stack" aria-label="My words">
        <h2>Words I have added</h2>
        {state.customWords.length === 0 && <p className="muted">No words yet. Press "Add word" to add one with your own photo.</p>}
        <div className="list">
          {state.customWords.map((row) => {
            const word = { ...row.word, custom: true, hasAudio: !!row.audio };
            const src = wordImageSrc(word, state);
            const patient = row.word.patientId ? state.patients.find((p) => p.id === row.word.patientId)?.code : null;
            return (
              <button
                type="button"
                key={row.id}
                className="list-item"
                onClick={() => setDraft(draftFromRow(row))}
                data-testid={`my-word-${row.word.word}`}
              >
                {src ? (
                  <img className="thumb" src={src} alt="" />
                ) : (
                  <span className="thumb" aria-hidden="true">
                    <Icon name="image" size={28} />
                  </span>
                )}
                <span className="grow">
                  <span className="title">{row.word.word}</span>
                  <span className="muted small" style={{ display: 'block' }}>
                    {groupLabel(row.word.group, state)} · {patient ? `For ${patient}` : 'For everyone'}
                    {row.audio ? ' · Recorded voice' : ''}
                    {!row.image ? ' · No picture yet' : ''}
                  </span>
                </span>
                <Icon name="edit" size={26} />
              </button>
            );
          })}
        </div>
      </section>
      {draft && <WordEditor key={draft.id ?? 'new'} initial={draft} onClose={() => setDraft(null)} />}
    </Screen>
  );
}
