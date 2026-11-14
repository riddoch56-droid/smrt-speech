import { useEffect, useMemo, useState } from 'react';
import { groupOptions } from '../app/content';
import { navigate } from '../app/router';
import { patientLabel, useApp } from '../app/store';
import { kvGet, kvSet } from '../platform/db';
import { primeSpeech } from '../platform/speech';
import { unlockAudio } from '../platform/audio';
import { GUEST } from '../settings/model';
import { ACTIVITY_ART, asset } from '../ui/assets';
import { Button, MultiChips, Screen, Segmented, Toggle } from '../ui/kit';
import { buildPool, lastSettingsKey } from './pool';
import { useSession } from './store';
import {
  activityDef,
  DEFAULT_SESSION_SETTINGS,
  type ActivityId,
  type FieldSize,
  type SessionSettings,
  type TrialCount,
} from './types';

function defaultsFor(activity: ActivityId): SessionSettings {
  const def = activityDef(activity);
  return { ...DEFAULT_SESSION_SETTINGS, choices: def.module === 'reading' ? 3 : 4 };
}

const TRIAL_OPTIONS: { value: TrialCount; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 'continuous', label: 'Until stopped' },
];

export function SetupScreen({ activity }: { activity: ActivityId }) {
  const def = activityDef(activity);
  const state = useApp();
  const patientId = state.currentPatientId;
  const [settings, setSettings] = useState<SessionSettings>(() => defaultsFor(activity));
  const [loaded, setLoaded] = useState(false);
  const start = useSession((s) => s.start);

  useEffect(() => {
    if (!patientId) return;
    let live = true;
    void kvGet<Partial<SessionSettings> | null>(lastSettingsKey(patientId, activity), null).then((saved) => {
      if (!live) return;
      if (saved) setSettings({ ...defaultsFor(activity), ...saved, flashcards: { ...DEFAULT_SESSION_SETTINGS.flashcards, ...saved.flashcards } });
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [patientId, activity]);

  const patch = (p: Partial<SessionSettings>) => setSettings((s) => ({ ...s, ...p }));
  const groups = groupOptions(state);
  const pool = useMemo(
    () => (patientId ? buildPool(activity, settings, state, patientId) : []),
    [activity, settings, state, patientId],
  );
  const minimum = def.module === 'comprehension' ? 2 : 1;
  const canStart = pool.length >= minimum;

  if (!patientId) {
    return (
      <Screen title={def.title} back={`/module/${def.module}`} art={asset(ACTIVITY_ART[activity])}>
        <div className="card stack">
          <h2>Who is this session for?</h2>
          <p>Choose a patient on the Home screen, or practise as a guest. Guest sessions are not saved.</p>
          <div className="row">
            <Button icon="home" onClick={() => navigate('/')}>
              Choose a patient
            </Button>
            <Button icon="eye" variant="primary" onClick={() => state.setCurrentPatient(GUEST)} data-testid="use-guest">
              Practise as guest
            </Button>
          </div>
        </div>
      </Screen>
    );
  }

  const begin = async () => {
    // Starting a session is a user gesture: unlock speech and sound now.
    primeSpeech();
    unlockAudio();
    await kvSet(lastSettingsKey(patientId, activity), settings);
    state.lock();
    start({ activity, settings, patientId });
    navigate('/session');
  };

  const isTest = activity === 'naming-test';
  const fieldOptions: { value: FieldSize; label: string }[] =
    def.module === 'reading'
      ? [2, 3, 4].map((n) => ({ value: n as FieldSize, label: String(n) }))
      : [...[2, 3, 4, 5, 6].map((n) => ({ value: n as FieldSize, label: String(n) })), { value: 'auto' as FieldSize, label: 'Auto' }];

  return (
    <Screen title={def.title} back={`/module/${def.module}`} art={asset(ACTIVITY_ART[activity])}>
      <div className="row spread">
        <p className="muted">
          {def.blurb}. Session for <strong>{patientLabel(state)}</strong>.
        </p>
      </div>

      {isTest ? (
        <div className="card stack">
          <h2>Informal naming screen</h2>
          <p>
            A fixed set of {pool.length} pictures in a fixed order, with no cues and no feedback. Mark each response with the
            tick or the cross. Skip counts as incorrect.
          </p>
          <p className="muted">This is an informal screen for comparing sessions over time. It is not a standardised assessment.</p>
        </div>
      ) : (
        <div className="card stack" style={{ gap: 22, opacity: loaded ? 1 : 0.6 }}>
          <MultiChips
            label="Word groups"
            help="Choose one or more. With none chosen, all groups are used."
            options={groups.map((g) => ({ value: g.id, label: g.label }))}
            values={settings.groups}
            onChange={(v) => patch({ groups: v })}
          />
          <Segmented label="Number of items" options={TRIAL_OPTIONS} value={settings.trials} onChange={(v) => patch({ trials: v })} />

          {(def.module === 'comprehension' || def.module === 'reading') && (
            <Segmented
              label="Number of choices"
              options={fieldOptions}
              value={def.module === 'reading' && (settings.choices === 'auto' || settings.choices > 4) ? 4 : settings.choices}
              onChange={(v) => patch({ choices: v })}
            />
          )}
          {def.module === 'comprehension' && (
            <>
              {settings.choices === 'auto' && (
                <p className="muted small">Auto starts at 2 choices, adds one after three correct in a row and removes one after two incorrect in a row.</p>
              )}
              <Segmented
                label="Difficulty"
                options={[
                  { value: 'easy', label: 'Easy: unrelated choices' },
                  { value: 'hard', label: 'Hard: similar choices' },
                ]}
                value={settings.difficulty}
                onChange={(v) => patch({ difficulty: v })}
              />
            </>
          )}

          {def.module === 'naming' && (
            <MultiChips
              label="Syllables"
              help="With none chosen, all word lengths are used."
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? '5+' : String(n) }))}
              values={settings.syllables}
              onChange={(v) => patch({ syllables: v })}
            />
          )}
          {activity === 'naming-describe' && (
            <Segmented
              label="Prompts"
              options={[
                { value: 'meaning', label: 'Meaning' },
                { value: 'sound', label: 'Sound' },
                { value: 'both', label: 'Both' },
              ]}
              value={settings.describePrompts}
              onChange={(v) => patch({ describePrompts: v })}
            />
          )}
          {activity === 'naming-flashcards' && (
            <div className="stack" style={{ gap: 0 }}>
              {(
                [
                  ['showPicture', 'Show picture'],
                  ['showWord', 'Show word'],
                  ['speakOnReveal', 'Speak word on reveal'],
                  ['shuffle', 'Shuffle'],
                  ['scoring', 'Tick or cross scoring'],
                ] as const
              ).map(([key, label]) => (
                <Toggle
                  key={key}
                  label={label}
                  checked={settings.flashcards[key]}
                  onChange={(v) => {
                    const next = { ...settings.flashcards, [key]: v };
                    // A card must show something.
                    if (!next.showPicture && !next.showWord) next[key === 'showPicture' ? 'showWord' : 'showPicture'] = true;
                    patch({ flashcards: next });
                  }}
                />
              ))}
            </div>
          )}

          {def.module === 'reading' && (
            <Segmented
              label="Read aloud"
              options={[
                { value: 'hint', label: 'Hint only' },
                { value: 'always', label: 'Always on' },
              ]}
              value={settings.readAloud}
              onChange={(v) => patch({ readAloud: v })}
            />
          )}

          {def.module === 'writing' && (
            <>
              <Segmented
                label="Tile level"
                options={[
                  { value: 'easy', label: 'Easy: only the letters needed' },
                  { value: 'medium', label: 'Medium: a few extra letters' },
                  { value: 'hard', label: 'Hard: full alphabet' },
                ]}
                value={settings.tileLevel}
                onChange={(v) => patch({ tileLevel: v })}
              />
              <MultiChips
                label="Word length (letters)"
                help="With none chosen, all lengths are used."
                options={[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: n === 10 ? '10+' : String(n) }))}
                values={settings.wordLengths}
                onChange={(v) => patch({ wordLengths: v })}
              />
            </>
          )}
        </div>
      )}

      <div className="row spread">
        <span className={canStart ? 'muted' : 'error'} data-testid="pool-count">
          {canStart ? `${pool.length} items available` : 'No items match these settings. Choose more groups or widen the filters.'}
        </span>
        <Button icon="play" variant="primary" big disabled={!canStart || !loaded} onClick={begin} data-testid="start-session">
          Start
        </Button>
      </div>
    </Screen>
  );
}
