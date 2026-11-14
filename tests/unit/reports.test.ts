import { describe, expect, it } from 'vitest';
import {
  accuracySeries,
  activitySummary,
  cueEffectiveness,
  filterSessions,
  groupBreakdown,
  screenerSeries,
  sessionDate,
  weakerGroups,
} from '../../src/reports/aggregate';
import { csvCell, progressCsv, sessionCsv } from '../../src/reports/csv';
import { buildProgressPdf, buildSessionPdf, describeSettings, sanitiseText, type ReportHeader } from '../../src/reports/pdf';
import { summarise } from '../../src/session/scoring';
import {
  DEFAULT_SESSION_SETTINGS,
  activityDef,
  type ActivityId,
  type CueType,
  type SessionRecord,
  type SessionSettings,
  type TrialRecord,
} from '../../src/session/types';
import { EMPTY_PRACTITIONER } from '../../src/settings/model';

const LABELS: Record<string, string> = { food: 'Food', animals: 'Animals', home: 'Home', tools: 'Tools' };
const groupLabel = (id: string) => LABELS[id] ?? 'My words';

interface TrialSpec {
  label: string;
  group: string;
  outcome: 'correct' | 'cued' | 'incorrect';
  cues?: CueType[];
  hints?: number;
}

function trial(i: number, activity: ActivityId, spec: TrialSpec): TrialRecord {
  const correct = spec.outcome === 'correct';
  const cues = spec.cues ?? [];
  const hints = spec.hints ?? 0;
  return {
    index: i,
    itemId: `w-${spec.label}`,
    label: spec.label,
    group: spec.group,
    activity,
    choices: [spec.label, 'other', 'another', 'fourth'],
    responses:
      spec.outcome === 'incorrect'
        ? [
            { value: 'other', correct: false, at: 1800 },
            { value: spec.label, correct: true, at: 3500 },
          ]
        : [{ value: spec.label, correct: true, at: 1500 + i * 100 }],
    firstAttemptCorrect: spec.outcome !== 'incorrect',
    hintsUsed: hints,
    cuesUsed: cues,
    attempts: spec.outcome === 'incorrect' ? 2 : 1,
    responseTimeMs: spec.outcome === 'incorrect' ? 1800 : 1500 + i * 100,
    durationMs: 4000,
    correct,
    outcome: spec.outcome,
  };
}

const GROUPS = ['food', 'animals', 'home', 'tools'];

function session(
  id: string,
  activity: ActivityId,
  date: Date,
  outcomes: ('correct' | 'cued' | 'incorrect')[],
  extra: Partial<SessionRecord> = {},
  settings: Partial<SessionSettings> = {},
): SessionRecord {
  const trials = outcomes.map((o, i) =>
    trial(i, activity, {
      label: `word${i + 1}`,
      group: GROUPS[i % GROUPS.length],
      outcome: o,
      cues: o === 'cued' ? ['firstLetter', 'spoken'] : [],
      hints: o === 'cued' && activity !== 'naming-practice' ? 1 : 0,
    }),
  );
  return {
    id,
    patientId: 'p1',
    activity,
    module: activityDef(activity).module,
    startedAt: date.toISOString(),
    endedAt: new Date(date.getTime() + 300_000).toISOString(),
    durationMs: 300_000,
    settings: { ...DEFAULT_SESSION_SETTINGS, groups: ['food', 'animals'], ...settings },
    trials,
    summary: summarise(trials),
    recommendation: { level: 'stay', text: 'Continue at this level for another session.' },
    note: '',
    ...extra,
  };
}

const R = 'correct' as const;
const C = 'cued' as const;
const X = 'incorrect' as const;

