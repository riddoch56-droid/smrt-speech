import { useEffect, useMemo, useState } from 'react';
import { db, type Patient } from '../platform/db';
import { navigate } from '../app/router';
import { groupLabel } from '../app/content';
import { useApp } from '../app/store';
import { Button, Screen, formatDate, formatDateTime, formatDuration } from '../ui/kit';
import { Icon } from '../ui/Icon';
import {
  ACTIVITIES,
  CUE_LABELS,
  MODULES,
  activityDef,
  type ActivityId,
  type ModuleId,
  type SessionRecord,
} from '../session/types';
import { percent } from '../session/scoring';
import {
  accuracySeries,
  cueEffectiveness,
  filterSessions,
  groupBreakdown,
  screenerSeries,
  weakerGroups,
} from '../reports/aggregate';
import { GroupBars, LineChart } from './charts';

export function HistoryScreen({ patientId }: { patientId: string }) {
  const categories = useApp((s) => s.categories);
  const [patient, setPatient] = useState<Patient | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [module, setModule] = useState<ModuleId | ''>('');
  const [activity, setActivity] = useState<ActivityId | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      const p = await db.patients.get(patientId);
      const list = await db.sessions.where('patientId').equals(patientId).toArray();
      if (live) {
        setPatient(p ?? null);
        setSessions(list);
      }
    })();
    return () => {
      live = false;
    };
  }, [patientId]);

  const filtered = useMemo(
    () =>
      filterSessions(sessions, {
        module: module || null,
        activities: activity ? [activity] : null,
        from: from || null,
        to: to || null,
      }),
    [sessions, module, activity, from, to],
  );

  const stats = useMemo(() => {
    const total = filtered.reduce((n, s) => n + s.summary.total, 0);
    const correct = filtered.reduce((n, s) => n + s.summary.correct, 0);
    const time = filtered.reduce((n, s) => n + s.durationMs, 0);
    return { total, correct, time, percent: percent(correct, total) };
  }, [filtered]);

  const series = useMemo(() => {
    const acc = accuracySeries(filtered);
    return (Object.keys(acc) as ActivityId[]).map((id) => ({
      label: activityDef(id).title,
      points: (acc[id] ?? []).map((p) => ({ x: p.startedAt, y: p.percent })),
    }));
  }, [filtered]);

  const groups = useMemo(() => groupBreakdown(filtered), [filtered]);
  const weak = useMemo(() => weakerGroups(groups, stats.percent).map((g) => groupLabel(g, { categories })), [groups, stats.percent, categories]);
  const namingSessions = useMemo(() => filtered.filter((s) => s.module === 'naming'), [filtered]);
  const cues = useMemo(() => cueEffectiveness(namingSessions), [namingSessions]);
  const screener = useMemo(() => screenerSeries(filtered), [filtered]);
  const newestFirst = useMemo(() => [...filtered].reverse(), [filtered]);

  const activityOptions = ACTIVITIES.filter((a) => !module || a.module === module);

  if (patient === undefined) {
    return (
      <Screen title="History" back="/patients">
        <p>Loading.</p>
      </Screen>
    );
  }
  if (patient === null) {
    return (
      <Screen title="History" back="/patients">
        <div className="notice warn">This patient could not be found.</div>
      </Screen>
    );
  }

  const cueMax = Math.max(1, ...cues.map((c) => c.used));

  return (
    <Screen
      title={`History: ${patient.code}`}
      back="/patients"
      actions={
        <Button icon="progressReport" variant="primary" onClick={() => navigate(`/progress-report/${patientId}`)} data-testid="open-progress-report">
          Progress report
        </Button>
      }
    >
      <div data-testid="history-screen" className="stack" style={{ gap: 24 }}>
        {sessions.length === 0 ? (
          <div className="notice" data-testid="history-empty">
            No sessions have been saved for this patient yet. Completed sessions will appear here.
          </div>
        ) : (
          <>
            <section className="card stack">
              <h2>Filters</h2>
              <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
                <label className="field">
                  <span>Module</span>
                  <select
                    className="input"
                    value={module}
                    onChange={(e) => {
                      setModule(e.target.value as ModuleId | '');
                      setActivity('');
                    }}
                    data-testid="filter-module"
                  >
                    <option value="">All modules</option>
                    {MODULES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Activity</span>
                  <select
                    className="input"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value as ActivityId | '')}
                    data-testid="filter-activity"
                  >
                    <option value="">All activities</option>
                    {activityOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>From</span>
                  <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="filter-from" />
                </label>
                <label className="field">
                  <span>To</span>
                  <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="filter-to" />
                </label>
              </div>
            </section>

            {filtered.length === 0 ? (
              <div className="notice">No sessions match these filters.</div>
            ) : (
              <>
                <section className="stack">
                  <h2>Summary</h2>
                  <div className="stat-grid">
                    <div className="stat">
                      <div className="value">{filtered.length}</div>
                      <div className="caption">Sessions</div>
                    </div>
                    <div className="stat">
                      <div className="value">{stats.percent}%</div>
                      <div className="caption">
                        Correct first time ({stats.correct} of {stats.total})
                      </div>
                    </div>
                    <div className="stat">
                      <div className="value">{formatDuration(stats.time)}</div>
                      <div className="caption">Total time</div>
                    </div>
                  </div>
                </section>

                <section className="card stack">
                  <h2>Accuracy over time</h2>
                  <LineChart series={series} />
                </section>

                <section className="card stack">
                  <h2>By word group</h2>
                  {groups.length === 0 ? (
                    <p className="muted">No word group data.</p>
                  ) : (
                    <GroupBars
                      rows={groups.map((g) => ({ label: groupLabel(g.group, { categories }), correct: g.correct, total: g.total, percent: g.percent }))}
                      weak={weak}
                    />
                  )}
                </section>

                {namingSessions.length > 0 && (
                  <section className="card stack">
                    <h2>Cues that came before success</h2>
                    <p className="muted small">
                      For each cue type: how often it was taken, and how often it was the last cue before a correct answer.
                    </p>
                    <div className="stack" style={{ gap: 14 }}>
                      {cues.map((c) => (
                        <div key={c.cue} className="bar-row">
                          <span>{CUE_LABELS[c.cue]}</span>
                          <div className="bar-track" role="img" aria-label={`${CUE_LABELS[c.cue]}: used ${c.used}, before success ${c.beforeSuccess}`}>
                            <div className="bar-fill" style={{ width: `${(c.beforeSuccess / cueMax) * 100}%` }} />
                          </div>
                          <span>
                            {c.beforeSuccess} of {c.used}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {screener.length > 0 && (
                  <section className="card stack">
                    <h2>Naming Test over time</h2>
                    <p className="muted small">An informal screen, not a standardised assessment. Use it to compare one visit with another.</p>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Score</th>
                          <th>Change from previous</th>
                        </tr>
                      </thead>
                      <tbody>
                        {screener.map((p, i) => {
                          const prev = i > 0 ? screener[i - 1] : null;
                          const diff = prev ? p.correct - prev.correct : null;
                          return (
                            <tr key={p.sessionId}>
                              <td>{formatDate(p.startedAt)}</td>
                              <td>
                                {p.correct} out of {p.total}
                              </td>
                              <td>
                                {diff === null ? 'First test' : diff === 0 ? 'No change' : diff > 0 ? `+${diff}` : `${diff}`}
                                {prev && prev.total !== p.total ? ' (different number of pictures)' : ''}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                )}

                <section className="stack">
                  <h2>Sessions</h2>
                  <div className="list">
                    {newestFirst.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        className="list-item"
                        onClick={() => navigate(`/session-detail/${s.id}`)}
                        data-testid={`session-row-${i}`}
                      >
                        <div className="grow">
                          <div className="title">{activityDef(s.activity).title}</div>
                          <div className="small muted">{formatDateTime(s.startedAt)}</div>
                        </div>
                        <div>
                          {s.summary.correct} of {s.summary.total} ({s.summary.percent}%)
                        </div>
                        <div className="muted">{formatDuration(s.durationMs)}</div>
                        <Icon name="next" />
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
