import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useApp } from '../app/store';
import { readingImageSrc, speakWord, wordImageSrc } from '../app/content';
import type { ReadingItem } from '../content/types';
import { recordingSupported, startRecording, type ActiveRecording } from '../platform/recorder';
import type { AppWord } from '../session/words';
import { Icon } from './Icon';
import { Button } from './kit';

function Picture({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="picture placeholder" role="img" aria-label="No picture available">
        <Icon name="image" size={72} />
      </div>
    );
  }
  return (
    <div className="picture">
      <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} />
    </div>
  );
}

/** The picture for a word. The alt text never names the target. */
export function WordPicture({ word }: { word: AppWord }) {
  const version = useApp((s) => s.contentVersion);
  return <Picture key={`${word.id}:${version}`} src={wordImageSrc(word)} alt="Picture" />;
}

export function ReadingPicture({ item }: { item: ReadingItem }) {
  return <Picture key={item.id} src={readingImageSrc(item)} alt="Picture" />;
}

export function WordThumb({ word, size = 72 }: { word: AppWord; size?: number }) {
  const src = wordImageSrc(word);
  return src ? (
    <img className="thumb" src={src} alt="" style={{ width: size, height: size }} loading="lazy" />
  ) : (
    <span className="thumb empty" style={{ width: size, height: size }}>
      <Icon name="image" size={size / 2} />
    </span>
  );
}

/** Measures an element so grids can be sized to fit the space exactly. */
export function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * Record the patient's attempt and play it back next to the model.
 * The clip is held in memory for this trial only and is never saved.
 */
export function Recorder({ word }: { word: AppWord }) {
  const [state, setState] = useState<'idle' | 'recording' | 'ready'>('idle');
  const [available, setAvailable] = useState(recordingSupported());
  const active = useRef<ActiveRecording | null>(null);
  const url = useRef<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      active.current?.cancel();
      player.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  if (!available) return null;

  const start = async () => {
    try {
      active.current = await startRecording();
      setState('recording');
    } catch {
      // Permission refused: hide the controls and carry on without recording.
      setAvailable(false);
    }
  };

  const stop = async () => {
    const rec = active.current;
    active.current = null;
    if (!rec) return;
    const blob = await rec.stop();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(blob);
    setState('ready');
  };

  const playMine = () => {
    if (!url.current) return;
    player.current?.pause();
    player.current = new Audio(url.current);
    void player.current.play();
  };

  return (
    <div className="row" data-testid="recorder">
      {state === 'recording' ? (
        <Button icon="stop" variant="danger" onClick={stop} data-testid="record-stop">
          Stop
        </Button>
      ) : (
        <Button icon="mic" onClick={start} data-testid="record-start">
          {state === 'ready' ? 'Record again' : 'Record'}
        </Button>
      )}
      {state === 'ready' && (
        <>
          <Button icon="play" onClick={playMine} data-testid="record-play">
            My attempt
          </Button>
          <Button icon="speaker" onClick={() => speakWord(word)} data-testid="record-model">
            Model
          </Button>
        </>
      )}
    </div>
  );
}
