// Pure PDF builders (jsPDF, built-in Helvetica). No store, database or DOM access.
import { jsPDF } from 'jspdf';
import { __createTable, __drawTable, type CellInput, type UserOptions } from 'jspdf-autotable';
import type { Practitioner } from '../settings/model';
import {
  ACTIVITIES,
  CUE_LABELS,
  MODULES,
  activityDef,
  type ActivityId,
  type ModuleId,
  type SessionRecord,
} from '../session/types';
import {
  accuracySeries,
  activitySummary,
  cueEffectiveness,
  filterSessions,
  groupBreakdown,
  screenerSeries,
  weakerGroups,
} from './aggregate';
import {
  TRIAL_COLUMNS,
  activityTitle,
  describeSettings,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtSeconds,
  trialRows,
} from './describe';

export { describeSettings } from './describe';

export interface ReportHeader {
  practitioner: Practitioner;
  patientCode: string;
  generated: Date;
  groupLabel(id: string): string;
}

export interface ProgressInput {
  sessions: SessionRecord[];
  from: string | null;
  to: string | null;
  activities: ActivityId[];
}

export const DISCLAIMER = 'Informal therapy data. Not a standardised assessment.';

type RGB = [number, number, number];
const PRIMARY: RGB = [86, 59, 89]; // #563B59 plum (light-theme primary)
const ACCENT: RGB = [218, 156, 139]; // #DA9C8B coral
const INK: RGB = [50, 40, 60]; // #32283C ink
const MUTED: RGB = [96, 110, 112];
const RULE: RGB = [208, 218, 219];
const TINT: RGB = [240, 246, 246];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15;
const CW = PAGE_W - M * 2;
const TOP = 18; // top of content on continuation pages
const BOTTOM = PAGE_H - 24; // content must stay above the footer

// ---------------------------------------------------------------------------
// Text safety
// ---------------------------------------------------------------------------

const chars = (...codes: number[]) => codes.map((c) => String.fromCharCode(c)).join('');

const REPLACEMENTS: [RegExp, string][] = [
  [/[‘’‚‛′ʼ]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[‐‑‒–—―−]/g, '-'],
  [/…/g, '...'],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/≠/g, '!='],
  [/→/g, '->'],
  [/←/g, '<-'],
  [/[•●▪]/g, '*'],
  [/[✓✔]/g, 'yes'],
  [/[✗✘]/g, 'no'],
  [new RegExp('[' + chars(0xa0, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000, 9) + ']', 'g'), ' '],
  [new RegExp('[' + chars(0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad) + ']', 'g'), ''],
  [/\r\n?/g, '\n'],
];

/**
 * Reduces text to characters the built-in Helvetica (WinAnsi) can draw. Typographic characters
 * become plain ASCII equivalents; accents are kept where WinAnsi has them, otherwise stripped.
 */
export function sanitiseText(input: string): string {
  let s = input;
  for (const [re, to] of REPLACEMENTS) s = s.replace(re, to);
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (ch === '\n' || (c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff)) {
      out += ch;
      continue;
    }
    // Try to drop the accent from characters outside Latin-1 (for example a macron).
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base !== ch && /^[\x20-\x7e]+$/.test(base)) out += base;
    else if (c > 0xff) out += '?';
  }
  return out;
}

const S = sanitiseText;

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

interface Ctx {
  doc: jsPDF;
  y: number;
}

function newDoc(title: string): Ctx {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title: S(title), creator: 'SMRT Speech', subject: DISCLAIMER });
  doc.setFont('helvetica', 'normal');
  return { doc, y: 0 };
}

function ensure(ctx: Ctx, height: number) {
  if (ctx.y + height > BOTTOM) {
    ctx.doc.addPage();
    ctx.y = TOP;
  }
}

function drawHeader(ctx: Ctx, h: ReportHeader, kind: string) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...PRIMARY);
  doc.text('SMRT Speech', M, 20);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  doc.text(S(kind), M, 26);

  const lines: { text: string; bold: boolean }[] = [];
  const p = h.practitioner;
  if (p.name.trim()) lines.push({ text: p.name.trim(), bold: true });
  if (p.credentials.trim()) lines.push({ text: p.credentials.trim(), bold: false });
  if (p.practice.trim()) lines.push({ text: p.practice.trim(), bold: false });
  if (p.contact.trim()) lines.push({ text: p.contact.trim(), bold: false });
  let ly = 13;
  doc.setFontSize(9).setTextColor(...INK);
  for (const l of lines.slice(0, 5)) {
    doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
    const text = S(doc.splitTextToSize(S(l.text), 90)[0] ?? '');
    doc.text(text, PAGE_W - M, ly, { align: 'right' });
    ly += 4.5;
  }
  doc.setDrawColor(...ACCENT).setLineWidth(0.8);
  doc.line(M, 32, PAGE_W - M, 32);
  ctx.y = 39;
}

