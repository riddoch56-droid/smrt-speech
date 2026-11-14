import { useEffect, useRef, useState } from 'react';
import { speakWord, wordImageSrc } from '../../app/content';
import { gridColumns } from '../../session/autoField';
import { arrangeChoices, selectFoils } from '../../session/foils';
import { FeedbackTick, SessionFrame, useSessionContext, useTrial } from '../../session/runtime';
import type { AppWord } from '../../session/words';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/kit';
import { useSize, WordPicture } from '../../ui/parts';

/**
 * Listen: spoken word, picture choices. Read: written word, picture choices.
 * Listen and Read: spoken word, written-word choices.
 */
export function ComprehensionTrial({ word }: { word: AppWord }) {
  const ctx = useSessionContext();
  const spoken = ctx.activity !== 'comp-read';
  const pictures = ctx.activity !== 'comp-listen-read';

  const [choices] = useState<AppWord[]>(() => {
    const foils = selectFoils({
      target: word,
      pool: ctx.foilPool,
      count: ctx.fieldSize - 1,
      difficulty: ctx.settings.difficulty,
      mode: pictures ? 'picture' : 'written',
      customPolicy: ctx.global.customFoils,
    });
    return arrangeChoices(word, foils, ctx.nextPosition(foils.length + 1));
  });

  const trial = useTrial({ itemId: word.id, label: word.word, group: word.group, choices: choices.map((c) => c.word) });
  const [wrong, setWrong] = useState<string[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const size = useSize(gridRef);

  useEffect(() => {
    if (!spoken) return;
    const t = window.setTimeout(() => speakWord(word), 350);
    return () => window.clearTimeout(t);
  }, [spoken, word]);

  const choose = (c: AppWord) => {
    if (trial.solved || wrong.includes(c.id)) return;
    if (c.id === word.id) {
      trial.respond(c.word, true);
      window.setTimeout(() => speakWord(word), 450);
      trial.succeed();
    } else {
      trial.respond(c.word, false);
      setWrong((w) => [...w, c.id]);
    }
  };

  const hint = () => {
    if (!hintShown) trial.hint();
    setHintShown(true);
    // Read: the hint speaks the word. Listen: it shows the written word. Listen and Read: it shows the picture.
    if (ctx.activity === 'comp-read') speakWord(word);
  };

  const cols = gridColumns(choices.length);
  const rows = Math.ceil(choices.length / cols);
  const gap = 16;
  const cell = pictures
    ? Math.max(90, Math.floor(Math.min((size.width - gap * (cols - 1)) / cols, (size.height - gap * (rows - 1)) / rows)))
    : 0;

  return (
    <SessionFrame
      onHint={trial.solved ? null : hint}
      onRepeat={spoken ? () => speakWord(word) : null}
      onNext={trial.waitingNext ? () => trial.complete() : null}
    >
      <div className="listen-prompt">
        {ctx.activity === 'comp-read' ? (
          <div className="stimulus-word" data-testid="stimulus-word">
            {word.word}
          </div>
        ) : (
          <>
            <Button icon="speaker" big variant="primary" onClick={() => speakWord(word)} label="Hear the word again" data-testid="hear-word" />
            {hintShown && ctx.activity === 'comp-listen' && (
              <div className="hint-reveal" data-testid="hint-reveal">
                {word.word}
              </div>
            )}
            {hintShown && ctx.activity === 'comp-listen-read' && wordImageSrc(word) && (
              <div className="hint-reveal" data-testid="hint-reveal">
                <img src={wordImageSrc(word)!} alt="" />
              </div>
            )}
          </>
        )}
        {trial.solved && <FeedbackTick />}
      </div>

      <div
        ref={gridRef}
        className="choice-grid"
        data-testid="choices"
        style={{
          gridTemplateColumns: pictures ? `repeat(${cols}, ${cell}px)` : `repeat(${Math.min(cols, 2)}, minmax(0, 420px))`,
          gridAutoRows: pictures ? `${cell}px` : undefined,
        }}
      >
        {choices.map((c) => {
          const isTarget = c.id === word.id;
          const state = trial.solved && isTarget ? ' right' : wrong.includes(c.id) ? ' wrong' : '';
          return (
            <button
              type="button"
              key={c.id}
              className={'choice' + (pictures ? '' : ' text') + state}
              onClick={() => choose(c)}
              aria-label={pictures ? `Picture choice ${choices.indexOf(c) + 1}` : undefined}
              aria-disabled={wrong.includes(c.id)}
              data-testid={isTarget ? 'choice-target' : 'choice-foil'}
            >
              {pictures ? <WordPicture word={c} /> : c.word}
              {trial.solved && isTarget && (
                <span className="mark">
                  <Icon name="tick" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </SessionFrame>
  );
}