const s1 = session('s1', 'comp-listen', new Date(2026, 0, 5, 10, 0), [R, R, X, R, X, R, R, X, R, R]);
const s2 = session('s2', 'comp-listen', new Date(2026, 0, 19, 10, 0), [R, R, R, R, X, R, R, R, R, R]);
const s3 = session('s3', 'naming-practice', new Date(2026, 1, 2, 14, 30), [R, C, C, X, R, C, X, R]);
const t1 = session('t1', 'naming-test', new Date(2026, 1, 9, 9, 0), [R, X, X, R, X, X, R, X, R, R, X, X], { screenerVersion: 1 });
const t2 = session('t2', 'naming-test', new Date(2026, 2, 9, 9, 0), [R, R, X, R, X, R, R, X, R, R, X, R], { screenerVersion: 1 });
const empty = session('e1', 'comp-read', new Date(2026, 2, 12, 9, 0), []);
const ALL = [s3, s2, t2, s1, t1, empty]; // deliberately unsorted

const header: ReportHeader = {
  practitioner: {
    name: 'Dr Sam Example',
    credentials: 'SLT, MRCSLT',
    practice: 'Example Therapy Clinic',
    contact: 'sam@example.org',
  },
  patientCode: 'SS-014',
  generated: new Date(2026, 3, 1, 12, 0),
  groupLabel,
};

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.slice(from, to));
}

describe('filterSessions', () => {
  it('sorts oldest first and drops nothing without filters', () => {
    const out = filterSessions(ALL, {});
    expect(out.map((s) => s.id)).toEqual(['s1', 's2', 's3', 't1', 't2', 'e1']);
  });
  it('filters by module, activity and inclusive date range', () => {
    expect(filterSessions(ALL, { module: 'naming' }).map((s) => s.id)).toEqual(['s3', 't1', 't2']);
    expect(filterSessions(ALL, { activities: ['naming-test'] }).map((s) => s.id)).toEqual(['t1', 't2']);
    expect(filterSessions(ALL, { activities: [] })).toHaveLength(ALL.length);
    expect(filterSessions(ALL, { from: '2026-01-19', to: '2026-02-02' }).map((s) => s.id)).toEqual(['s2', 's3']);
    expect(filterSessions(ALL, { from: '2026-03-01' }).map((s) => s.id)).toEqual(['t2', 'e1']);
  });
  it('formats the local session date', () => {
    expect(sessionDate(s3)).toBe('2026-02-02');
  });
});

describe('accuracySeries', () => {
  it('groups by activity in date order and skips empty sessions', () => {
    const series = accuracySeries(ALL);
    expect(series['comp-listen']?.map((p) => p.percent)).toEqual([70, 90]);
    expect(series['comp-listen']?.map((p) => p.sessionId)).toEqual(['s1', 's2']);
    expect(series['comp-read']).toBeUndefined();
    expect(series['naming-test']).toHaveLength(2);
  });
});

describe('groupBreakdown and weakerGroups', () => {
  it('totals by group, weakest first', () => {
    const rows = groupBreakdown([s1, s2]);
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(20);
    expect(rows.reduce((n, r) => n + r.correct, 0)).toBe(16);
    for (let i = 1; i < rows.length; i++) expect(rows[i].percent).toBeGreaterThanOrEqual(rows[i - 1].percent);
  });
  it('flags groups well below the rest', () => {
    const rows = [
      { group: 'a', total: 10, correct: 3, percent: 30 },
      { group: 'b', total: 10, correct: 9, percent: 90 },
      { group: 'c', total: 1, correct: 0, percent: 0 },
      { group: 'd', total: 10, correct: 7, percent: 70 },
    ];
    expect(weakerGroups(rows, 75)).toEqual(['a']);
    expect(weakerGroups(rows, 95)).toEqual(['a', 'd']);
  });
});

