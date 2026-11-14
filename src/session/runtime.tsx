import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GlobalSettings } from '../settings/model';
import { playCorrect, playIncorrect } from '../platform/audio';
import { cancelSpeech } from '../platform/speech';
import { Button, ProgressBar } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { finishTrial, recordCue, recordHint, recordResponse, startTrial, type TrialDraft } from './scoring';
import type { ActivityId, CueType, DescribeMark, SessionSettings, TrialRecord } from './types';
import type { AppWord } from './words';

export interface SessionContextValue {
  activity: ActivityId;
  settings: SessionSettings;
  global: GlobalSettings;
  /** Words that may be used as wrong choices. */
  foilPool: AppWord[];
  trialIndex: number;
  /** Null for a continuous session. */
  total: number | null;
  completed: TrialRecord[];
  /** Current number of choices (follows the Auto rule when set to Auto). */
  fieldSize: number;
  /** Returns a balanced position for the target among `size` choices. */
  nextPosition(size: number): number;
  commit(record: TrialRecord): void;
  /** Flashcards: step back to the previous card. */
  stepBack?(): void;
  requestExit(): void;
}

const Ctx = createContext<SessionContextValue | null>(null);

export const SessionProvider = Ctx.Provider;

export function useSessionContext(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('No session is running');
  return v;
}

export const ADVANCE_DELAY_MS = 1700;

export interface TrialInit {
  itemId: string;
  label: string;
  group: string;
  choices?: string[];
}

/**
 * Per-trial bookkeeping shared by every activity: responses, hints, cues and the
 * move to the next trial (automatic after a pause, or on Next).
 */
export function useTrial(init: TrialInit) {
  const ctx = useSessionContext();
  const draft = useRef<TrialDraft>(null as unknown as TrialDraft);
  if (draft.current === null) {
    draft.current = startTrial(
      {
        index: ctx.trialIndex,
        itemId: init.itemId,
        label: init.label,
        group: init.group,
        activity: ctx.activity,
        choices: init.choices ?? [],
        fieldSize: init.choices?.length,
      },
      performance.now(),
    );
  }
  const [hints, setHints] = useState(0);
  const [cues, setCues] = useState<CueType[]>([]);
  const [solved, setSolved] = useState(false);
  const [waitingNext, setWaitingNext] = useState(false);
  const timer = useRef<number | null>(null);
  const done = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const respond = useCallback((value: string, correct: boolean, opts: { silent?: boolean } = {}) => {
    draft.current = recordResponse(draft.current, value, correct, performance.now());
    if (!opts.silent) (correct ? playCorrect : playIncorrect)();
  }, []);

  const hint = useCallback(() => {
    draft.current = recordHint(draft.current);
    setHints(draft.current.hintsUsed);
  }, []);

  const cue = useCallback((type: CueType) => {
    draft.current = recordCue(draft.current, type);
    setCues(draft.current.cuesUsed);
  }, []);

  const setChoices = useCallback((choices: string[]) => {
    draft.current = { ...draft.current, choices, fieldSize: choices.length };
  }, []);

  const complete = useCallback(
    (extra: { skipped?: boolean; describe?: DescribeMark[] } = {}) => {
      if (done.current) return;
      done.current = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
      cancelSpeech();
      if (extra.skipped) draft.current = { ...draft.current, skipped: true };
      if (extra.describe) draft.current = { ...draft.current, describe: extra.describe };
      ctx.commit(finishTrial(draft.current, performance.now()));
    },
    [ctx],
  );

  /** Call when the trial has reached its successful end. */
  const succeed = useCallback(
    (extra: { describe?: DescribeMark[]; delay?: number } = {}) => {
      setSolved(true);
      if (ctx.global.autoAdvance) {
        timer.current = window.setTimeout(() => complete(extra), extra.delay ?? ADVANCE_DELAY_MS);
      } else {
        setWaitingNext(true);
      }
    },
    [complete, ctx.global.autoAdvance],
  );

  return { respond, hint, cue, complete, succeed, setChoices, hints, cues, solved, waitingNext };
}

export function scoreSoFar(trials: readonly TrialRecord[]): { correct: number; total: number } {
  return { correct: trials.filter((t) => t.correct).length, total: trials.length };
}

interface FrameProps {
  children: ReactNode;
  onHint?: (() => void) | null;
  hintDisabled?: boolean;
  onRepeat?: (() => void) | null;
  /** Extra controls for the middle of the bottom bar. */
  middle?: ReactNode;
  onNext?: (() => void) | null;
  nextLabel?: string;
  hideScore?: boolean;
}

/**
 * The frame every activity shares, so controls never move:
 * Home and progress at the top, Hint (left) and Repeat (right) at the bottom.
 */
export function SessionFrame({ children, onHint, hintDisabled, onRepeat, middle, onNext, nextLabel, hideScore }: FrameProps) {
  const ctx = useSessionContext();
  const score = scoreSoFar(ctx.completed);
  const position = ctx.trialIndex + 1;
  return (
    // data-theme="light": the therapy canvas is white with dark text whatever the app theme.
    <div className="session" data-theme="light" data-testid="session">
      <div className="session-top">
        <Button icon="home" onClick={ctx.requestExit} data-testid="session-home">
          Home
        </Button>
        <div className="progress-wrap">
          <div className="count">
            <span data-testid="trial-count">{ctx.total ? `${Math.min(position, ctx.total)} of ${ctx.total}` : `Item ${position}`}</span>
            {ctx.global.showScore && !hideScore && score.total > 0 && (
              <span data-testid="live-score">
                {score.correct} correct of {score.total}
              </span>
            )}
          </div>
          {ctx.total ? <ProgressBar value={ctx.trialIndex} max={ctx.total} label="Session progress" /> : <div style={{ height: 14 }} />}
        </div>
        {!ctx.total && (
          <Button icon="stop" onClick={ctx.requestExit}>
            Finish
          </Button>
        )}
      </div>
      <div className="session-main">{children}</div>
      <div className="session-bottom">
        <div className="left">
          {onHint !== undefined && onHint !== null && (
            <Button icon="hint" variant="accent" onClick={onHint} disabled={hintDisabled} data-testid="hint">
              Hint
            </Button>
          )}
        </div>
        <div className="middle">{middle}</div>
        <div className="right">
          {onRepeat && (
            <Button icon="speaker" onClick={onRepeat} data-testid="repeat">
              Repeat
            </Button>
          )}
          {onNext && (
            <Button icon="next" variant="primary" onClick={onNext} data-testid="next">
              {nextLabel ?? 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackTick() {
  return (
    <div className="feedback-tick" role="img" aria-label="Correct" data-testid="correct-tick">
      <Icon name="tick" />
    </div>
  );
}
