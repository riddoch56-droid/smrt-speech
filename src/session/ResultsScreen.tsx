import { useState } from 'react';
import { findWord, groupLabel } from '../app/content';
import { navigate } from '../app/router';
import { useApp } from '../app/store';
import { groupBreakdownOf, weakGroupsOf } from './resultsHelpers';
import { exportSessionPdf } from '../reports/export';
import { ACTIVITY_ART, asset } from '../ui/assets';
import { Icon } from '../ui/Icon';
import { Button, formatDuration, Screen } from '../ui/kit';
import { WordThumb } from '../ui/parts';
import { useSession, type SessionResult } from './store';
import { activityDef, CUE_LABELS, CUE_ORDER } from './types';

export function ResultsScreen({ result }: { result: SessionResult }) {
  const { record, saved, scored, request } = result;
  const def = activityDef(record.activity);
  const start = useSession((s) => s.start);
  const clear = useSession((s) => s.clearResult);
  const lock = useApp((s) => s.lock);
  const [status, setStatus] = useState('');
  const s = record.summary;
  const isTest = record.activity === 'naming-test';
  const rows = groupBreakdownOf(s);
  const weak = weakGroupsOf(s);
  const cuesUsed = CUE_ORDER.filter((c) => s.cues[c] > 0);
  const missedLabels = s.missed.map((id) => ({ id, word: findWord(id), label: record.trials.find((t) => t.itemId === id)?.label ?? id }));

  const again = (itemIds?: string[]) => {
    lock();
    start({ activity: request.activity, settings: request.settings, patientId: request.patientId, itemIds });
    navigate('/session', true);
  };

  const done = () => {
    clear();
    navigate('/', true);
  };

  const viewReport = async () => {
    if (saved) {
      navigate(`/session-detail/${record.id}`);
      return;
    }
    // Guest sessions are not stored, so the report is made straight from memory.
    setStatus('Preparing report…');
    try {
      const outcome = await exportSessionPdf(record, 'Guest');
      setStatus(outcome === 'shared' ? 'Report shared.' : outcome === 'cancelled' ? '' : 'Report saved to downloads.');
    } catch {
      setStatus('The report could not be made.');
    }
  };

  return (
    <Screen title={`${def.title}: results`} art={asset(ACTIVITY_ART[def.id])}>
      <div data-testid="results" className="stack" style={{ gap: 20 }}>
        {!scored ? (
          <div className="notice" data-testid="results-unscored">
            Free practice. Nothing was scored, so nothing was saved.
          </div>
        ) : (
          <>
            <div className={'notice ' + (saved ? 'good' : 'warn')} data-testid="results-saved">
              {saved ? 'Saved to this patient’s history.' : 'Guest practice: this session was not saved.'}
            </div>
            <div className="stat-grid">
              <div className="stat">
                <div className="value" data-testid="results-score">
                  {s.correct} / {s.total}
                </div>
                <div className="caption">correct first time, without help</div>
              </div>
              <div className="stat">
                <div className="value" data-testid="results-percent">
                  {s.percent}%
                </div>
                <div className="caption">accuracy</div>
              </div>
              {!isTest && (
                <div className="stat">
                  <div className="value">{def.module === 'naming' ? s.cued : s.hints}</div>
                  <div className="caption">{def.module === 'naming' ? 'named after a cue' : 'hints used'}</div>
                </div>
              )}
              <div className="stat">
                <div className="value" style={{ fontSize: 28 }}>
                  {formatDuration(record.durationMs)}
                </div>
                <div className="caption">time taken</div>
              </div>
            </div>

            {isTest && (
              <p className="muted">This is an informal screen for comparing sessions over time. It is not a standardised assessment.</p>
            )}

            <div className="card" data-testid="recommendation">
              <h2>Suggestion</h2>
              <p>{record.recommendation.text}</p>
            </div>

            {cuesUsed.length > 0 && (
              <div className="card">
                <h2>Cues used</h2>
                <div className="chips">
                  {cuesUsed.map((c) => (
                    <span className="tag" key={c}>
                      {CUE_LABELS[c]}: {s.cues[c]}
                      {s.cuesBeforeSuccess[c] > 0 ? ` (${s.cuesBeforeSuccess[c]} led to the word)` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {rows.length > 1 && (
              <div className="card stack">
                <h2>By word group</h2>
                {rows.map((r) => (
                  <div className="bar-row" key={r.group}>
                    <span>
                      {groupLabel(r.group)}{' '}
                      {weak.includes(r.group) && (
                        <span className="tag warn">
                          <Icon name="info" /> Weaker
                        </span>
                      )}
                    </span>
                    <span className="bar-track">
                      <span className={'bar-fill' + (weak.includes(r.group) ? ' weak' : '')} style={{ display: 'block', width: `${r.percent}%` }} />
                    </span>
                    <span>
                      {r.correct} of {r.total}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {missedLabels.length > 0 && (
              <div className="card">
                <h2>Items to practise again ({missedLabels.length})</h2>
                <div className="chips" data-testid="missed-list">
                  {missedLabels.map((m) => (
                    <span className="row" key={m.id} style={{ gap: 8 }}>
                      {m.word && <WordThumb word={m.word} size={52} />}
                      <span>{m.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {status && (
          <p className="muted" aria-live="polite" data-testid="report-status">
            {status}
          </p>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button icon="repeat" onClick={() => again()} data-testid="results-repeat">
            Repeat
          </Button>
          {scored && !isTest && s.missed.length > 0 && (
            <Button icon="flip" onClick={() => again(s.missed)} data-testid="results-missed">
              Practise missed items
            </Button>
          )}
          {scored && (
            <Button icon="chart" onClick={viewReport} data-testid="results-report">
              View report
            </Button>
          )}
          <Button icon="tick" variant="primary" big onClick={done} data-testid="results-done">
            Done
          </Button>
        </div>
      </div>
    </Screen>
  );
}
