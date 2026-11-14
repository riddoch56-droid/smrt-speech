import { useState } from 'react';
import type { ReadingItem } from '../../content/types';
import { speak } from '../../platform/speech';
import { arrangeChoices } from '../../session/foils';
import { shuffle } from '../../session/rng';
import { FeedbackTick, SessionFrame, useSessionContext, useTrial } from '../../session/runtime';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/kit';
import { ReadingPicture } from '../../ui/parts';

export interface ReadingOptions {
  target: string;
  options: string[];
}

/** Builds the written choices for a reading trial: the target plus authored distractors. */
export function readingOptions(item: ReadingItem, completion: boolean, count: number, position: (size: number) => number): ReadingOptions {
  const target = completion ? item.answer : item.text;
  const pool = (completion ? item.answerDistractors : item.distractors).filter(
    (d, i, all) => d.trim().toLowerCase() !== target.trim().toLowerCase() && all.indexOf(d) === i,
  );
  const foils = shuffle(pool).slice(0, Math.max(1, count - 1));
  return { target, options: arrangeChoices(target, foils, position(foils.length + 1)) };
}

export function fillCloze(cloze: string, word: string): string {
  return cloze.replace(/_{2,}/, word);
}

/**
 * The four Reading activities: a picture with written choices.
 * Matching: choose the whole phrase or sentence. Completion: choose the missing word.
 */
export function ReadingTrial({ item }: { item: ReadingItem }) {
  const ctx = useSessionContext();
  const completion = ctx.activity === 'read-phrase-complete' || ctx.activity === 'read-sentence-complete';
  const [{ target, options }] = useState(() => readingOptions(item, completion, Math.min(4, ctx.fieldSize), ctx.nextPosition));
  const trial = useTrial({ itemId: item.id, label: item.text, group: item.group, choices: options });
  const [wrong, setWrong] = useState<string[]>([]);
  const [speakers, setSpeakers] = useState(ctx.settings.readAloud === 'always');

  const sayOption = (option: string) => speak(completion ? fillCloze(item.cloze, option) : option);

  const choose = (option: string) => {
    if (trial.solved || wrong.includes(option)) return;
    if (option === target) {
      trial.respond(option, true);
      window.setTimeout(() => speak(item.text), 450);
      trial.succeed({ delay: 2400 });
    } else {
      trial.respond(option, false);
      setWrong((w) => [...w, option]);
    }
  };

  // Hint only: the Hint button reveals the speaker buttons, and scores the trial incorrect.
  const hint = () => {
    if (speakers) return;
    trial.hint();
    setSpeakers(true);
  };

  return (
    <SessionFrame
      onHint={ctx.settings.readAloud === 'hint' && !trial.solved ? hint : null}
      hintDisabled={speakers}
      onNext={trial.waitingNext ? () => trial.complete() : null}
    >
      <div className="split">
        <div className="side">
          <ReadingPicture item={item} />
        </div>
        <div className="side">
          {completion && (
            <div className="stimulus-text" data-testid="cloze">
              {trial.solved ? item.text : item.cloze}
            </div>
          )}
          {trial.solved && <FeedbackTick />}
          <div className="option-list" data-testid="choices">
            {options.map((option) => {
              const isTarget = option === target;
              const state = trial.solved && isTarget ? ' right' : wrong.includes(option) ? ' wrong' : '';
              return (
                <div className="option-row" key={option}>
                  <button
                    type="button"
                    className={'choice text' + state}
                    onClick={() => choose(option)}
                    aria-disabled={wrong.includes(option)}
                    data-testid={isTarget ? 'choice-target' : 'choice-foil'}
                  >
                    {option}
                    {trial.solved && isTarget && (
                      <span className="mark">
                        <Icon name="tick" />
                      </span>
                    )}
                  </button>
                  {speakers && (
                    <Button icon="speaker" onClick={() => sayOption(option)} label={`Read this choice aloud`} data-testid="option-speaker" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SessionFrame>
  );
}
