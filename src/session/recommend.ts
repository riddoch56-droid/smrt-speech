import { activitiesFor, activityDef, type ActivityId, type Recommendation, type SessionSettings, type SessionSummary } from './types';

export const STEP_UP_PERCENT = 90;
export const STEP_DOWN_PERCENT = 50;

export interface RecommendInput {
  activity: ActivityId;
  settings: SessionSettings;
  summary: SessionSummary;
  /** Summary of the previous saved session of the same activity, if there is one. */
  previous?: SessionSummary | null;
}

function strong(s: SessionSummary): boolean {
  return s.total > 0 && s.percent >= STEP_UP_PERCENT && s.hints === 0;
}

function neighbour(activity: ActivityId, direction: 1 | -1): string | null {
  const def = activityDef(activity);
  const list = activitiesFor(def.module);
  const i = list.findIndex((a) => a.id === activity);
  return list[i + direction]?.title ?? null;
}

/** The concrete "step up" for an activity at its current settings. */
export function stepUpSuggestion(activity: ActivityId, s: SessionSettings): string {
  const def = activityDef(activity);
  const harder = neighbour(activity, 1);
  const next = harder ? `move on to ${harder}` : 'try a wider range of word groups';
  if (def.module === 'comprehension') {
    if (s.choices !== 'auto' && s.choices < 6) return `try ${s.choices + 1} choices`;
    if (s.difficulty === 'easy') return 'try Hard difficulty';
    return next;
  }
  if (def.module === 'reading') {
    if (s.choices !== 'auto' && s.choices < 4) return `try ${s.choices + 1} choices`;
    if (s.readAloud === 'always') return 'set Read aloud to Hint only';
    return next;
  }
  if (def.module === 'writing') {
    if (s.tileLevel === 'easy') return 'try the Medium tile level, with extra letters';
    if (s.tileLevel === 'medium') return 'try the Hard tile level, with the full alphabet';
    if (s.wordLengths.length > 0 && Math.max(...s.wordLengths) < 10) return 'include longer words';
    return next;
  }
  if (activity === 'naming-test') return 'repeat the screen at a later date to compare';
  if (s.syllables.length > 0 && Math.max(...s.syllables) < 5) return 'include longer words with more syllables';
  return next;
}

export function stepDownSuggestion(activity: ActivityId, s: SessionSettings): string {
  const def = activityDef(activity);
  const easier = neighbour(activity, -1);
  const prev = easier ? `go back to ${easier}` : 'use fewer, more familiar word groups';
  if (def.module === 'comprehension') {
    if (s.difficulty === 'hard') return 'try Easy difficulty';
    if (s.choices !== 'auto' && s.choices > 2) return `try ${s.choices - 1} choices`;
    return prev;
  }
  if (def.module === 'reading') {
    if (s.choices !== 'auto' && s.choices > 2) return `try ${s.choices - 1} choices`;
    if (s.readAloud === 'hint') return 'set Read aloud to Always on';
    return prev;
  }
  if (def.module === 'writing') {
    if (s.tileLevel === 'hard') return 'try the Medium tile level';
    if (s.tileLevel === 'medium') return 'try the Easy tile level, with only the letters needed';
    if (s.wordLengths.length === 0 || Math.max(...s.wordLengths) > 4) return 'use shorter words';
    return prev;
  }
  if (activity === 'naming-test') return 'use Naming Practice with cues between screens';
  if (s.syllables.length === 0 || Math.max(...s.syllables) > 1) return 'use shorter words with fewer syllables';
  return prev;
}

/**
 * Rule-based recommendation.
 *  - 90% or more with no hints, twice in a row: step up.
 *  - 50% or less: step down.
 *  - Otherwise: continue at this level.
 */
export function recommend(input: RecommendInput): Recommendation {
  const { activity, settings, summary, previous } = input;
  if (summary.total === 0) return { level: 'stay', text: 'No scored items in this session.' };
  if (summary.percent <= STEP_DOWN_PERCENT) {
    return {
      level: 'down',
      text: `${summary.percent}% correct. Consider an easier step: ${stepDownSuggestion(activity, settings)}.`,
    };
  }
  if (strong(summary)) {
    if (previous && strong(previous)) {
      return {
        level: 'up',
        text: `${summary.percent}% correct with no hints, twice in a row. Consider the next step up: ${stepUpSuggestion(activity, settings)}.`,
      };
    }
    return {
      level: 'stay',
      text: `${summary.percent}% correct with no hints. Continue at this level. One more session like this suggests moving up.`,
    };
  }
  return { level: 'stay', text: `${summary.percent}% correct. Continue at this level.` };
}