function heading(ctx: Ctx, text: string) {
  ensure(ctx, 16);
  ctx.y += 2;
  const { doc } = ctx;
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...PRIMARY);
  doc.text(S(text), M, ctx.y + 4);
  doc.setDrawColor(...RULE).setLineWidth(0.3);
  doc.line(M, ctx.y + 6.2, PAGE_W - M, ctx.y + 6.2);
  ctx.y += 10;
}

function paragraph(ctx: Ctx, text: string, size = 10) {
  const { doc } = ctx;
  doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...INK);
  const lines: string[] = doc.splitTextToSize(S(text), CW);
  const lh = size * 0.40;
  for (const line of lines) {
    ensure(ctx, lh + 1);
    doc.text(line, M, ctx.y + lh);
    ctx.y += lh + 0.9;
  }
  ctx.y += 2;
}

function runTable(ctx: Ctx, options: UserOptions): void {
  const table = __createTable(ctx.doc, {
    margin: { top: TOP, bottom: 24, left: M, right: M },
    ...options,
    startY: ctx.y,
  });
  __drawTable(ctx.doc, table);
  ctx.y = (table.finalY ?? ctx.y) + 5;
  ctx.doc.setTextColor(...INK);
}

function clean(rows: readonly (readonly CellInput[])[]): CellInput[][] {
  return rows.map((r) => r.map((c) => (typeof c === 'string' ? S(c) : c)));
}

const BASE_STYLES = { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: 1.8, overflow: 'linebreak' } as const;

function gridTable(
  ctx: Ctx,
  head: string[],
  body: readonly (readonly CellInput[])[],
  widths: number[],
  opts: { fontSize?: number; align?: ('left' | 'center' | 'right')[] } = {},
) {
  const columnStyles: NonNullable<UserOptions['columnStyles']> = {};
  widths.forEach((w, i) => {
    columnStyles[i] = { cellWidth: w, halign: opts.align?.[i] ?? 'left' };
  });
  runTable(ctx, {
    head: clean([head]),
    body: clean(body),
    theme: 'striped',
    styles: { ...BASE_STYLES, fontSize: opts.fontSize ?? 9 },
    headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: TINT },
    columnStyles,
    rowPageBreak: 'avoid',
  });
}

function keyValueTable(ctx: Ctx, rows: { label: string; value: string }[]) {
  if (rows.length === 0) return;
  runTable(ctx, {
    body: clean(rows.map((r) => [r.label, r.value])),
    theme: 'plain',
    styles: { ...BASE_STYLES },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', textColor: PRIMARY },
      1: { cellWidth: CW - 50 },
    },
    rowPageBreak: 'avoid',
  });
}

interface ChartPoint {
  startedAt: string;
  percent: number;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  return fmtDate(d).replace(/\d{4}$/, yy);
}

/** A small line chart in vector primitives: 0-100% axis, dated points. */
function lineChart(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, points: ChartPoint[]) {
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK);
  doc.text(S(title), x, y + 3);
  const px = x + 10;
  const py = y + 8;
  const pw = w - 12;
  const ph = h - 8 - 9;
  doc.setFont('helvetica', 'normal').setFontSize(6.5);
  for (const v of [0, 25, 50, 75, 100]) {
    const gy = py + ph - (v / 100) * ph;
    doc.setDrawColor(...RULE).setLineWidth(v === 0 ? 0.35 : 0.15);
    doc.line(px, gy, px + pw, gy);
    doc.setTextColor(...MUTED);
    doc.text(`${v}%`, px - 1.5, gy + 0.8, { align: 'right' });
  }
  doc.setDrawColor(...MUTED).setLineWidth(0.3);
  doc.line(px, py, px, py + ph);

  const n = points.length;
  const inset = 4;
  const xs = points.map((_, i) => (n === 1 ? px + pw / 2 : px + inset + ((pw - inset * 2) * i) / (n - 1)));
  const ys = points.map((p) => py + ph - (Math.max(0, Math.min(100, p.percent)) / 100) * ph);

  doc.setDrawColor(...PRIMARY).setLineWidth(0.5);
  for (let i = 1; i < n; i++) doc.line(xs[i - 1], ys[i - 1], xs[i], ys[i]);
  doc.setFillColor(...PRIMARY);
  doc.setFontSize(6.5).setTextColor(...INK);
  points.forEach((p, i) => {
    doc.circle(xs[i], ys[i], 0.9, 'F');
    if (n <= 10) {
      const above = p.percent < 85;
      doc.text(`${p.percent}`, xs[i], above ? ys[i] - 1.8 : ys[i] + 3.2, { align: 'center' });
    }
  });

  const labelCount = Math.min(n, 4);
  const shown = new Set<number>();
  for (let k = 0; k < labelCount; k++) shown.add(labelCount === 1 ? 0 : Math.round((k * (n - 1)) / (labelCount - 1)));
  doc.setTextColor(...MUTED);
  for (const i of shown) doc.text(shortDate(points[i].startedAt), xs[i], py + ph + 4, { align: 'center' });
  doc.setTextColor(...INK);
}

