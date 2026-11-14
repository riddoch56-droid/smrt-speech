import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../app/router';
import { useApp } from '../app/store';
import { SCREENER } from '../content';
import { ComprehensionTrial } from '../modules/comprehension/ComprehensionTrial';
import { DescribeTrial } from '../modules/naming/DescribeTrial';
import { Flashcards } from '../modules/naming/Flashcards';
import { NamingPracticeTrial } from '../modules/naming/NamingPracticeTrial';
import { NamingTestTrial } from '../modules/naming/NamingTestTrial';
import { ReadingTrial } from '../modules/reading/ReadingTrial';
import { WritingTrial } from '../modules/writing/WritingTrial';
import { playDone } from '../platform/audio';
import { db } from '../platform/db';
import { cancelSpeech } from '../platform/speech';
import { acquireWakeLock, releaseWakeLock } from '../platform/system';
import { GUEST } from '../settings/model';
import { Button, Modal } from '../ui/kit';
import { balancedPosition, initialAutoField, nextAutoField } from './autoField';
import { ItemQueue, plannedTotal } from './plan';
import { availableWords, buildPool, type SessionItem } from './pool';
import { recommend } from './recommend';
import { uid } from './rng';
import { SessionProvider, type SessionContextValue } from './runtime';
import { summarise } from './scoring';
import { useSession, type SessionRequest } from './store';
import { activityDef, type SessionRecord, type TrialRecord } from './types';

function TrialView({ item }: { item: SessionItem }) {
  const activity = useSession((s) => s.request?.activity);
  if (!activity) return null;
  if (item.kind === 'reading') return <ReadingTrial item={item.item} />;
  switch (activity) {
    case 'comp-listen':
    case 'comp-read':
    case 'comp-listen-read':
      return <ComprehensionTrial word={item.word} />;
    case 'naming-practice':
      return <NamingPracticeTrial word={item.word} />;
    case 'naming-describe':
      return <DescribeTrial word={item.word} />;
    case 'naming-test':
      return <NamingTestTrial word={item.word} />;
    default:
      return <WritingTrial word={item.word} />;
  }
}

