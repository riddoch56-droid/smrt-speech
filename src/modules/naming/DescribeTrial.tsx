import { useMemo, useState } from 'react';
import { speakWord } from '../../app/content';
import { playCorrect } from '../../platform/audio';
import { speak } from '../../platform/speech';
import { FeedbackTick, SessionFrame, useSessionContext, useTrial } from '../../session/runtime';
import type { DescribeMark, DescribeStatus } from '../../session/types';
import type { AppWord } from '../../session/words';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/kit';
import { WordPicture } from '../../ui/parts';

interface PromptCard {
  id: string;
  label: string;
  /** Model answer shown on reveal. */
  answer: string;
  /** What is spoken on reveal, when it differs from the text. */
  say?: string;
  kind: 'meaning' | 'sound';
}

export function describeCards(word: AppWord, which: 'meaning' | 'sound' | 'both'): PromptCard[] {
  const s = word.semantic;
  const p = word.phonological;
  const meaning: PromptCard[] = [
    { id: 'category', label: 'Group', answer: s.category, kind: 'meaning' },
    { id: 'use', label: 'Use', answer: s.use, kind: 'meaning' },
    { id: 'action', label: 'Action', answer: s.action, kind: 'meaning' },
    { id: 'properties', label: 'Properties', answer: s.properties, kind: 'meaning' },
    { id: 'location', label: 'Location', answer: s.location, kind: 'meaning' },
    { id: 'association', label: 'Association', answer: s.association, kind: 'meaning' },
  ];
  const sound: PromptCard[] = [
    { id: 'firstSound', label: 'First sound', answer: p.firstSound ? `It starts with “${p.firstSound}”.` : '', say: word.cues.firstSoundSpoken, kind: 'sound' },
    { id: 'lastSound', label: 'Last sound', answer: p.lastSound ? `It ends with “${p.lastSound}”.` : '', say: p.lastSound ? 'This is the last sound.' : '', kind: 'sound' },
    { id: 'syllables', label: 'Syllables', answer: `${p.syllables} ${p.syllables === 1 ? 'syllable' : 'syllables'} (beats).`, kind: 'sound' },
    { id: 'rhyme', label: 'Rhymes with', answer: p.rhyme ? `It rhymes with “${p.rhyme}”.` : 'No common rhyme.', kind: 'sound' },
    { id: 'sameFirstSound', label: 'Same first sound', answer: p.sameFirstSound ? `“${p.sameFirstSound}” starts with the same sound.` : '', kind: 'sound' },
  ];
  const all = which === 'meaning' ? meaning : which === 'sound' ? sound : [...meaning, ...sound];
  return all.filter((c) => c.answer.trim().length > 0);
}

const MARKS: { status: DescribeStatus; icon: string; label: string }[] = [
  { status: 'independent', icon: 'tick', label: 'Said' },
  { status: 'afterReveal', icon: 'half', label: 'After reveal' },
  { status: 'notSaid', icon: 'cross', label: 'Not said' },
];

/** Describe: prompt cards around a picture, each revealed and marked, ending with a naming attempt. */
export function DescribeTrial({ word }: { word: AppWord }) {
  const ctx = useSessionContext();
  const cards = useMemo(() => describeCards(word, ctx.settings.describePrompts), [word, ctx.settings.describePrompts]);
  const trial = useTrial({ itemId: word.id, label: word.word, group: word.group });
  const [revealed, setRevealed] = useState<string[]>([]);
  const [marks, setMarks] = useState<Record<string, DescribeStatus>>({});
  const [scored, setScored] = useState<boolean | null>(null);

  const reveal = (card: PromptCard) => {
    setRevealed((r) => (r.includes(card.id) ? r : [...r, card.id]));
    speak(card.say ?? card.answer.replace(/[“”]/g, ''));
  };

  const score = (named: boolean) => {
    if (scored !== null) return;
    setScored(named);
    trial.respond(named ? 'named' : 'not named', named, { silent: true });
    if (named) playCorrect();
    window.setTimeout(() => speakWord(word), named ? 450 : 150);
    const describe: DescribeMark[] = cards.map((c) => ({ card: c.label, status: marks[c.id] ?? 'notSaid' }));
    trial.succeed({ describe, delay: 2200 });
  };

  const finishMarks = (): DescribeMark[] => cards.map((c) => ({ card: c.label, status: marks[c.id] ?? 'notSaid' }));

  const half = Math.ceil(cards.length / 2);
  const left = ctx.settings.describePrompts === 'both' ? cards.filter((c) => c.kind === 'meaning') : cards.slice(0, half);
  const right = ctx.settings.describePrompts === 'both' ? cards.filter((c) => c.kind === 'sound') : cards.slice(half);

  const renderCard = (card: PromptCard) => (
    <div className="prompt-card" key={card.id} data-testid={`card-${card.id}`}>
      <div className="prompt-row">
        <button type="button" className="head" onClick={() => reveal(card)} aria-expanded={revealed.includes(card.id)}>
          <Icon name={revealed.includes(card.id) ? 'speaker' : 'eye'} size={26} />
          <span>{card.label}</span>
        </button>
        <div className="marks" role="radiogroup" aria-label={`${card.label}: how it was said`}>
          {MARKS.map((m) => (
            <Button
              key={m.status}
              icon={m.icon}
              selected={marks[card.id] === m.status}
              role="radio"
              aria-checked={marks[card.id] === m.status}
              label={m.label}
              title={m.label}
              onClick={() => setMarks((prev) => ({ ...prev, [card.id]: m.status }))}
              data-testid={`mark-${card.id}-${m.status}`}
            />
          ))}
        </div>
      </div>
      {revealed.includes(card.id) && <div className="answer">{card.answer}</div>}
    </div>
  );

  return (
    <SessionFrame
      onNext={trial.waitingNext ? () => trial.complete({ describe: finishMarks() }) : null}
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
        ) : (
          <div className="row">
            {scored && <FeedbackTick />}
            <span className="stimulus-text" data-testid="model-word">
              {word.word}
            </span>
          </div>
        )
      }
    >
      <div className="describe-grid">
        <div className="describe-col">{left.map(renderCard)}</div>
        <div className="side" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 0 }}>
          <WordPicture word={word} />
          <div className="mark-legend" aria-hidden="true">
            {MARKS.map((m) => (
              <span key={m.status}>
                <Icon name={m.icon} size={20} /> {m.label}
              </span>
            ))}
          </div>
        </div>
        <div className="describe-col">{right.map(renderCard)}</div>
      </div>
    </SessionFrame>
  );
}
