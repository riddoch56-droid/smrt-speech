import { describe, expect, it } from 'vitest';
import {
  finishTrial,
  isTrialCorrect,
  percent,
  recordCue,
  recordHint,
  recordResponse,
  startTrial,
  summarise,
  trialOutcome,
  type TrialDraft,
} from '../../src/session/scoring';
import type { CueType, TrialRecord } from '../../src/session/types';

function draft(over: Partial<TrialDraft> = {}): TrialDraft {
  return { ...startTrial({ index: 0, itemId: 'food-apple', label: 'apple', group: 'food', activity: 'comp-listen', choices: ['apple', 'pear'] }, 1000), ...over };
}

function trial(over: Partial<TrialRecord> & { itemId: string }): TrialRecord {
  return {
    index: 0,
    label: over.itemId,
    group: 'food',
    activity: 'naming-practice',
    choices: [],
    responses: [],
    firstAttemptCorrect: true,
    hintsUsed: 0,
    cuesUsed: [],
    attempts: 1,
    responseTimeMs: 1000,
    durationMs: 1000,
    correct: true,
    outcome: 'correct',
    ...over,
  };
}

describe('trial correctness', () => {
  it('is correct only when the first response is right and no hint was used', () => {
    expect(isTrialCorrect(true, 0, 0)).toBe(true);
    expect(isTrialCorrect(true, 1, 0)).toBe(false);
    expect(isTrialCorrect(false, 0, 0)).toBe(false);
    expect(isTrialCorrect(false, 2, 0)).toBe(false);
  });

  it('a first-time right answer with no hint finishes as correct, attempts 1', () => {
    let d = draft();
    d = recordResponse(d, 'apple', true, 1800);
    const t = finishTrial(d, 2000);
    expect(t.correct).toBe(true);
    expect(t.firstAttemptCorrect).toBe(true);
    expect(t.attempts).toBe(1);
    expect(t.outcome).toBe('correct');
    expect(t.responseTimeMs).toBe(800);
    expect(t.durationMs).toBe(1000);
  });

  it('a wrong first answer followed by the right one is incorrect with attempts 2', () => {
    let d = draft();
    d = recordResponse(d, 'pear', false, 1500);
    d = recordResponse(d, 'apple', true, 2500);
    const t = finishTrial(d, 3000);
    expect(t.correct).toBe(false);
    expect(t.firstAttemptCorrect).toBe(false);
    expect(t.attempts).toBe(2);
    expect(t.outcome).toBe('incorrect');
    expect(t.responses.map((r) => r.value)).toEqual(['pear', 'apple']);
    // Response time is the time to the FIRST response.
    expect(t.responseTimeMs).toBe(500);
  });

  it('a hint makes an otherwise right first answer incorrect', () => {
    let d = draft();
    d = recordHint(d);
    d = recordResponse(d, 'apple', true, 1500);
    const t = finishTrial(d, 2000);
    expect(t.correct).toBe(false);
    expect(t.hintsUsed).toBe(1);
    expect(t.firstAttemptCorrect).toBe(true);
    expect(t.attempts).toBe(1);
  });

  it('counts every hint press', () => {
    let d = draft();
    d = recordHint(recordHint(recordHint(d)));
    expect(finishTrial(recordResponse(d, 'apple', true, 1100), 1200).hintsUsed).toBe(3);
  });

  it('a skipped trial is incorrect even if a response was somehow recorded', () => {
    const skipped = finishTrial(draft({ skipped: true }), 2000);
    expect(skipped.correct).toBe(false);
    expect(skipped.skipped).toBe(true);
    expect(skipped.attempts).toBe(0);
    expect(skipped.firstAttemptCorrect).toBe(false);
    const withResponse = finishTrial(recordResponse(draft({ skipped: true }), 'apple', true, 1200), 2000);
    expect(withResponse.correct).toBe(false);
    expect(withResponse.firstAttemptCorrect).toBe(false);
  });

  it('a trial with no response at all is incorrect and uses the duration as response time', () => {
    const t = finishTrial(draft(), 4000);
    expect(t.correct).toBe(false);
    expect(t.responseTimeMs).toBe(3000);
  });

  it('never reports a negative time', () => {
    const d = recordResponse(draft(), 'apple', true, 500);
    expect(d.responses[0].at).toBe(0);
    expect(finishTrial(d, 500).durationMs).toBe(0);
  });

  it('does not mutate the draft it is given', () => {
    const d = draft();
    recordResponse(d, 'x', true, 1500);
    recordHint(d);
    recordCue(d, 'definition');
    expect(d.responses).toHaveLength(0);
    expect(d.hintsUsed).toBe(0);
    expect(d.cuesUsed).toHaveLength(0);
  });
});

