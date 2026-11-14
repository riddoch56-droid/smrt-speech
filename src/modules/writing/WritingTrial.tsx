import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { speakWord } from '../../app/content';
import { playClick } from '../../platform/audio';
import { speak } from '../../platform/speech';
import { FeedbackTick, SessionFrame, useSessionContext, useTrial } from '../../session/runtime';
import {
  applyHint,
  chooseBlankIndex,
  createBoard,
  currentSpelling,
  isFull,
  isSolved,
  letterAt,
  placeTile,
  poolTiles,
  returnTile,
  submitBoard,
  type TileBoard,
} from '../../session/tiles';
import type { AppWord } from '../../session/words';
import { Button } from '../../ui/kit';
import { useSize, WordPicture } from '../../ui/parts';

type Phase = 'build' | 'review' | 'done';

interface Drag {
  tileId: number;
  letter: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moving: boolean;
}

const DRAG_THRESHOLD = 10;

/**
 * The four Writing activities: letter tiles and answer slots.
 * Tiles can be tapped or dragged (pointer events, which work on touch screens).
 * Check leads to a review step, and only Submit is marked.
 */
export function WritingTrial({ word }: { word: AppWord }) {
  const ctx = useSessionContext();
  const mode = ctx.activity;
  const [board, setBoard] = useState<TileBoard>(() =>
    createBoard(word.word, {
      level: ctx.settings.tileLevel,
      blankIndex: mode === 'write-fill' ? chooseBlankIndex(word.word) : undefined,
    }),
  );
  const trial = useTrial({ itemId: word.id, label: word.word, group: word.group });
  const [phase, setPhase] = useState<Phase>('build');
  const [wrongSlots, setWrongSlots] = useState<number[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const size = useSize(mainRef);

  const showPicture = mode !== 'write-hear';
  const spoken = mode === 'write-hear';

  useEffect(() => {
    if (!spoken) return;
    const t = window.setTimeout(() => speakWord(word), 350);
    return () => window.clearTimeout(t);
  }, [spoken, word]);

  const letterSound = (letter: string) => {
    const pref = ctx.global.letterSounds;
    if (pref === 'names') speak(letter.toUpperCase(), { rate: 1 });
    else if (pref === 'click') playClick();
  };

  const win = (b: TileBoard) => {
    setBoard(b);
    setPhase('done');
    window.setTimeout(() => speakWord(word), 450);
    trial.succeed({ delay: 2200 });
  };

  const tapTile = (tileId: number) => {
    if (phase !== 'build') return;
    const tile = board.tiles[tileId];
    letterSound(tile.letter);
    setWrongSlots([]);
    setBoard(placeTile(board, tileId));
  };

  const tapSlot = (slot: number) => {
    if (phase !== 'build') return;
    setBoard(returnTile(board, slot));
  };

  const slotAt = (x: number, y: number): number | 'pool' | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const slotEl = el?.closest<HTMLElement>('[data-slot]');
    if (slotEl) return Number(slotEl.dataset.slot);
    if (el?.closest('[data-pool]')) return 'pool';
    return null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, tileId: number) => {
    if (phase !== 'build') return;
    const tile = board.tiles[tileId];
    if (tile.slot !== null && board.locked[tile.slot]) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const d: Drag = { tileId, letter: tile.letter, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, moving: false };
    dragRef.current = d;
    setDrag(d);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const moving = d.moving || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD;
    const next = { ...d, x: e.clientX, y: e.clientY, moving };
    dragRef.current = next;
    setDrag(next);
    if (moving) {
      const target = slotAt(e.clientX, e.clientY);
      setOver(typeof target === 'number' ? target : null);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    setOver(null);
    if (!d) return;
    const tile = board.tiles[d.tileId];
    if (!d.moving) {
      // A tap: a pool tile fills the leftmost empty slot, a placed tile goes back.
      if (tile.slot === null) tapTile(d.tileId);
      else tapSlot(tile.slot);
      return;
    }
    const target = slotAt(e.clientX, e.clientY);
    if (typeof target === 'number') {
      letterSound(tile.letter);
      setWrongSlots([]);
      setBoard(placeTile(board, d.tileId, target));
    } else if (target === 'pool' && tile.slot !== null) {
      setBoard(returnTile(board, tile.slot));
    }
  };

  const submit = () => {
    const spelling = currentSpelling(board);
    const result = submitBoard(board);
    trial.respond(spelling, result.allCorrect);
    if (result.allCorrect) {
      win(result.board);
    } else {
      setBoard(result.board);
      setWrongSlots(result.wrongSlots);
      setPhase('build');
    }
  };

  const hint = () => {
    if (phase === 'done') return;
    trial.hint();
    const { board: next } = applyHint(board);
    setPhase('build');
    setWrongSlots([]);
    if (isSolved(next)) {
      trial.respond(next.target, true, { silent: false });
      win(next);
    } else {
      setBoard(next);
    }
  };

  const n = board.slots.length;
  const tile = Math.max(38, Math.min(72, Math.floor(((size.width || 900) - 8 * (n - 1) - 8) / n)));
  const full = isFull(board);
  const pool = poolTiles(board);

  return (
    <SessionFrame
      onHint={phase === 'done' ? null : hint}
      onRepeat={spoken ? () => speakWord(word) : null}
      onNext={trial.waitingNext ? () => trial.complete() : null}
      middle={
        phase === 'build' && full ? (
          <Button icon="eye" variant="primary" big onClick={() => setPhase('review')} data-testid="check">
            Check
          </Button>
        ) : phase === 'done' ? (
          <FeedbackTick />
        ) : null
      }
    >
      <div ref={mainRef} style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, ['--tile' as string]: `${tile}px` }}>
        {showPicture ? (
          <WordPicture word={word} />
        ) : (
          <Button icon="speaker" big variant="primary" onClick={() => speakWord(word)} label="Hear the word again" data-testid="hear-word" />
        )}
        {mode === 'write-copy' && (
          <div className="model-word" data-testid="model-word">
            {word.word}
          </div>
        )}

        <div className="slots" data-testid="slots" aria-label="Your word">
          {board.slots.map((id, i) => {
            const letter = letterAt(board, i);
            const cls =
              'slot' +
              (board.given[i] ? ' given' : board.locked[i] ? ' locked' : letter ? ' filled' : '') +
              (over === i ? ' over' : '') +
              (wrongSlots.includes(i) ? ' wrong' : '');
            const movable = id !== null && !board.locked[i] && !board.given[i] && phase === 'build';
            return (
              <div
                key={i}
                className={cls}
                data-slot={i}
                data-testid={`slot-${i}`}
                style={movable ? { touchAction: 'none', opacity: drag?.moving && drag.tileId === id ? 0.25 : 1 } : undefined}
                onPointerDown={movable ? (e) => onPointerDown(e, id!) : undefined}
                onPointerMove={movable ? onPointerMove : undefined}
                onPointerUp={movable ? onPointerUp : undefined}
                onPointerCancel={movable ? onPointerUp : undefined}
              >
                {letter ?? ''}
              </div>
            );
          })}
        </div>

        {phase === 'review' ? (
          <div className="review-box" data-testid="review">
            <span>Look at your word. Is it right?</span>
            <div className="row">
              <Button icon="edit" onClick={() => setPhase('build')} data-testid="change">
                Change
              </Button>
              <Button icon="tick" variant="primary" onClick={submit} data-testid="submit">
                Submit
              </Button>
            </div>
          </div>
        ) : (
          <div className="tile-pool" data-pool data-testid="tile-pool">
            {pool.map((t) => (
              <button
                type="button"
                key={t.id}
                className={'tile-letter' + (drag?.moving && drag.tileId === t.id ? ' ghost' : '')}
                data-testid={`tile-${t.letter}`}
                data-extra={t.extra ? 'true' : 'false'}
                aria-label={`Letter ${t.letter}`}
                onPointerDown={(e) => onPointerDown(e, t.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tapTile(t.id)}
              >
                {t.letter}
              </button>
            ))}
          </div>
        )}
      </div>
      {drag?.moving && (
        <div className="tile-letter dragging" style={{ left: drag.x - tile / 2, top: drag.y - tile / 2, ['--tile' as string]: `${tile}px` }}>
          {drag.letter}
        </div>
      )}
    </SessionFrame>
  );
}
