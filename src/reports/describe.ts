// Pure helpers shared by the PDF and CSV reports (and usable by screens).
import { CUE_LABELS, activityDef, type DescribeStatus, type SessionRecord, type TrialRecord } from '../session/types';

export interface LabelledValue {
  label: string;
  value: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

/** 14 Nov 2026 (local time). Fixed format so output does not depend on the device locale. */
export function fmtDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fmtDateTime(value: string | Date): string {
  return `${fmtDate(value)}, ${fmtTime(value)}`;
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function fmtSeconds(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function list(values: readonly string[]): string {
  return values.join(', ');
}

/** The settings that applied to a session, in readable form, limited to those relevant to its activity. */
export function describeSettings(session: SessionRecord, groupLabel: (id: string) => string): LabelledValue[] {
  const s = session.settings;
  const activity = session.activity;
  const out: LabelledValue[] = [];
  if (activity === 'naming-test') {
    out.push({ label: 'Format', value: 'Fixed 30-picture screen, fixed order, no cues, no feedback' });
    out.push({ label: 'Screen version', value: String(session.screenerVersion ?? 1) });
    return out;
  }
  out.push({ label: 'Word groups', value: s.groups.length === 0 ? 'All groups' : list(s.groups.map(groupLabel)) });
  out.push({ label: 'Number of trials', value: s.trials === 'continuous' ? 'Continuous (until stopped)' : String(s.trials) });
  switch (session.module) {
    case 'comprehension':
      out.push({ label: 'Number of choices', value: s.choices === 'auto' ? 'Auto (adapts to performance)' : String(s.choices) });
      out.push({ label: 'Difficulty', value: s.difficulty === 'hard' ? 'Hard' : 'Easy' });
      break;
    case 'reading':
      out.push({ label: 'Number of choices', value: s.choices === 'auto' ? 'Auto' : String(s.choices) });
      out.push({ label: 'Read aloud', value: s.readAloud === 'always' ? 'Always on' : 'Hint only' });
      break;
    case 'writing':
      out.push({ label: 'Tile level', value: s.tileLevel === 'hard' ? 'Hard' : s.tileLevel === 'medium' ? 'Medium' : 'Easy' });
      out.push({
        label: 'Word length',
        value:
          s.wordLengths.length === 0
            ? 'All lengths'
            : list([...s.wordLengths].sort((a, b) => a - b).map((n) => (n >= 10 ? '10+ letters' : `${n} letters`))),
      });
      break;
    case 'naming':
      out.push({
        label: 'Syllables',
        value:
          s.syllables.length === 0
            ? 'All'
            : list([...s.syllables].sort((a, b) => a - b).map((n) => (n >= 5 ? '5+' : String(n)))),
      });
      if (activity === 'naming-describe') {
        out.push({
          label: 'Prompts',
          value: s.describePrompts === 'meaning' ? 'Meaning' : s.describePrompts === 'sound' ? 'Sound' : 'Meaning and sound',
        });
      }
      if (activity === 'naming-flashcards') {
        const f = s.flashcards;
        out.push({ label: 'Show picture', value: f.showPicture ? 'Yes' : 'No' });
        out.push({ label: 'Show word', value: f.showWord ? 'Yes' : 'No' });
        out.push({ label: 'Speak on reveal', value: f.speakOnReveal ? 'Yes' : 'No' });
        out.push({ label: 'Shuffle', value: f.shuffle ? 'Yes' : 'No' });
        out.push({ label: 'Scoring', value: f.scoring ? 'On' : 'Off' });
      }
      break;
  }
  return out;
}

const DESCRIBE_LABELS: Record<DescribeStatus, string> = {
  independent: 'said independently',
  afterReveal: 'said after reveal',
  notSaid: 'not said',
};

export function resultLabel(t: TrialRecord): string {
  if (t.skipped) return 'Skipped (scored incorrect)';
  if (t.correct) return 'Correct';
  if (t.outcome === 'cued') return t.cuesUsed.length > 0 ? 'Correct with cues' : 'Correct with hint';
  return 'Incorrect';
}

export function responsesText(t: TrialRecord): string {
  const parts: string[] = [];
  if (t.responses.length > 0) {
    parts.push(t.responses.map((r) => (r.correct ? r.value : `${r.value} (incorrect)`)).join(' > '));
  }
  if (t.describe && t.describe.length > 0) {
    parts.push('Cards: ' + t.describe.map((d) => `${d.card} ${DESCRIBE_LABELS[d.status] ?? d.status}`).join('; '));
  }
  return parts.length > 0 ? parts.join(' | ') : '-';
}

export function hintsCuesText(t: TrialRecord): string {
  const parts: string[] = [];
  if (t.hintsUsed > 0) parts.push(`${t.hintsUsed} ${t.hintsUsed === 1 ? 'hint' : 'hints'}`);
  if (t.cuesUsed.length > 0) parts.push('Cues: ' + t.cuesUsed.map((c) => CUE_LABELS[c]).join(', '));
  return parts.length > 0 ? parts.join('; ') : '-';
}

export const TRIAL_COLUMNS = ['No.', 'Target', 'Word group', 'Responses', 'Result', 'Hints and cues', 'Time (s)'] as const;

/** One row per trial: the same data feeds the PDF table and the CSV. */
export function trialRows(session: SessionRecord, groupLabel: (id: string) => string): string[][] {
  return session.trials.map((t, i) => [
    String(i + 1),
    t.label,
    groupLabel(t.group),
    responsesText(t),
    resultLabel(t),
    hintsCuesText(t),
    fmtSeconds(t.responseTimeMs),
  ]);
}

export function activityTitle(session: SessionRecord): string {
  return activityDef(session.activity).title;
}