describe('cue accounting', () => {
  it('counts each cue type once, in the order first taken', () => {
    let d = draft({ activity: 'naming-practice' });
    for (const c of ['firstLetter', 'definition', 'firstLetter', 'spoken', 'definition', 'spoken'] as CueType[]) d = recordCue(d, c);
    expect(d.cuesUsed).toEqual(['firstLetter', 'definition', 'spoken']);
  });

  it('keeps cues in the finished record', () => {
    let d = draft({ activity: 'naming-practice' });
    d = recordCue(d, 'definition');
    d = recordCue(d, 'sentence');
    d = recordResponse(d, 'tick', true, 1500);
    const t = finishTrial(d, 2000);
    expect(t.cuesUsed).toEqual(['definition', 'sentence']);
  });

  it("outcome is 'cued' when right after cues, not 'correct'", () => {
    let d = draft({ activity: 'naming-practice' });
    d = recordCue(d, 'firstSound');
    d = recordResponse(d, 'tick', true, 1500);
    const t = finishTrial(d, 2000);
    expect(t.correct).toBe(false);
    expect(t.outcome).toBe('cued');
  });

  it('trialOutcome covers the three cases', () => {
    expect(trialOutcome(true, 0, 0)).toBe('correct');
    expect(trialOutcome(true, 1, 0)).toBe('cued');
    expect(trialOutcome(true, 0, 2)).toBe('cued');
    expect(trialOutcome(false, 0, 0)).toBe('incorrect');
    expect(trialOutcome(false, 0, 3)).toBe('incorrect');
  });
});

describe('percent', () => {
  it('rounds and handles zero', () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
    expect(percent(5, 5)).toBe(100);
  });
});

describe('summarise', () => {
  it('returns zeros for an empty session', () => {
    const s = summarise([]);
    expect(s.total).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.meanResponseMs).toBe(0);
    expect(s.missed).toEqual([]);
    expect(s.byGroup).toEqual({});
  });

  it('totals, percent, hints, byGroup and missed list', () => {
    const trials: TrialRecord[] = [
      trial({ itemId: 'a', group: 'food' }),
      trial({ itemId: 'b', group: 'food', correct: false, outcome: 'incorrect', firstAttemptCorrect: false, attempts: 2, responseTimeMs: 3000 }),
      trial({ itemId: 'c', group: 'animals', correct: false, outcome: 'cued', hintsUsed: 2 }),
      trial({ itemId: 'd', group: 'animals' }),
    ];
    const s = summarise(trials);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(2);
    expect(s.cued).toBe(1);
    expect(s.incorrect).toBe(1);
    expect(s.percent).toBe(50);
    expect(s.hints).toBe(2);
    expect(s.byGroup).toEqual({ food: { total: 2, correct: 1 }, animals: { total: 2, correct: 1 } });
    expect(s.missed).toEqual(['b', 'c']);
    expect(s.meanResponseMs).toBe(1500);
  });

  it('missed list has no duplicates when an item is missed twice', () => {
    const miss = (i: number) => trial({ itemId: 'x', index: i, correct: false, outcome: 'incorrect', firstAttemptCorrect: false });
    expect(summarise([miss(0), miss(1)]).missed).toEqual(['x']);
  });

  it('counts cue types and the last cue taken before a successful response', () => {
    const trials: TrialRecord[] = [
      trial({ itemId: 'a', correct: false, outcome: 'cued', cuesUsed: ['definition', 'firstLetter'] }),
      trial({ itemId: 'b', correct: false, outcome: 'cued', cuesUsed: ['firstLetter'] }),
      trial({ itemId: 'c', correct: false, outcome: 'cued', cuesUsed: ['sentence', 'firstLetter', 'spoken'] }),
      // Cues taken but the patient never got it: not a "before success".
      trial({ itemId: 'd', correct: false, outcome: 'incorrect', firstAttemptCorrect: false, cuesUsed: ['written'] }),
      trial({ itemId: 'e' }),
    ];
    const s = summarise(trials);
    expect(s.cues.definition).toBe(1);
    expect(s.cues.sentence).toBe(1);
    expect(s.cues.firstLetter).toBe(3);
    expect(s.cues.firstSound).toBe(0);
    expect(s.cues.written).toBe(1);
    expect(s.cues.spoken).toBe(1);
    expect(s.cuesBeforeSuccess).toEqual({ definition: 0, sentence: 0, firstLetter: 1 + 1, firstSound: 0, written: 0, spoken: 1 });
    expect(s.cued).toBe(3);
    expect(s.incorrect).toBe(1);
    expect(s.correct).toBe(1);
  });

  it('end to end: drafts through finishTrial into summarise', () => {
    const mk = (i: number) => draft({ index: i, itemId: `w${i}`, label: `w${i}` });
    const t0 = finishTrial(recordResponse(mk(0), 'a', true, 1100), 1200);
    const t1 = finishTrial(recordResponse(recordResponse(mk(1), 'b', false, 1100), 'a', true, 1300), 1400);
    const t2 = finishTrial(recordResponse(recordHint(mk(2)), 'a', true, 1100), 1200);
    const t3 = finishTrial(mk(3), 1500);
    const s = summarise([t0, t1, t2, t3]);
    expect(s.correct).toBe(1);
    expect(s.percent).toBe(25);
    expect(s.hints).toBe(1);
    expect(s.missed).toEqual(['w1', 'w2', 'w3']);
  });
});