function groupBars(ctx: Ctx, rows: { label: string; percent: number; correct: number; total: number; lower: boolean }[]) {
  const { doc } = ctx;
  const rowH = 7;
  const barX = M + 62;
  const barW = 66;
  for (const r of rows) {
    ensure(ctx, rowH);
    const cy = ctx.y;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK);
    let label = S(r.label);
    while (label.length > 3 && doc.getTextWidth(label) > 58) label = label.slice(0, -2).trimEnd() + '...';
    doc.text(label, M, cy + 4.3);
    doc.setFillColor(...RULE);
    doc.rect(barX, cy + 1, barW, 4, 'F');
    doc.setFillColor(...(r.lower ? ACCENT : PRIMARY));
    if (r.percent > 0) doc.rect(barX, cy + 1, (barW * r.percent) / 100, 4, 'F');
    doc.setFont('helvetica', r.lower ? 'bold' : 'normal');
    doc.text(`${r.percent}% (${r.correct}/${r.total})${r.lower ? ' - lower' : ''}`, barX + barW + 3, cy + 4.3);
    ctx.y += rowH;
  }
  ctx.y += 2;
}

function addFooters(ctx: Ctx, h: ReportHeader, kind: string) {
  const { doc } = ctx;
  const total = doc.getNumberOfPages();
  const generated = `Generated ${fmtDate(h.generated)}`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
      doc.text(S(`SMRT Speech  |  ${kind}  |  Patient ${h.patientCode}`), M, 10);
      doc.setDrawColor(...RULE).setLineWidth(0.2);
      doc.line(M, 12, PAGE_W - M, 12);
    }
    doc.setDrawColor(...RULE).setLineWidth(0.3);
    doc.line(M, PAGE_H - 15, PAGE_W - M, PAGE_H - 15);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...INK);
    doc.text(DISCLAIMER, PAGE_W / 2, PAGE_H - 10.5, { align: 'center' });
    doc.setTextColor(...MUTED).setFontSize(7.5);
    doc.text(S(generated), M, PAGE_H - 6);
    doc.text(`Page ${i} of ${total}`, PAGE_W - M, PAGE_H - 6, { align: 'right' });
  }
}

function toBlob(doc: jsPDF): Blob {
  return doc.output('blob');
}

function moduleTitle(id: ModuleId): string {
  return MODULES.find((m) => m.id === id)?.title ?? id;
}

// ---------------------------------------------------------------------------
// Session report
// ---------------------------------------------------------------------------

const LEVEL_LABEL = { up: 'Suggestion: step up', down: 'Suggestion: step down', stay: 'Suggestion: stay at this level' } as const;

