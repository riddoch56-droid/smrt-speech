import { describe, expect, it } from 'vitest';
import { recommend, stepDownSuggestion, stepUpSuggestion } from '../../src/session/recommend';
import { DEFAULT_SESSION_SETTINGS, type ActivityId, type SessionSettings, type SessionSummary } from '../../src/session/types';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  const total = over.total ?? 10;
  const correct = over.correct ?? 10;
  return {
    total,
    correct,
    cued: 0,
    incorrect: total - correct,
    percent: Math.round((correct / (total || 1)) * 100),
    hints: 0,
    cues: { definition: 0, sentence: 0, firstLetter: 0, firstSound: 0, written: 0, spoken: 0 },
    cuesBeforeSuccess: { definition: 0, sentence: 0, firstLetter: 0, firstSound: 0, written: 0, spoken: 0 },
    byGroup: {},
    missed: [],
    meanResponseMs: 1000,
    ...over,
  };
}

const settings = (over: Partial<SessionSettings> = {}): SessionSettings => ({ ...DEFAULT_SESSION_SETTINGS, ...over });

describe('recommend', () => {
  const act: ActivityId = 'comp-listen';

  it('90% or more with no hints twice in a row suggests up', () => {
    const r = recommend({ activity: act, settings: settings({ choices: 4 }), summary: summary({ correct: 10 }), previous: summary({ correct: 9 }) });
    expect(r.level).toBe('up');
    expect(r.text).toContain('5 choices');
  });

  it('exactly 90% counts', () => {
    const r = recommend({ activity: act, settings: settings(), summary: summary({ correct: 9 }), previous: summary({ correct: 9 }) });
    expect(r.level).toBe('up');
  });

  it('once only stays, and mentions that another session would suggest moving up', () => {
    expect(recommend({ activity: act, settings: settings(), summary: summary({ correct: 10 }) }).level).toBe('stay');
    expect(recommend({ activity: act, settings: settings(), summary: summary({ correct: 10 }), previous: null }).level).toBe('stay');
    const r = recommend({ activity: act, settings: settings(), summary: summary({ correct: 10 }), previous: summary({ correct: 7 }) });
    expect(r.level).toBe('stay');
    expect(r.text.toLowerCase()).toContain('continue');
  });

  it('90% with hints stays, even twice in a row', () => {
    const hinted = summary({ correct: 9, total: 10, hints: 2 });
    expect(recommend({ activity: act, settings: settings(), summary: hinted }).level).toBe('stay');
    expect(recommend({ activity: act, settings: settings(), summary: hinted, previous: summary({ correct: 10 }) }).level).toBe('stay');
    expect(recommend({ activity: act, settings: settings(), summary: summary({ correct: 10 }), previous: hinted }).level).toBe('stay');
  });

  it('under 90% stays even if the previous session was strong', () => {
    const r = recommend({ activity: act, settings: settings(), summary: summary({ correct: 8 }), previous: summary({ correct: 10 }) });
    expect(r.level).toBe('stay');
  });

  it('50% or less suggests down', () => {
    expect(recommend({ activity: act, settings: settings({ choices: 4 }), summary: summary({ correct: 5 }) }).level).toBe('down');
    expect(recommend({ activity: act, settings: settings({ choices: 4 }), summary: summary({ correct: 2 }) }).level).toBe('down');
    expect(recommend({ activity: act, settings: settings({ choices: 4 }), summary: summary({ correct: 0 }) }).level).toBe('down');
    expect(recommend({ activity: act, settings: settings({ choices: 4 }), summary: summary({ correct: 5 }) }).text).toContain('3 choices');
  });

  it('between 51% and 89% stays', () => {
    for (const correct of [6, 7, 8]) {
      const r = recommend({ activity: act, settings: settings(), summary: summary({ correct }), previous: summary({ correct: 10 }) });
      expect(r.level).toBe('stay');
      expect(r.text).toContain(`${correct * 10}%`);
    }
  });

  it('boundary just above 50% is not a step down', () => {
    expect(recommend({ activity: act, settings: settings(), summary: summary({ total: 100, correct: 51 }) }).level).toBe('stay');
  });

  it('an empty session stays without a suggestion to change anything', () => {
    const r = recommend({ activity: act, settings: settings(), summary: summary({ total: 0, correct: 0 }) });
    expect(r.level).toBe('stay');
  });
});

