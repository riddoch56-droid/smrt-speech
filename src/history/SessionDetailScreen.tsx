import { useEffect, useState } from 'react';
import { db } from '../platform/db';
import { goBack } from '../app/router';
import { groupLabel } from '../app/content';
import { useApp } from '../app/store';
import { Button, Modal, Screen, formatDateTime, formatDuration } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { CUE_LABELS, CUE_ORDER, activityDef, type SessionRecord, type TrialRecord } from '../session/types';
import type { ShareOutcome } from '../platform/share';
import { exportSessionCsv, exportSessionPdf } from '../reports/export';
import { GroupBars } from './charts';

const OUTCOME_TEXT: Record<ShareOutcome, string> = {
  shared: 'Shared.',
  cancelled: 'Cancelled. Nothing was shared.',
  opened: 'Opened in a new view.',
  downloaded: 'Saved to downloads.',
};

function settingsLines(s: SessionRecord, categories: { id: string; name: string }[]): string[] {
  const st = s.settings;
  const lines: string[] = [];
  lines.push(
    `Word groups: ${st.groups.length === 0 ? 'All' : st.groups.map((g) => groupLabel(g, { categories })).join(', ')}`,
  );
  lines.push(`Number of items: ${st.trials === 'continuous' ? 'Continuous' : st.trials}`);
  if (s.module === 'comprehension' || s.module === 'reading') {
    lines.push(`Choices: ${st.choices === 'auto' ? 'Automatic' : st.choices}`);
    lines.push(`Difficulty: ${st.difficulty === 'easy' ? 'Easy' : 'Hard'}`);
  }
  if (s.module === 'reading') lines.push(`Read aloud: ${st.readAloud === 'always' ? 'Always' : 'On hint'}`);
  if (s.module === 'naming' && st.syllables.length > 0) lines.push(`Syllables: ${st.syllables.join(', ')}`);
  if (s.activity === 'naming-describe') {
    lines.push(`Describe prompts: ${st.describePrompts === 'both' ? 'Meaning and sound' : st.describePrompts === 'meaning' ? 'Meaning' : 'Sound'}`);
  }
  if (s.activity === 'naming-flashcards') {
    const f = st.flashcards;
    lines.push(
      `Flashcards: picture ${f.showPicture ? 'on' : 'off'}, word ${f.showWord ? 'on' : 'off'}, speak on reveal ${f.speakOnReveal ? 'on' : 'off'}, shuffle ${f.shuffle ? 'on' : 'off'}, scoring ${f.scoring ? 'on' : 'off'}`,
    );
  }
  if (s.module === 'writing') {
    lines.push(`Tile level: ${st.tileLevel}`);
    if (st.wordLengths.length > 0) lines.push(`Word lengths: ${st.wordLengths.join(', ')}`);
  }
  return lines;
}

function resultText(t: TrialRecord): string {
  if (t.skipped) return 'Skipped';
  if (t.outcome === 'correct') return 'Correct';
  if (t.outcome === 'cued') return 'Correct with help';
  return 'Incorrect';
}

