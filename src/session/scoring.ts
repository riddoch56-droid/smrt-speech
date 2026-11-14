import {
  CUE_ORDER,
  type ActivityId,
  type CueType,
  type DescribeMark,
  type SessionSummary,
  type TrialOutcome,
  type TrialRecord,
  type TrialResponse,
} from './types';

/** Mutable record of one trial in progress. All timing is passed in, so this stays pure. */
export interface TrialDraft {
  index: number;
  itemId: string;
  label: string;
  group: string;
  activity: ActivityId;
  choices: string[];
  startedAt: number;
  responses: TrialResponse[];
  hintsUsed: number;
  cuesUsed: CueType[];
  skipped: boolean;
  fieldSize?: number;
  describe?: DescribeMark[];
}

export function startTrial(
  init: Pick<TrialDraft, 'index' | 'itemId' | 'label' | 'group' | 'activity' | 'choices'> & { fieldSize?: number },
  now: number,
): TrialDraft {
  return { ...init, startedAt: now, responses: [], hintsUsed: 0, cuesUsed: [], skipped: false };
}

export function recordResponse(draft: TrialDraft, value: string, correct: boolean, now: number): TrialDraft {
  return { ...draft, responses: [...draft.responses, { value, correct, at: Math.max(0, now - draft.startedAt) }] };
}

export function recordHint(draft: TrialDraft): TrialDraft {
  return { ...draft, hintsUsed: draft.hintsUsed + 1 };
}

/** Each cue type is counted once per trial, in the order first taken. */
export function recordCue(draft: TrialDraft, cue: CueType): TrialDraft {
  if (draft.cuesUsed.includes(cue)) return draft;
  return { ...draft, cuesUsed: [...draft.cuesUsed, cue] };
}

/**
 * The scoring rule. A trial is correct only if the first response was right and no hint
 * or cue was used beforehand. Anything else is scored incorrect, although the patient
 * carries on to the right answer (errorless completion).
 */
export function isTrialCorrect(firstAttemptCorrect: boolean, hintsUsed: number, cuesUsed: number): boolean {
  return firstAttemptCorrect && hintsUsed === 0 && cuesUsed === 0;
}

export function trialOutcome(firstAttemptCorrect: boolean, hintsUsed: number, cuesUsed: number): TrialOutcome {
  if (isTrialCorrect(firstAttemptCorrect, hintsUsed, cuesUsed)) return 'correct';
  if (firstAttemptCorrect) return 'cued';
  return 'incorrect';
}

export function finishTrial(draft: TrialDraft, now: number): TrialRecord {
  const first = draft.responses[0];
  const firstAttemptCorrect = !draft.skipped && !!first && first.correct;
  const durationMs = Math.max(0, now - draft.startedAt);
  return {
    index: draft.index,
    itemId: draft.itemId,
    label: draft.label,
    group: draft.group,
    activity: draft.activity,
    choices: draft.choices,
    responses: draft.responses,
    firstAttemptCorrect,
    hintsUsed: draft.hintsUsed,
    cuesUsed: draft.cuesUsed,
    attempts: draft.responses.length,
    responseTimeMs: first ? first.at : durationMs,
    durationMs,
    correct: isTrialCorrect(firstAttemptCorrect, draft.hintsUsed, draft.cuesUsed.length),
    outcome: trialOutcome(firstAttemptCorrect, draft.hintsUsed, draft.cuesUsed.length),
    ...(draft.skipped ? { skipped: true } : {}),
    ...(draft.fieldSize ? { fieldSize: draft.fieldSize } : {}),
    ...(draft.describe ? { describe: draft.describe } : {}),
  };
}

function emptyCueCounts(): Record<CueType, number> {
  return Object.fromEntries(CUE_ORDER.map((c) => [c, 0])) as Record<CueType, number>;
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

export function summarise(trials: readonly TrialRecord[]): SessionSummary {
  const cues = emptyCueCounts();
  const cuesBeforeSuccess = emptyCueCounts();
  const byGroup: SessionSummary['byGroup'] = {};
  const missed: string[] = [];
  let correct = 0;
  let cued = 0;
  let hints = 0;
  let responseTotal = 0;
  for (const t of trials) {
    if (t.correct) correct++;
    else {
      if (t.outcome === 'cued') cued++;
      if (!missed.includes(t.itemId)) missed.push(t.itemId);
    }
    hints += t.hintsUsed;
    for (const c of t.cuesUsed) cues[c]++;
    if (t.outcome === 'cued' && t.cuesUsed.length > 0) cuesBeforeSuccess[t.cuesUsed[t.cuesUsed.length - 1]]++;
    const g = (byGroup[t.group] ??= { total: 0, correct: 0 });
    g.total++;
    if (t.correct) g.correct++;
    responseTotal += t.responseTimeMs;
  }
  const total = trials.length;
  return {
    total,
    correct,
    cued,
    incorrect: total - correct - cued,
    percent: percent(correct, total),
    hints,
    cues,
    cuesBeforeSuccess,
    byGroup,
    missed,
    meanResponseMs: total === 0 ? 0 : Math.round(responseTotal / total),
  };
}
