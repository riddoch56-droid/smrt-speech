// Pure CSV builders. Excel-friendly: UTF-8 BOM, CRLF line endings, formula-injection guard.
import { MODULES, activityDef, type SessionRecord } from '../session/types';
import { sessionDate } from './aggregate';
import { TRIAL_COLUMNS, fmtSeconds, fmtTime, trialRows } from './describe';

export type CsvCell = string | number | null | undefined;

const BOM = '﻿';

/** Quotes one cell. Text starting with = + - @ (or a tab or CR) is prefixed with a single quote. */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRows(rows: readonly (readonly CsvCell[])[]): string {
  return BOM + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function moduleTitle(id: SessionRecord['module']): string {
  return MODULES.find((m) => m.id === id)?.title ?? id;
}

export function sessionCsv(session: SessionRecord, patientCode: string, groupLabel: (id: string) => string): string {
  const s = session.summary;
  const rows: CsvCell[][] = [
    ['Patient ID', patientCode],
    ['Date', sessionDate(session)],
    ['Start time', fmtTime(session.startedAt)],
    ['Module', moduleTitle(session.module)],
    ['Activity', activityDef(session.activity).title],
    ['Accuracy', `${s.correct}/${s.total} (${s.percent}%)`],
    ['Hints used', s.hints],
    [],
    [...TRIAL_COLUMNS],
    ...trialRows(session, groupLabel),
  ];
  return csvRows(rows);
}

export function progressCsv(sessions: SessionRecord[], patientCode: string): string {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const rows: CsvCell[][] = [
    [
      'Patient ID',
      'Date',
      'Start time',
      'Module',
      'Activity',
      'Duration (s)',
      'Trials',
      'Correct',
      'Accuracy (%)',
      'Correct with cues',
      'Incorrect',
      'Hints used',
      'Mean response time (s)',
      'Recommendation',
      'Note',
    ],
    ...sorted.map((s): CsvCell[] => [
      patientCode,
      sessionDate(s),
      fmtTime(s.startedAt),
      moduleTitle(s.module),
      activityDef(s.activity).title,
      Math.round(s.durationMs / 1000),
      s.summary.total,
      s.summary.correct,
      s.summary.percent,
      s.summary.cued,
      s.summary.incorrect,
      s.summary.hints,
      fmtSeconds(s.summary.meanResponseMs),
      s.recommendation.text,
      s.note,
    ]),
  ];
  return csvRows(rows);
}
