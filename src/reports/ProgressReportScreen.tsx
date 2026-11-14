import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/store';
import { db } from '../platform/db';
import type { ShareOutcome } from '../platform/share';
import { ACTIVITIES, activityDef, type ActivityId, type SessionRecord } from '../session/types';
import { Button, Field, MultiChips, Screen } from '../ui/kit';
import { activitySummary, filterSessions } from './aggregate';
import { exportProgressCsv, exportProgressPdf } from './export';

const OUTCOME_TEXT: Record<ShareOutcome, string> = {
  shared: 'Shared.',
  cancelled: 'Cancelled. Nothing was saved.',
  opened: 'Opened in a new view.',
  downloaded: 'Downloaded to this device.',
};

export function ProgressReportScreen({ patientId }: { patientId: string }) {
  const patients = useApp((s) => s.patients);
  const patientCode = patients.find((p) => p.id === patientId)?.code ?? (patientId === 'guest' ? 'Guest' : patientId);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [chosen, setChosen] = useState<ActivityId[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void db.sessions
      .where('patientId')
      .equals(patientId)
      .toArray()
      .then((list) => {
        if (live) {
          setSessions(list);
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, [patientId]);

  const available = useMemo(() => ACTIVITIES.filter((a) => sessions.some((s) => s.activity === a.id)), [sessions]);
  const activities = useMemo<ActivityId[]>(() => chosen ?? available.map((a) => a.id), [chosen, available]);
  const filtered = useMemo(
    () => filterSessions(sessions, { from: from || null, to: to || null, activities }),
    [sessions, from, to, activities],
  );
  const rows = useMemo(() => activitySummary(filtered), [filtered]);

  const run = async (label: string, action: () => Promise<ShareOutcome>) => {
    setBusy(true);
    setStatus(`Preparing ${label}...`);
    try {
      setStatus(OUTCOME_TEXT[await action()]);
    } catch {
      setStatus(`Sorry, the ${label} could not be created.`);
    } finally {
      setBusy(false);
    }
  };

  const input = { sessions, from: from || null, to: to || null, activities };

  return (
    <Screen title="Progress report" back>
      <div className="stack" data-testid="progress-report">
        <p className="muted">Patient {patientCode}. Reports are made on this device and shared from the share sheet.</p>
        {loaded && sessions.length === 0 ? (
          <div className="notice">No sessions have been saved for this patient yet.</div>
        ) : (
          <>
            <div className="card stack">
              <div className="row">
                <Field label="From">
                  <input
                    type="date"
                    className="input"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                    data-testid="progress-from"
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    className="input"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                    data-testid="progress-to"
                  />
                </Field>
                {(from || to) && (
                  <Button
                    icon="close"
                    onClick={() => {
                      setFrom('');
                      setTo('');
                    }}
                  >
                    All dates
                  </Button>
                )}
              </div>
              <MultiChips
                label="Activities"
                help="Choose which activities to include."
                options={available.map((a) => ({ value: a.id, label: a.title }))}
                values={activities}
                onChange={setChosen}
              />
            </div>

            <div className="card stack">
              <div className="stat-grid">
                <div className="stat">
                  <strong>{filtered.length}</strong>
                  <span>Sessions completed</span>
                </div>
                <div className="stat">
                  <strong>{rows.length}</strong>
                  <span>Activities</span>
                </div>
              </div>
              {rows.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Sessions</th>
                      <th>Accuracy</th>
                      <th>First</th>
                      <th>Latest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.activity}>
                        <td>{activityDef(r.activity).title}</td>
                        <td>{r.sessions}</td>
                        <td>{r.percent}%</td>
                        <td>{r.firstPercent}%</td>
                        <td>{r.lastPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No sessions match these choices.</p>
              )}
            </div>

            <div className="row">
              <Button
                icon="exportPdf"
                variant="primary"
                disabled={busy || filtered.length === 0}
                onClick={() => void run('PDF', () => exportProgressPdf(input, patientCode))}
                data-testid="progress-export-pdf"
              >
                Export PDF
              </Button>
              <Button
                icon="exportCsv"
                disabled={busy || filtered.length === 0}
                onClick={() => void run('CSV', () => exportProgressCsv(filtered, patientCode))}
                data-testid="progress-export-csv"
              >
                Export CSV
              </Button>
            </div>
          </>
        )}
        <p className="muted" role="status" aria-live="polite" data-testid="progress-status">
          {status}
        </p>
        <p className="small muted">Informal therapy data. Not a standardised assessment.</p>
      </div>
    </Screen>
  );
}