describe('cueEffectiveness', () => {
  it('counts cues used and the last cue before success', () => {
    const rows = cueEffectiveness([s3]);
    const spoken = rows.find((r) => r.cue === 'spoken');
    const first = rows.find((r) => r.cue === 'firstLetter');
    expect(first?.used).toBe(3);
    expect(spoken?.used).toBe(3);
    expect(spoken?.beforeSuccess).toBe(3);
    expect(first?.beforeSuccess).toBe(0);
    expect(rows.find((r) => r.cue === 'definition')?.used).toBe(0);
  });
});

describe('screenerSeries', () => {
  it('returns only Naming Test sessions oldest first', () => {
    const out = screenerSeries(ALL);
    expect(out.map((p) => p.sessionId)).toEqual(['t1', 't2']);
    expect(out[0].version).toBe(1);
    expect(out[1].correct).toBeGreaterThan(out[0].correct);
  });
});

describe('activitySummary', () => {
  it('summarises each activity with first and last accuracy', () => {
    const rows = activitySummary(ALL);
    const listen = rows.find((r) => r.activity === 'comp-listen');
    expect(listen).toMatchObject({ sessions: 2, items: 20, correct: 16, percent: 80, firstPercent: 70, lastPercent: 90 });
    expect(rows.find((r) => r.activity === 'comp-read')).toBeUndefined();
  });
});

describe('describeSettings', () => {
  it('only lists settings relevant to the module', () => {
    const comp = describeSettings(s1, groupLabel).map((r) => r.label);
    expect(comp).toContain('Number of choices');
    expect(comp).not.toContain('Tile level');
    const writing = session('w', 'write-see', new Date(2026, 0, 1), [R], {}, { wordLengths: [4, 10], tileLevel: 'hard' });
    const rows = describeSettings(writing, groupLabel);
    expect(rows.find((r) => r.label === 'Word length')?.value).toBe('4 letters, 10+ letters');
    expect(rows.find((r) => r.label === 'Tile level')?.value).toBe('Hard');
    expect(rows.find((r) => r.label === 'Word groups')?.value).toBe('Food, Animals');
  });
  it('describes the screener without per-session options', () => {
    const rows = describeSettings(t1, groupLabel);
    expect(rows.some((r) => r.label === 'Number of trials')).toBe(false);
    expect(rows.find((r) => r.label === 'Screen version')?.value).toBe('1');
  });
  it('shows all groups when none are chosen and continuous trials', () => {
    const rows = describeSettings(session('c', 'comp-read', new Date(2026, 0, 1), [R], {}, { groups: [], trials: 'continuous', choices: 'auto' }), groupLabel);
    expect(rows.find((r) => r.label === 'Word groups')?.value).toBe('All groups');
    expect(rows.find((r) => r.label === 'Number of trials')?.value).toContain('Continuous');
    expect(rows.find((r) => r.label === 'Number of choices')?.value).toContain('Auto');
  });
});

describe('csv', () => {
  it('quotes, escapes and guards cells', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@home')).toBe("'@home");
    expect(csvCell('=1,2')).toBe('"\'=1,2"');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(null)).toBe('');
  });

  it('writes a session with a BOM, CRLF and one row per trial', () => {
    const s = session('x', 'naming-practice', new Date(2026, 4, 5, 9, 5), [R, C, X], { note: '=cmd' });
    s.trials[0].label = 'cup, "mug"';
    const csv = sessionCsv(s, 'SS-014', groupLabel);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[lines.length - 1]).toBe('');
    expect(/(^|[^\r])\n/.test(csv)).toBe(false); // every line break is CRLF
    const body = lines.filter((l) => l !== '');
    expect(body[0]).toBe('Patient ID,SS-014');
    expect(body[1]).toBe('Date,2026-05-05');
    expect(body.some((l) => l.startsWith('Activity,Naming Practice'))).toBe(true);
    expect(body.some((l) => l === 'Accuracy,1/3 (33%)')).toBe(true);
    const headerIdx = body.findIndex((l) => l.startsWith('No.,Target'));
    expect(body.length - headerIdx - 1).toBe(3);
    expect(body[headerIdx + 1]).toContain('"cup, ""mug"""');
  });

  it('writes one progress row per session, oldest first', () => {
    const csv = progressCsv(ALL, 'SS-014');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n').filter((l) => l !== '');
    expect(lines).toHaveLength(ALL.length + 1);
    expect(lines[0].startsWith('Patient ID,Date')).toBe(true);
    expect(lines[1]).toContain('2026-01-05');
    expect(lines[1]).toContain('Listen');
    expect(lines[lines.length - 1]).toContain('Read');
    expect(csv).not.toContain('\n\n');
  });

  it('guards formulas in notes', () => {
    const s = session('n', 'comp-listen', new Date(2026, 0, 1), [R], { note: '@evil, "x"' });
    expect(progressCsv([s], 'A')).toContain('"\'@evil, ""x"""');
  });
});