export function buildSessionPdf(session: SessionRecord, header: ReportHeader): Blob {
  const kind = 'Session report';
  const ctx = newDoc(`SMRT Speech session report - ${header.patientCode}`);
  const { doc } = ctx;
  const sum = session.summary;
  drawHeader(ctx, header, kind);

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...INK);
  doc.text(S(`${moduleTitle(session.module)}: ${activityTitle(session)}`), M, ctx.y + 2);
  ctx.y += 8;

  keyValueTable(ctx, [
    { label: 'Patient ID', value: header.patientCode },
    { label: 'Date and time', value: fmtDateTime(session.startedAt) },
    { label: 'Duration', value: fmtDuration(session.durationMs) },
    { label: 'Module', value: moduleTitle(session.module) },
    { label: 'Activity', value: activityTitle(session) },
  ]);

  heading(ctx, 'Settings used');
  keyValueTable(ctx, describeSettings(session, header.groupLabel));

  heading(ctx, 'Result');
  keyValueTable(ctx, [
    { label: 'Accuracy', value: `${sum.correct} of ${sum.total} correct (${sum.percent}%)` },
    { label: 'Correct with cues or hint', value: String(sum.cued) },
    { label: 'Incorrect', value: String(sum.incorrect) },
    { label: 'Hints used', value: String(sum.hints) },
    { label: 'Mean response time', value: `${fmtSeconds(sum.meanResponseMs)} s` },
  ]);
  paragraph(
    ctx,
    'A trial counts as correct only when the first response is right and no hint or cue is used. Patients carry on to the right answer, so every trial ends in success.',
    8.5,
  );

  const cues = cueEffectiveness([session]);
  if (cues.some((c) => c.used > 0)) {
    heading(ctx, 'Cues used');
    gridTable(
      ctx,
      ['Cue', 'Times used', 'Last cue before success'],
      cues.filter((c) => c.used > 0).map((c) => [CUE_LABELS[c.cue], String(c.used), String(c.beforeSuccess)]),
      [70, 40, 70],
      { align: ['left', 'center', 'center'] },
    );
  }

  const groupRows = groupBreakdown([session]);
  if (groupRows.length > 0) {
    heading(ctx, 'Breakdown by word group');
    const weak = new Set(weakerGroups(groupRows, sum.percent));
    gridTable(
      ctx,
      ['Word group', 'Correct', 'Items', 'Accuracy'],
      groupRows.map((g) => [header.groupLabel(g.group) + (weak.has(g.group) ? ' (lower)' : ''), String(g.correct), String(g.total), `${g.percent}%`]),
      [90, 30, 30, 30],
      { align: ['left', 'center', 'center', 'center'] },
    );
  }

  heading(ctx, 'Item by item');
  if (session.trials.length === 0) paragraph(ctx, 'No items were recorded.');
  else {
    gridTable(ctx, [...TRIAL_COLUMNS], trialRows(session, header.groupLabel), [10, 28, 26, 48, 26, 30, 12], {
      fontSize: 8,
      align: ['center', 'left', 'left', 'left', 'left', 'left', 'right'],
    });
  }

  heading(ctx, 'Recommendation');
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK);
  ensure(ctx, 8);
  doc.text(LEVEL_LABEL[session.recommendation.level] ?? 'Suggestion', M, ctx.y + 3.5);
  ctx.y += 6;
  paragraph(ctx, session.recommendation.text);

  heading(ctx, 'Session note');
  paragraph(ctx, session.note.trim() ? session.note : 'No note recorded.');

  addFooters(ctx, header, kind);
  return toBlob(doc);
}

// ---------------------------------------------------------------------------
// Progress report
// ---------------------------------------------------------------------------

function isoDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return fmtDate(new Date(y, (m || 1) - 1, d || 1));
}

function periodText(from: string | null, to: string | null): string {
  if (from && to) return `${isoDay(from)} to ${isoDay(to)}`;
  if (from) return `From ${isoDay(from)}`;
  if (to) return `Up to ${isoDay(to)}`;
  return 'All dates';
}

function change(from: number, to: number): string {
  const d = to - from;
  return d === 0 ? 'No change' : `${d > 0 ? '+' : ''}${d} points`;
}

