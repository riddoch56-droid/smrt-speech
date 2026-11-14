import { useState, type ReactNode } from 'react';
import { speakWord } from '../../app/content';
import { playCorrect } from '../../platform/audio';
import { speak, speakable } from '../../platform/speech';
import { FeedbackTick, SessionFrame, useTrial } from '../../session/runtime';
import { CUE_LABELS, CUE_ORDER, type CueType } from '../../session/types';
import type { AppWord } from '../../session/words';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/kit';
import { Recorder, WordPicture } from '../../ui/parts';

const CUE_ICONS: Record<CueType, string> = {
  definition: 'info',
  sentence: 'list',
  firstLetter: 'pencil',
  firstSound: 'ear',
  written: 'book',
  spoken: 'speaker',
};

function cueAvailable(word: AppWord, cue: CueType): boolean {
  if (cue === 'definition') return !!word.cues.definition;
  if (cue === 'sentence') return !!word.cues.sentenceCompletion;
  if (cue === 'firstSound') return !!word.cues.firstSoundSpoken;
  return true;
}

/**
 * Naming Practice: a picture, six cues available in a fixed order at any time, and
 * self-scoring with a tick or a cross.
 */
export function NamingPracticeTrial({ word }: { word: AppWord }) {
  const trial = useTrial({ itemId: word.id, label: word.word, group: word.group });
  const [shown, setShown] = useState<CueType | null>(null);
  const [scored, setScored] = useState<boolean | null>(null);

  const takeCue = (cue: CueType) => {
    if (scored !== null) return;
    trial.cue(cue);
    setShown(cue);
    if (cue === 'definition') speak(word.cues.definition);
    else if (cue === 'sentence') speak(speakable(word.cues.sentenceCompletion));
    else if (cue === 'firstSound') speak(word.cues.firstSoundSpoken);
    else if (cue === 'spoken') speakWord(word);
  };

  const score = (named: boolean) => {
    if (scored !== null) return;
    setScored(named);
    trial.respond(named ? 'named' : 'not named', named, { silent: true });
    if (named) playCorrect();
    // Every trial ends on the model: the word is shown and spoken.
    window.setTimeout(() => speakWord(word), named ? 450 : 150);
    trial.succeed({ delay: 2200 });
  };

  let panel: ReactNode = <span className="muted">Name the picture. Cues are there if needed.</span>;
  if (scored !== null) panel = <span data-testid="model-word">{word.word}</span>;
  else if (shown === 'definition') panel = word.cues.definition;
  else if (shown === 'sentence') panel = word.cues.sentenceCompletion;
  else if (shown === 'firstLetter') panel = <span className="letter">{word.cues.firstLetter.toUpperCase()}</span>;
  else if (shown === 'firstSound') panel = <Icon name="ear" size={56} />;
  else if (shown === 'written') panel = <span style={{ fontSize: 44 }}>{word.word}</span>;
  else if (shown === 'spoken') panel = <Icon name="speaker" size={56} />;

  return (
    <SessionFrame
      onNext={trial.waitingNext ? () => trial.complete() : null}
      middle={
        scored === null ? (
          <div className="score-pair">
            <Button icon="tick" variant="good" big onClick={() => score(true)} data-testid="score-tick">
              Named
            </Button>
            <Button icon="cross" big onClick={() => score(false)} data-testid="score-cross">
              Not yet
            </Button>
          </div>
        ) : scored ? (
          <FeedbackTick />
        ) : null
      }
    >
      <div className="split">
        <div className="side">
          <WordPicture word={word} />
        </div>
        <div className="side">
          <div className="cue-panel" data-testid="cue-panel" aria-live="polite">
            {panel}
          </div>
          <div className="cue-bar">
            {CUE_ORDER.map((cue, i) => (
              <Button
                key={cue}
                icon={CUE_ICONS[cue]}
                className={trial.cues.includes(cue) ? 'used' : ''}
                disabled={scored !== null || !cueAvailable(word, cue)}
                onClick={() => takeCue(cue)}
                data-testid={`cue-${cue}`}
              >
                {i + 1}. {CUE_LABELS[cue]}
              </Button>
            ))}
          </div>
          <Recorder word={word} />
        </div>
      </div>
    </SessionFrame>
  );
}
