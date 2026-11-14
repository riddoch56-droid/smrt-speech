import { percent } from './scoring';
import type { SessionSummary } from './types';

export interface GroupResult {
  group: string;
  correct: number;
  total: number;
  percent: number;
}

export function groupBreakdownOf(summary: SessionSummary): GroupResult[] {
  return Object.entries(summary.byGroup)
    .map(([group, t]) => ({ group, ...t, percent: percent(t.correct, t.total) }))
    .sort((a, b) => a.percent - b.percent || a.group.localeCompare(b.group));
}

/** Groups scoring clearly below the session as a whole: under 60%, or 20 points below the overall figure. */
export function weakGroupsOf(summary: SessionSummary): string[] {
  return groupBreakdownOf(summary)
    .filter((r) => r.total >= 2 && (r.percent < 60 || r.percent <= summary.percent - 20))
    .map((r) => r.group);
}