export function buildProgressPdf(input: ProgressInput, header: ReportHeader): Blob {
  const kind = 'Progress report';
  const ctx = newDoc(`SMRT Speech progress report - ${header.patientCode}`);
  const { doc } = ctx;
  const sessions = filterSessions(input.sessions, { from: input.from, to: input.to, activities: input.activities });
  drawHeader(ctx, header, kind);

  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...INK);
  doc.text('Progress report', M, ctx.y + 2);
  ctx.y += 8;

  const items = sessions.reduce((n, s) => n + s.summary.total, 0);
  const correct = sessions.reduce((n, s) => n + s.summary.correct, 0);
  const overall = items === 0 ? 0 : Math.round((correct / items) * 100);
  const chosen = input.activities.length
    ? ACTIVITIES.filter((a) => input.activities.includes(a.id)).map((a) => a.title).join(', ')
    : 'All activities';
  keyValueTable(ctx, [
    { label: 'Patient ID', value: header.patientCode },
    { label: 'Period', value: periodText(input.from, input.to) },
    { label: 'Activities', value: chosen },
    { label: 'Sessions completed', value: String(sessions.length) },
    { label: 'Items attempted', value: String(items) },
    { label: 'Overall accuracy', value: items === 0 ? 'No data' : `${correct} of ${items} correct (${overall}%)` },
  ]);

  if (sessions.length === 0) {
    paragraph(ctx, 'No sessions were found for the chosen period and activities.');
    addFooters(ctx, header, kind);
    return toBlob(doc);
  }

  // Accuracy trend charts, two per row.
  heading(ctx, 'Accuracy over time');
  const series = accuracySeries(sessions);
  const charted = ACTIVITIES.filter((a) => series[a.id] && series[a.id]!.length > 0);
  const cw = (CW - 8) / 2;
  const chH = 54;
  for (let i = 0; i < charted.length; i += 2) {
    ensure(ctx, chH + 4);
    charted.slice(i, i + 2).forEach((a, k) => {
      lineChart(doc, M + k * (cw + 8), ctx.y, cw, chH, `${moduleTitle(a.module)}: ${a.title}`, series[a.id] ?? []);
    });
    ctx.y += chH + 4;
  }
  paragraph(ctx, 'Each point is one session. Figures show the percentage correct (first response right, no hints or cues).', 8.5);

  // Group breakdown.
  const groups = groupBreakdown(sessions);
  if (groups.length > 0) {
    heading(ctx, 'Breakdown by word group');
    const weak = new Set(weakerGroups(groups, overall));
    groupBars(
      ctx,
      groups.map((g) => ({
        label: header.groupLabel(g.group),
        percent: g.percent,
        correct: g.correct,
        total: g.total,
        lower: weak.has(g.group),
      })),
    );
    paragraph(ctx, 'Lower: under 60% correct, or 20 or more points below the overall figure.', 8.5);
  }

  // Naming Test comparison.
  const screens = screenerSeries(sessions);
  if (screens.length > 0) {
    heading(ctx, 'Naming Test (informal screen) over time');
    const groupIds = [...new Set(screens.flatMap((s) => Object.keys(s.byGroup)))];
    const fixed = [12, 20, 18, 24]; // version, score, accuracy, change
    const each = groupIds.length > 0 ? Math.floor((CW - 24 - 74) / groupIds.length) : 0;
    const widths = [0, ...fixed, ...groupIds.map(() => each)];
    widths[0] = CW - widths.slice(1).reduce((a, b) => a + b, 0);
    const body = screens.map((s, i) => {
      const pct = Math.round((s.correct / s.total) * 100);
      const prev = screens[i - 1];
      const prevPct = prev ? Math.round((prev.correct / prev.total) * 100) : null;
      return [
        fmtDate(s.startedAt),
        `v${s.version}`,
        `${s.correct} of ${s.total}`,
        `${pct}%`,
        prevPct === null ? 'First' : change(prevPct, pct),
        ...groupIds.map((g) => {
          const t = s.byGroup[g];
          return t && t.total > 0 ? `${Math.round((t.correct / t.total) * 100)}%` : '-';
        }),
      ];
    });
    gridTable(ctx, ['Date', 'Ver.', 'Score', 'Accuracy', 'Change', ...groupIds.map(header.groupLabel)], body, widths, {
      fontSize: groupIds.length > 4 ? 7 : 8,
      align: ['left', 'center', 'center', 'center', 'center', ...groupIds.map((): 'center' => 'center')],
    });
    paragraph(ctx, 'The Naming Test is an informal 30-picture screen with no cues. Compare only results from the same version.', 8.5);
  }

  // Summary table.
  heading(ctx, 'Summary by activity');
  const rows = activitySummary(sessions).sort(
    (a, b) => ACTIVITIES.findIndex((x) => x.id === a.activity) - ACTIVITIES.findIndex((x) => x.id === b.activity),
  );
  gridTable(
    ctx,
    ['Activity', 'Sessions', 'Items', 'Correct', 'Accuracy', 'First', 'Latest', 'Change', 'Hints'],
    rows.map((r) => [
      `${moduleTitle(activityDef(r.activity).module)}: ${activityDef(r.activity).title}`,
      String(r.sessions),
      String(r.items),
      String(r.correct),
      `${r.percent}%`,
      `${r.firstPercent}%`,
      `${r.lastPercent}%`,
      r.sessions > 1 ? change(r.firstPercent, r.lastPercent) : '-',
      String(r.hints),
    ]),
    [48, 18, 15, 17, 19, 14, 15, 22, 12],
    { fontSize: 8, align: ['left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center'] },
  );

  addFooters(ctx, header, kind);
  return toBlob(doc);
}