describe('suggestion text names a concrete step per module', () => {
  it('Comprehension up: more choices, then Hard, then the next activity', () => {
    expect(stepUpSuggestion('comp-listen', settings({ choices: 3 }))).toBe('try 4 choices');
    expect(stepUpSuggestion('comp-listen', settings({ choices: 6, difficulty: 'easy' }))).toBe('try Hard difficulty');
    expect(stepUpSuggestion('comp-listen', settings({ choices: 'auto', difficulty: 'easy' }))).toBe('try Hard difficulty');
    expect(stepUpSuggestion('comp-listen', settings({ choices: 6, difficulty: 'hard' }))).toContain('Read');
    expect(stepUpSuggestion('comp-listen-read', settings({ choices: 6, difficulty: 'hard' }))).toContain('wider range');
  });

  it('Comprehension down: Easy, then fewer choices, then the previous activity', () => {
    expect(stepDownSuggestion('comp-read', settings({ difficulty: 'hard', choices: 4 }))).toBe('try Easy difficulty');
    expect(stepDownSuggestion('comp-read', settings({ difficulty: 'easy', choices: 4 }))).toBe('try 3 choices');
    expect(stepDownSuggestion('comp-read', settings({ difficulty: 'easy', choices: 2 }))).toContain('Listen');
  });

  it('Reading up: more choices (to 4), then Hint only, then the next activity', () => {
    expect(stepUpSuggestion('read-phrase-match', settings({ choices: 2 }))).toBe('try 3 choices');
    expect(stepUpSuggestion('read-phrase-match', settings({ choices: 4, readAloud: 'always' }))).toBe('set Read aloud to Hint only');
    expect(stepUpSuggestion('read-phrase-match', settings({ choices: 4, readAloud: 'hint' }))).toContain('Phrase Completion');
  });

  it('Reading down: fewer choices, then Read aloud always on', () => {
    expect(stepDownSuggestion('read-sentence-match', settings({ choices: 4 }))).toBe('try 3 choices');
    expect(stepDownSuggestion('read-sentence-match', settings({ choices: 2, readAloud: 'hint' }))).toBe('set Read aloud to Always on');
    expect(stepDownSuggestion('read-sentence-match', settings({ choices: 2, readAloud: 'always' }))).toContain('Phrase Completion');
  });

  it('Writing up: Medium tiles, Hard tiles, then longer words', () => {
    expect(stepUpSuggestion('write-copy', settings({ tileLevel: 'easy' }))).toContain('Medium');
    expect(stepUpSuggestion('write-copy', settings({ tileLevel: 'medium' }))).toContain('Hard');
    expect(stepUpSuggestion('write-copy', settings({ tileLevel: 'hard', wordLengths: [3, 4] }))).toContain('longer words');
    expect(stepUpSuggestion('write-copy', settings({ tileLevel: 'hard' }))).toContain('Fill in the Blank');
  });

  it('Writing down: Medium, Easy, shorter words', () => {
    expect(stepDownSuggestion('write-see', settings({ tileLevel: 'hard' }))).toContain('Medium');
    expect(stepDownSuggestion('write-see', settings({ tileLevel: 'medium' }))).toContain('Easy');
    expect(stepDownSuggestion('write-see', settings({ tileLevel: 'easy' }))).toContain('shorter words');
    expect(stepDownSuggestion('write-see', settings({ tileLevel: 'easy', wordLengths: [3, 4] }))).toContain('Fill in the Blank');
  });

  it('Naming up and down', () => {
    expect(stepUpSuggestion('naming-practice', settings({ syllables: [1, 2] }))).toContain('more syllables');
    expect(stepUpSuggestion('naming-practice', settings({ syllables: [] }))).toContain('Describe');
    expect(stepUpSuggestion('naming-test', settings())).toContain('repeat the screen');
    expect(stepDownSuggestion('naming-practice', settings({ syllables: [] }))).toContain('fewer syllables');
    expect(stepDownSuggestion('naming-practice', settings({ syllables: [1] }))).toContain('Flashcards');
    expect(stepDownSuggestion('naming-test', settings())).toContain('Naming Practice');
  });

  it('every suggestion is a non-empty plain sentence fragment for every activity', () => {
    const acts: ActivityId[] = [
      'comp-listen', 'comp-read', 'comp-listen-read', 'naming-practice', 'naming-describe', 'naming-test', 'naming-flashcards',
      'read-phrase-match', 'read-phrase-complete', 'read-sentence-match', 'read-sentence-complete', 'write-fill', 'write-copy', 'write-see', 'write-hear',
    ];
    for (const a of acts) {
      for (const s of [stepUpSuggestion(a, settings()), stepDownSuggestion(a, settings())]) {
        expect(s.length).toBeGreaterThan(8);
        expect(s).not.toMatch(/undefined|null|NaN/);
      }
    }
  });

  it('the full text carries the concrete step', () => {
    const down = recommend({ activity: 'write-copy', settings: settings({ tileLevel: 'hard' }), summary: summary({ correct: 3 }) });
    expect(down.level).toBe('down');
    expect(down.text).toContain('Medium');
    const up = recommend({ activity: 'write-copy', settings: settings({ tileLevel: 'easy' }), summary: summary({ correct: 10 }), previous: summary({ correct: 10 }) });
    expect(up.level).toBe('up');
    expect(up.text).toContain('Medium');
  });
});
