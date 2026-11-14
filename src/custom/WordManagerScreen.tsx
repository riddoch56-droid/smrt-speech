import { useMemo, useState } from 'react';
import { wordImageSrc } from '../app/content';
import { useApp } from '../app/store';
import { WORDS } from '../content';
import { GROUP_IDS, GROUP_LABELS } from '../content/types';
import { db, type Binary } from '../platform/db';
import { Icon } from '../ui/Icon';
import { Button, Modal, Screen } from '../ui/kit';
import { PhotoPicker } from './PhotoPicker';
import './custom.css';

const PAGE_SIZE = 60;

type Status = 'all' | 'off' | 'nopic';

async function writeOverride(wordId: string, patch: { disabled?: boolean; image?: Binary | null }) {
  const existing = useApp.getState().overrides[wordId];
  const next = {
    wordId,
    disabled: patch.disabled ?? existing?.disabled ?? false,
    image: patch.image === undefined ? (existing?.image ?? null) : patch.image,
  };
  if (!next.disabled && !next.image) await db.wordOverrides.delete(wordId);
  else await db.wordOverrides.put(next);
  await useApp.getState().refreshCustom();
}

export function WordManagerScreen() {
  const state = useApp();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState<Status>('all');
  const [page, setPage] = useState(0);
  const [replacing, setReplacing] = useState<string | null>(null);

  const { overrides } = state;
  const counts = useMemo(() => {
    let off = 0;
    let nopic = 0;
    for (const w of WORDS) {
      const o = overrides[w.id];
      if (o?.disabled) off += 1;
      if (w.hasImage === false && !o?.image) nopic += 1;
    }
    return { total: WORDS.length, off, nopic };
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return WORDS.filter((w) => {
      if (group !== 'all' && w.group !== group) return false;
      if (q && !w.word.toLowerCase().includes(q)) return false;
      const o = overrides[w.id];
      if (status === 'off' && !o?.disabled) return false;
      if (status === 'nopic' && !(w.hasImage === false && !o?.image)) return false;
      return true;
    });
  }, [search, group, status, overrides]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const replacingWord = replacing ? WORDS.find((w) => w.id === replacing) : undefined;

  return (
    <Screen title="Manage words" back>
      <p className="muted">
        Switch words off to leave them out of every activity. Replace a picture with your own photo. Changes apply straight away.
      </p>
      <div className="row" data-testid="words-count">
        <span className="tag">{counts.total} words</span>
        <span className="tag">{counts.off} switched off</span>
        <span className={'tag' + (counts.nopic > 0 ? ' warn' : ' good')}>
          <Icon name={counts.nopic > 0 ? 'image' : 'tick'} />
          {counts.nopic} without a picture
        </span>
      </div>
      <div className="custom-columns">
        <label className="field">
          <span>Search</span>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            data-testid="word-search"
          />
        </label>
        <label className="field">
          <span>Group</span>
          <select
            className="input"
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setPage(0);
            }}
            data-testid="word-group-filter"
          >
            <option value="all">All groups</option>
            {GROUP_IDS.map((g) => (
              <option key={g} value={g}>
                {GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Show</span>
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Status);
              setPage(0);
            }}
            data-testid="word-status-filter"
          >
            <option value="all">All words</option>
            <option value="off">Switched off</option>
            <option value="nopic">No picture yet</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 && <p className="muted">No words match.</p>}
      <div className="list">
        {visible.map((w) => {
          const o = overrides[w.id];
          const on = !o?.disabled;
          const src = wordImageSrc(w, state);
          return (
            <div key={w.id} className="list-item" data-testid={`word-row-${w.id}`}>
              {src ? (
                <img className="thumb" src={src} alt="" loading="lazy" />
              ) : (
                <span className="thumb" aria-hidden="true">
                  <Icon name="image" size={28} />
                </span>
              )}
              <span className="grow">
                <span className="title">{w.word}</span>
                <span className="muted small" style={{ display: 'block' }}>
                  {GROUP_LABELS[w.group as keyof typeof GROUP_LABELS] ?? w.group}
                </span>
                {!src && (
                  <span className="tag warn">
                    <Icon name="image" />
                    No picture yet
                  </span>
                )}
                {o?.image && w.hasImage === false && (
                  <span className="tag good">
                    <Icon name="tick" />
                    Your picture
                  </span>
                )}
                {o?.image && w.hasImage !== false && (
                  <span className="tag">
                    <Icon name="tick" />
                    Picture replaced
                  </span>
                )}
              </span>
              <Button icon="camera" onClick={() => setReplacing(w.id)} data-testid={`replace-picture-${w.id}`}>
                {!src ? 'Add picture' : 'Replace picture'}
              </Button>
              {o?.image && (
                <Button icon="repeat" onClick={() => void writeOverride(w.id, { image: null })} data-testid={`restore-picture-${w.id}`}>
                  Restore picture
                </Button>
              )}
              <button
                type="button"
                className="toggle"
                role="switch"
                aria-checked={on}
                aria-label={`${w.word} is ${on ? 'on' : 'off'}`}
                onClick={() => void writeOverride(w.id, { disabled: on })}
                data-testid={`word-toggle-${w.id}`}
                style={{ width: 'auto' }}
              >
                <span className="state">{on ? 'On' : 'Off'}</span>
                <span className="switch" />
              </button>
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="row spread">
          <Button icon="back" disabled={current === 0} onClick={() => setPage(current - 1)} data-testid="words-prev">
            Previous
          </Button>
          <span>
            Page {current + 1} of {pages} ({filtered.length} words)
          </span>
          <Button icon="next" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} data-testid="words-next">
            Next
          </Button>
        </div>
      )}

      {replacingWord && (
        <Modal title={`Picture for "${replacingWord.word}"`} onClose={() => setReplacing(null)} actions={<Button onClick={() => setReplacing(null)}>Close</Button>}>
          <PhotoPicker
            value={overrides[replacingWord.id]?.image ?? null}
            onChange={(image) => {
              void writeOverride(replacingWord.id, { image }).then(() => {
                if (image) setReplacing(null);
              });
            }}
          />
        </Modal>
      )}
    </Screen>
  );
}
