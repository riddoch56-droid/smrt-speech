import { SessionFrame, useTrial } from '../../session/runtime';
import type { AppWord } from '../../session/words';
import { Button } from '../../ui/kit';
import { WordPicture } from '../../ui/parts';

/**
 * Naming Test: the fixed informal screen. No cues, no feedback, no sounds.
 * The therapist marks tick or cross; Skip is scored incorrect.
 */
export function NamingTestTrial({ word }: { word: AppWord }) {
  const trial = useTrial({ itemId: word.id, label: word.word, group: word.group });

  const mark = (value: 'named' | 'not named' | 'skipped') => {
    trial.respond(value, value === 'named', { silent: true });
    trial.complete(value === 'skipped' ? { skipped: true } : {});
  };

  return (
    <SessionFrame
      hideScore
      middle={
        <div className="score-pair">
          <Button icon="tick" big onClick={() => mark('named')} data-testid="score-tick">
            Correct
          </Button>
          <Button icon="cross" big onClick={() => mark('not named')} data-testid="score-cross">
            Incorrect
          </Button>
          <Button icon="skip" big onClick={() => mark('skipped')} data-testid="score-skip">
            Skip
          </Button>
        </div>
      }
    >
      <WordPicture word={word} />
      <p className="muted small">Informal screen. No cues or feedback.</p>
    </SessionFrame>
  );
}