export function SessionDetailScreen({ sessionId }: { sessionId: string }) {
  const categories = useApp((s) => s.categories);
  const [session, setSession] = useState<SessionRecord | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const [exportStatus, setExportStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const s = await db.sessions.get(sessionId);
      const p = s ? await db.patients.get(s.patientId) : undefined;
      if (live) {
        setSession(s ?? null);
        setCode(p?.code ?? 'Unknown');
        setNote(s?.note ?? '');
      }
    })();
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (session === undefined) {
    return (
      <Screen title="Session" back>
        <p>Loading.</p>
      </Screen>
    );
  }
  if (session === null) {
    return (
      <Screen title="Session" back>
        <div className="notice warn">This session could not be found. It may have been deleted.</div>
      </Screen>
    );
  }

  const sum = session.summary;
  const def = activityDef(session.activity);

  const saveNote = async () => {
    await db.sessions.update(session.id, { note });
    setSession({ ...session, note });
    setNoteStatus('Note saved.');
  };

  const run = async (fn: (s: SessionRecord, c: string) => Promise<ShareOutcome>) => {
    setExportStatus('Working.');
    try {
      const outcome = await fn({ ...session, note }, code);
      setExportStatus(OUTCOME_TEXT[outcome]);
    } catch {
      setExportStatus('The export did not work. Please try again.');
    }
  };

  const remove = async () => {
    await db.sessions.delete(session.id);
    setConfirmDelete(false);
    goBack('/patients');
  };

  const groupRows = Object.entries(sum.byGroup).map(([g, t]) => ({
    label: groupLabel(g, { categories }),
    correct: t.correct,
    total: t.total,
    percent: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
  }));
  const cueRows = CUE_ORDER.filter((c) => (sum.cues[c] ?? 0) > 0);

  return (
    <Screen title={`${def.title}: ${code}`} back>
      <div data-testid="session-detail" className="stack" style={{ gap: 24 }}>
        <section className="card stack">
          <h2>Session</h2>
          <dl className="stack" style={{ margin: 0 }}>
            <div>
              <strong>Patient ID:</strong> {code}
            </div>
            <div>
              <strong>Date and time:</strong> {formatDateTime(session.startedAt)}
            </div>
            <div>
              <strong>Duration:</strong> {formatDuration(session.durationMs)}
            </div>
            <div>
              <strong>Activity:</strong> {def.title}
            </div>
            {settingsLines(session, categories).map((l) => (
              <div key={l}>{l}</div>
            ))}
          </dl>
        </section>

        <section className="stack">
          <h2>Results</h2>
          <div className="stat-grid">
            <div className="stat">
              <div className="value">{sum.percent}%</div>
              <div className="caption">
                Correct first time ({sum.correct} of {sum.total})
              </div>
            </div>
            <div className="stat">
              <div className="value">{sum.hints}</div>
              <div className="caption">Hints used</div>
            </div>
            <div className="stat">
              <div className="value">{sum.cued}</div>
              <div className="caption">Correct with help</div>
            </div>
            <div className="stat">
              <div className="value">{sum.incorrect}</div>
              <div className="caption">Incorrect</div>
            </div>
          </div>
        </section>

        {cueRows.length > 0 && (
          <section className="card stack">
            <h2>Cues used</h2>
            <ul>
              {cueRows.map((c) => (
                <li key={c}>
                  {CUE_LABELS[c]}: {sum.cues[c]} (last cue before success: {sum.cuesBeforeSuccess?.[c] ?? 0})
                </li>
              ))}
            </ul>
          </section>
        )}

        {groupRows.length > 0 && (
          <section className="card stack">
            <h2>By word group</h2>
            <GroupBars rows={groupRows} />
          </section>
        )}

        <section className="card stack">
          <h2>Recommendation</h2>
          <p>{session.recommendation.text}</p>
        </section>

        <section className="stack">
          <h2>Item by item</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Target</th>
                  <th>Responses</th>
                  <th>Result</th>
                  <th>Hints and cues</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {session.trials.map((t) => (
                  <tr key={t.index}>
                    <td>{t.index + 1}</td>
                    <td>{t.label}</td>
                    <td>
                      {t.responses.length > 0 ? t.responses.map((r) => r.value).join(', ') : 'None'}
                      {t.choices.length > 0 && <div className="small muted">Choices: {t.choices.join(', ')}</div>}
                    </td>
                    <td>
                      <span className={'tag ' + (t.outcome === 'correct' ? 'good' : t.outcome === 'cued' ? 'warn' : 'bad')}>
                        <Icon name={t.outcome === 'incorrect' ? 'cross' : 'tick'} />
                        {resultText(t)}
                      </span>
                    </td>
                    <td>
                      {t.hintsUsed > 0 ? `${t.hintsUsed} hint${t.hintsUsed === 1 ? '' : 's'}` : 'No hints'}
                      {t.cuesUsed.length > 0 && <div className="small">{t.cuesUsed.map((c) => CUE_LABELS[c]).join(', ')}</div>}
                    </td>
                    <td>{(t.durationMs / 1000).toFixed(1)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card stack">
          <h2>Session note</h2>
          <textarea
            className="input"
            rows={4}
            aria-label="Session note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNoteStatus('');
            }}
            data-testid="session-note"
          />
          <div className="row">
            <Button icon="save" variant="primary" onClick={() => void saveNote()} data-testid="save-note">
              Save note
            </Button>
            <span role="status">{noteStatus}</span>
          </div>
        </section>

        <section className="card stack">
          <h2>Export and delete</h2>
          <div className="row">
            <Button icon="exportPdf" onClick={() => void run(exportSessionPdf)} data-testid="export-pdf">
              Export PDF
            </Button>
            <Button icon="exportCsv" onClick={() => void run(exportSessionCsv)} data-testid="export-csv">
              Export CSV
            </Button>
            <Button icon="trash" variant="danger" onClick={() => setConfirmDelete(true)} data-testid="delete-session">
              Delete session
            </Button>
          </div>
          <p role="status" data-testid="export-status">
            {exportStatus}
          </p>
        </section>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete this session?"
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <Button icon="trash" variant="danger" onClick={() => void remove()} data-testid="confirm-delete-session">
                Delete
              </Button>
              <Button icon="close" variant="quiet" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          }
        >
          <p>This permanently deletes this session record. It cannot be undone.</p>
        </Modal>
      )}
    </Screen>
  );
}
