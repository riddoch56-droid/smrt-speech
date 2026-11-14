// The only reports file that touches the app store and the share sheet.
import { groupLabel } from '../app/content';
import { useApp } from '../app/store';
import { reportFileName, shareFile, type ShareOutcome } from '../platform/share';
import type { SessionRecord } from '../session/types';
import { sessionCsv, progressCsv } from './csv';
import { activityTitle } from './describe';
import { buildProgressPdf, buildSessionPdf, type ProgressInput, type ReportHeader } from './pdf';

function makeHeader(patientCode: string): ReportHeader {
  return {
    practitioner: useApp.getState().practitioner,
    patientCode,
    generated: new Date(),
    groupLabel: (id) => groupLabel(id),
  };
}

function csvBlob(text: string): Blob {
  return new Blob([text], { type: 'text/csv;charset=utf-8' });
}

export function exportSessionPdf(session: SessionRecord, patientCode: string): Promise<ShareOutcome> {
  const blob = buildSessionPdf(session, makeHeader(patientCode));
  const name = reportFileName(patientCode, activityTitle(session), new Date(session.startedAt), 'pdf');
  return shareFile(blob, name, 'SMRT Speech session report');
}

export function exportSessionCsv(session: SessionRecord, patientCode: string): Promise<ShareOutcome> {
  const blob = csvBlob(sessionCsv(session, patientCode, (id) => groupLabel(id)));
  const name = reportFileName(patientCode, activityTitle(session), new Date(session.startedAt), 'csv');
  return shareFile(blob, name, 'SMRT Speech session data');
}

export function exportProgressPdf(input: ProgressInput, patientCode: string): Promise<ShareOutcome> {
  const header = makeHeader(patientCode);
  const blob = buildProgressPdf(input, header);
  return shareFile(blob, reportFileName(patientCode, 'Progress', header.generated, 'pdf'), 'SMRT Speech progress report');
}

export function exportProgressCsv(sessions: SessionRecord[], patientCode: string): Promise<ShareOutcome> {
  const blob = csvBlob(progressCsv(sessions, patientCode));
  return shareFile(blob, reportFileName(patientCode, 'Progress', new Date(), 'csv'), 'SMRT Speech progress data');
}