export function SessionScreen({ request }: { request: SessionRequest }) {
  const { activity, settings, patientId } = request;
  const def = activityDef(activity);
  const finishSession = useSession((s) => s.finish);
  const abandon = useSession((s) => s.abandon);

  // Everything is fixed when the session starts, so later setting changes cannot disturb it.
  const setup = useMemo(() => {
    const state = useApp.getState();
    let pool = buildPool(activity, settings, state, patientId);
    if (request.itemIds) {
      const wanted = new Set(request.itemIds);
      pool = pool.filter((p) => wanted.has(p.id));
    }
    const fixedOrder = activity === 'naming-test';
    const queue = new ItemQueue(pool, Math.random, fixedOrder || (activity === 'naming-flashcards' && !settings.flashcards.shuffle));
    const fixed = fixedOrder ? pool.length : request.itemIds ? pool.length : undefined;
    return {
      global: state.settings,
      pool,
      queue,
      total: plannedTotal(settings.trials, pool.length, fixed),
      foilPool: availableWords(state, patientId, activity !== 'comp-listen-read'),
      startedAt: new Date(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [current, setCurrent] = useState<SessionItem | null>(() => setup.queue.next());
  const [trialIndex, setTrialIndex] = useState(0);
  const [completed, setCompleted] = useState<TrialRecord[]>([]);
  const [exitOpen, setExitOpen] = useState(false);
  const completedRef = useRef<TrialRecord[]>([]);
  const auto = useRef(initialAutoField());
  const positions = useRef<number[]>([]);
  const finished = useRef(false);
  const [fieldSize, setFieldSize] = useState(() => {
    const max = def.module === 'reading' ? 4 : 6;
    return settings.choices === 'auto' ? auto.current.size : Math.min(settings.choices, max);
  });

  useEffect(() => {
    void acquireWakeLock();
    const again = () => document.visibilityState === 'visible' && void acquireWakeLock();
    document.addEventListener('visibilitychange', again);
    return () => {
      document.removeEventListener('visibilitychange', again);
      void releaseWakeLock();
      cancelSpeech();
    };
  }, []);

  const finish = useCallback(
    async (trials: TrialRecord[]) => {
      if (finished.current) return;
      finished.current = true;
      cancelSpeech();
      const ended = new Date();
      const summary = summarise(trials);
      const guest = patientId === GUEST;
      let previous = null;
      if (!guest) {
        const earlier = await db.sessions.where('patientId').equals(patientId).toArray();
        previous =
          earlier
            .filter((s) => s.activity === activity)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]?.summary ?? null;
      }
      const record: SessionRecord = {
        id: uid(),
        patientId,
        activity,
        module: def.module,
        startedAt: setup.startedAt.toISOString(),
        endedAt: ended.toISOString(),
        durationMs: ended.getTime() - setup.startedAt.getTime(),
        settings,
        trials,
        summary,
        recommendation: recommend({ activity, settings, summary, previous }),
        note: '',
        ...(activity === 'naming-test' ? { screenerVersion: SCREENER.version } : {}),
      };
      const scored = trials.length > 0;
      const saved = scored && !guest;
      if (saved) await db.sessions.put(record);
      if (scored) playDone();
      finishSession({ record, saved, scored, request });
      navigate('/results', true);
    },
    [activity, def.module, finishSession, patientId, request, settings, setup.startedAt],
  );

  const commit = useCallback(
    (record: TrialRecord) => {
      const next = [...completedRef.current, record];
      completedRef.current = next;
      setCompleted(next);
      if (settings.choices === 'auto' && def.module === 'comprehension') {
        auto.current = nextAutoField(auto.current, record.correct);
        setFieldSize(auto.current.size);
      }
      if (setup.total !== null && next.length >= setup.total) {
        void finish(next);
        return;
      }
      const item = setup.queue.next();
      if (!item) {
        void finish(next);
        return;
      }
      setCurrent(item);
      setTrialIndex(next.length);
    },
    [def.module, finish, settings.choices, setup],
  );

  const ctx: SessionContextValue = useMemo(
    () => ({
      activity,
      settings,
      global: setup.global,
      foilPool: setup.foilPool,
      trialIndex,
      total: setup.total,
      completed,
      fieldSize,
      nextPosition: (size: number) => balancedPosition(positions.current, size, Math.random),
      commit,
      requestExit: () => setExitOpen(true),
    }),
    [activity, settings, setup, trialIndex, completed, fieldSize, commit],
  );

  const leave = () => {
    cancelSpeech();
    abandon();
    navigate('/', true);
  };

  if (!current) {
    return (
      <Modal title="Nothing to practise" actions={<Button onClick={leave}>Home</Button>}>
        <p>No items match these settings.</p>
      </Modal>
    );
  }

  const isFlashcards = activity === 'naming-flashcards';

  return (
    <SessionProvider value={ctx}>
      {isFlashcards ? (
        <Flashcards deck={setup.pool} total={setup.total} onFinish={(trials) => void finish(trials)} />
      ) : (
        <TrialView key={trialIndex} item={current} />
      )}
      {exitOpen && (
        <Modal
          title="Finish this session?"
          onClose={() => setExitOpen(false)}
          actions={
            <>
              <Button icon="play" variant="primary" onClick={() => setExitOpen(false)} data-testid="exit-continue">
                Keep going
              </Button>
              {!isFlashcards && completed.length > 0 && (
                <Button icon="tick" onClick={() => void finish(completedRef.current)} data-testid="exit-finish">
                  Finish and see results
                </Button>
              )}
              <Button icon="home" onClick={leave} data-testid="exit-leave">
                Leave without saving
              </Button>
            </>
          }
        >
          <p>
            {completed.length > 0
              ? `${completed.length} item${completed.length === 1 ? '' : 's'} done so far.`
              : 'No items have been completed yet.'}
          </p>
        </Modal>
      )}
    </SessionProvider>
  );
}