describe('sanitiseText', () => {
  it('replaces typographic characters with ASCII', () => {
    expect(sanitiseText('“Hi” ‘there’ – ≥ 5…')).toBe('"Hi" \'there\' - >= 5...');
    expect(sanitiseText('café')).toBe('café');
    expect(sanitiseText('āb☃c')).toBe('ab?c');
    expect(sanitiseText('a b​c')).toBe('a bc');
  });
});

describe('pdf', () => {
  const tricky = session('pdf1', 'naming-practice', new Date(2026, 4, 5, 9, 5), [R, C, X, C, R, X, R, C], {
    note: 'Said “bread” after a first-sound cue – accuracy ≥ 60% … needs review.',
    recommendation: { level: 'up', text: 'Try the next step → more choices.' },
  });

  it('builds a session report as a PDF blob', async () => {
    const blob = buildSessionPdf(tricky, header);
    expect(blob.size).toBeGreaterThan(1000);
    const b = await bytes(blob);
    expect(ascii(b, 0, 5)).toBe('%PDF-');
    expect(ascii(b, b.length - 8, b.length)).toContain('%%EOF');
  });

  it('paginates a long session and still builds', async () => {
    const outcomes = Array.from({ length: 120 }, (_, i) => (i % 3 === 0 ? X : i % 3 === 1 ? C : R));
    const long = session('long', 'naming-practice', new Date(2026, 5, 1), outcomes, { note: 'Long note. '.repeat(200) });
    const blob = buildSessionPdf(long, { ...header, practitioner: EMPTY_PRACTITIONER });
    const text = (await bytes(blob)).reduce((s, c) => s + String.fromCharCode(c), '');
    const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(2);
    expect(text.startsWith('%PDF')).toBe(true);
  });

  it('builds a session report for every activity', async () => {
    const ids: ActivityId[] = ['comp-listen', 'naming-describe', 'naming-flashcards', 'naming-test', 'read-phrase-match', 'write-copy'];
    for (const id of ids) {
      const blob = buildSessionPdf(session(`a-${id}`, id, new Date(2026, 5, 1), [R, X, C]), header);
      expect(ascii(await bytes(blob), 0, 4)).toBe('%PDF');
    }
  });

  it('builds a progress report', async () => {
    const blob = buildProgressPdf({ sessions: ALL, from: null, to: null, activities: [] }, header);
    expect(blob.size).toBeGreaterThan(1000);
    expect(ascii(await bytes(blob), 0, 4)).toBe('%PDF');
  });

  it('builds a progress report for a filtered period and for no data', async () => {
    const some = buildProgressPdf({ sessions: ALL, from: '2026-01-01', to: '2026-02-28', activities: ['comp-listen', 'naming-test'] }, header);
    expect(ascii(await bytes(some), 0, 4)).toBe('%PDF');
    const none = buildProgressPdf({ sessions: ALL, from: '2030-01-01', to: null, activities: [] }, header);
    expect(none.size).toBeGreaterThan(500);
    expect(ascii(await bytes(none), 0, 4)).toBe('%PDF');
  });
});
