// Pure aggregation over saved sessions, shared by the history screens and the reports.
import { percent } from '../session/scoring';
import { CUE_ORDER, type ActivityId, type CueType, type GroupTally, type ModuleId, type SessionRecord } from '../session/types';

export interface SessionFilter {
  module?: ModuleId | null;
  activities?: readonly ActivityId[] | null;
  /** Inclusive local dates, YYYY-MM-DD. */
  from?: string | null;
  to?: string | null;
}

export function sessionDate(s: Pick<SessionRecord, 'startedAt'>): string {
  const d = new Date(s.startedAt);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function filterSessions(sessions: readonly SessionRecord[], f: SessionFilter): SessionRecord[] {
  return sessions
    .filter((s) => {
      if (f.module && s.module !== f.module) return false;
      if (f.activities && f.activities.length > 0 && !f.activities.includes(s.activity)) return false;
      const day = sessionDate(s);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
      return true;
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export interface AccuracyPoint {
  sessionId: string;
  startedAt: string;
  percent: number;
  correct: number;
  total: number;
}

/** Accuracy over time for each activity, oldest first. */
export function accuracySeries(sessions: readonly SessionRecord[]): Partial<Record<ActivityId, AccuracyPoint[]>> {
  const out: Partial<Record<ActivityId, AccuracyPoint[]>> = {};
  for (const s of [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (s.summary.total === 0) continue;
    (out[s.activity] ??= []).push({
      sessionId: s.id,
      startedAt: s.startedAt,
      percent: s.summary.percent,
      correct: s.summary.correct,
      total: s.summary.total,
    });
  }
  return out;
}

export interface GroupRow extends GroupTally {
  group: string;
  percent: number;
}

/** Totals by word group across sessions, weakest first. */
export function groupBreakdown(sessions: readonly SessionRecord[]): GroupRow[] {
  const totals = new Map<string, GroupTally>();
  for (const s of sessions) {
    for (const [group, tally] of Object.entries(s.summary.byGroup)) {
      const t = totals.get(group) ?? { total: 0, correct: 0 };
      t.total += tally.total;
      t.correct += tally.correct;
      totals.set(group, t);
    }
  }
  return [...totals.entries()]
    .map(([group, t]) => ({ group, ...t, percent: percent(t.correct, t.total) }))
    .sort((a, b) => a.percent - b.percent || a.group.localeCompare(b.group));
}

/** Groups scoring clearly below the rest: under 60%, or 20 points below the overall figure. */
export function weakerGroups(rows: readonly GroupRow[], overallPercent: number): string[] {
  return rows.filter((r) => r.total >= 2 && (r.percent < 60 || r.percent <= overallPercent - 20)).map((r) => r.group);
}

export interface CueRow {
  cue: CueType;
  /** Times the cue was taken. */
  used: number;
  /** Times it was the last cue before a successful naming response. */
  beforeSuccess: number;
}

/** For Naming: which cue types preceded success. */
export function cueEffectiveness(sessions: readonly SessionRecord[]): CueRow[] {
  return CUE_ORDER.map((cue) => ({
    cue,
    used: sessions.reduce((n, s) => n + (s.summary.cues[cue] ?? 0), 0),
    beforeSuccess: sessions.reduce((n, s) => n + (s.summary.cuesBeforeSuccess?.[cue] ?? 0), 0),
  }));
}

export interface ScreenerPoint {
  sessionId: string;
  startedAt: string;
  version: number;
  correct: number;
  total: number;
  byGroup: Record<string, GroupTally>;
}

/** Naming Test results over time, oldest first. Only completed screens are comparable. */
export function screenerSeries(sessions: readonly SessionRecord[]): ScreenerPoint[] {
  return sessions
    .filter((s) => s.activity === 'naming-test' && s.summary.total > 0)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => ({
      sessionId: s.id,
      startedAt: s.startedAt,
      version: s.screenerVersion ?? 1,
      correct: s.summary.correct,
      total: s.summary.total,
      byGroup: s.summary.byGroup,
    }));
}

export interface ActivitySummaryRow {
  activity: ActivityId;
  sessions: number;
  items: number;
  correct: number;
  percent: number;
  firstPercent: number;
  lastPercent: number;
  hints: number;
}

/** One row per activity for the progress report summary table. */
export function activitySummary(sessions: readonly SessionRecord[]): ActivitySummaryRow[] {
  const series = accuracySeries(sessions);
  return (Object.keys(series) as ActivityId[]).map((activity) => {
    const points = series[activity]!;
    const mine = sessions.filter((s) => s.activity === activity);
    const items = points.reduce((n, p) => n + p.total, 0);
    const correct = points.reduce((n, p) => n + p.correct, 0);
    return {
      activity,
      sessions: points.length,
      items,
      correct,
      percent: percent(correct, items),
      firstPercent: points[0].percent,
      lastPercent: points[points.length - 1].percent,
      hints: mine.reduce((n, s) => n + s.summary.hints, 0),
    };
  });
}
