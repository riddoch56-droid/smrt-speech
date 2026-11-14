import { useMemo, useRef, useState } from 'react';
import { speakWord } from '../../app/content';
import { playCorrect } from '../../platform/audio';
import type { SessionItem } from '../../session/pool';
import { shuffle } from '../../session/rng';
import { useSessionContext } from '../../session/runtime';
import { finishTrial, recordResponse, startTrial } from '../../session/scoring';
import type { TrialRecord } from '../../session/types';
import { Icon } from '../../ui/Icon';
import { Button, ProgressBar } from '../../ui/kit';
import { Recorder, WordPicture } from '../../ui/parts';

/**
 * Flashcards: a free-practice deck. Next and Back by button or swipe, optional
 * tick or cross scoring, and record and playback.
 */
export function Flashcards({ deck, total, onFinish }: { deck: SessionItem[]; total: number | null; onFinish(trials: TrialRecord[]): void }) {
  const ctx = useSessionContext();
  const opts = ctx.settings.flashcards;
  const cards = useMemo(() => {
    const words = deck.flatMap((d) => (d.kind === 'word' ? [d.word] : []));
    const ordered = opts.shuffle ? shuffle(words) : words;
    if (total === null) return ordered;
    const out = [];
    for (let i = 0; i < total; i++) out.push(ordered[i % ordered.length]);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [scores, setScores] = useState<Record<number, TrialRecord>>({});
  const shownAt = useRef(performance.now());
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const word = cards[index];
  const needsReveal = !(opts.showPicture && opts.showWord);
  const isRevealed = !needsReveal || revealed.includes(index);
  const last = index === cards.length - 1;

  const go = (to: number) => {
    if (to < 0 || to >= cards.length) return;
    setIndex(to);
    shownAt.current = performance.now();
  };

  const finish = () => onFinish(Object.keys(scores).map(Number).sort((a, b) => a - b).map((k) => scores[k]));

  const reveal = () => {
    setRevealed((r) => (r.includes(index) ? r : [...r, index]));
    if (opts.speakOnReveal) speakWord(word);
  };

  const score = (named: boolean) => {
    let draft = startTrial(
      { index, itemId: word.id, label: word.word, group: word.group, activity: ctx.activity, choices: [] },
      shownAt.current,
    );
    draft = recordResponse(draft, named ? 'named' : 'not named', named, performance.now());
    setScores((s) => ({ ...s, [index]: finishTrial(draft, performance.now()) }));
    if (named) playCorrect();
    if (!isRevealed) reveal();
  };

  const scored = scores[index];

  return (
    <div className="session" data-testid="session">
      <div className="session-top">
        <Button icon="home" onClick={ctx.requestExit} data-testid="session-home">
          Home
        </Button>
        <div className="progress-wrap">
          <div className="count">
            <span data-testid="trial-count">
              {index + 1} of {cards.length}
            </span>
          </div>
          <ProgressBar value={index} max={cards.length} label="Deck progress" />
        </div>
        <Button icon="tick" variant={last ? 'primary' : 'default'} onClick={finish} data-testid="flash-finish">
          Finish
        </Button>
      </div>

      <div
        className="session-main flashcard"
        data-testid="flashcard"
        onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(index + (dx < 0 ? 1 : -1));
        }}
      >
        {(opts.showPicture || isRevealed) && <WordPicture key={`${word.id}:${index}`} word={word} />}
        {(opts.showWord || isRevealed) && (
          <div className="stimulus-word" data-testid="flash-word">
            {word.word}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'center' }}>
          {needsReveal && !isRevealed && (
            <Button icon="eye" variant="accent" onClick={reveal} data-testid="flash-reveal">
              Reveal
            </Button>
          )}
          <Button icon="speaker" onClick={() => speakWord(word)} data-testid="flash-speak">
            Hear it
          </Button>
          <Recorder key={index} word={word} />
        </div>
      </div>

      <div className="session-bottom">
        <div className="left">
          <Button icon="back" onClick={() => go(index - 1)} disabled={index === 0} data-testid="flash-back">
            Back
          </Button>
        </div>
        <div className="middle">
          {opts.scoring && (
            <div className="score-pair">
              <Button icon="tick" variant="good" selected={scored?.correct === true} onClick={() => score(true)} data-testid="score-tick">
                Named
              </Button>
              <Button icon="cross" selected={scored?.correct === false} onClick={() => score(false)} data-testid="score-cross">
                Not yet
              </Button>
              {scored && (
                <span className="tag" aria-live="polite">
                  <Icon name={scored.correct ? 'tick' : 'cross'} /> Marked
                </span>
              )}
            </div>
          )}
        </div>
        <div className="right">
          {last ? (
            <Button icon="tick" variant="primary" onClick={finish} data-testid="next">
              Finish
            </Button>
          ) : (
            <Button icon="next" variant="primary" onClick={() => go(index + 1)} data-testid="next">
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
