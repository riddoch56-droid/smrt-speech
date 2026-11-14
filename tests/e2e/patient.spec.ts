import { readFileSync, statSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { addPatient, openApp, playSession, startActivity, turnOffAutoAdvance } from './helpers';

async function savedSize(download: Download): Promise<{ size: number; head: string; name: string }> {
  const path = await download.path();
  return { size: statSync(path).size, head: readFileSync(path).subarray(0, 5).toString('latin1'), name: download.suggestedFilename() };
}

async function runSession(page: Page, module: string, activity: Parameters<typeof playSession>[1]) {
  await startActivity(page, module, activity);
  await playSession(page, activity);
  await expect(page.getByTestId('results-saved')).toContainText('Saved');
  await page.getByTestId('results-done').click();
}

test('a patient session is saved, appears in history, and exports as PDF and CSV', async ({ page }) => {
  await openApp(page);
  await turnOffAutoAdvance(page);
  await addPatient(page, 'SS-014');

  await runSession(page, 'comprehension', 'comp-read');
  await runSession(page, 'naming', 'naming-practice');

  // History shows both sessions.
  await page.getByTestId('nav-patients').click();
  await page.getByTestId('history-SS-014').click();
  await expect(page.getByTestId('history-screen')).toBeVisible();
  await expect(page.getByTestId('session-row-0')).toBeVisible();
  await expect(page.getByTestId('session-row-1')).toBeVisible();

  // Session detail: note, then PDF and CSV.
  await page.getByTestId('session-row-0').click();
  await expect(page.getByTestId('session-detail')).toBeVisible();
  await page.getByTestId('session-note').fill('Good effort today.');
  await page.getByTestId('save-note').click();

  const pdfPromise = page.waitForEvent('download');
  await page.getByTestId('export-pdf').click();
  const pdf = await savedSize(await pdfPromise);
  expect(pdf.name).toMatch(/^SMRTSpeech_SS-014_.+_\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(pdf.head).toBe('%PDF-');
  expect(pdf.size).toBeGreaterThan(3000);

  const csvPromise = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const csv = await savedSize(await csvPromise);
  expect(csv.name).toMatch(/\.csv$/);
  expect(csv.size).toBeGreaterThan(200);

  // Progress report.
  await page.getByTestId('back').click();
  await page.getByTestId('open-progress-report').click();
  await expect(page.getByTestId('progress-report')).toBeVisible();
  const progressPromise = page.waitForEvent('download');
  await page.getByTestId('progress-export-pdf').click();
  const progress = await savedSize(await progressPromise);
  expect(progress.name).toMatch(/^SMRTSpeech_SS-014_Progress_\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(progress.head).toBe('%PDF-');
  expect(progress.size).toBeGreaterThan(3000);
});

test('guest sessions are never stored', async ({ page }) => {
  await openApp(page);
  await turnOffAutoAdvance(page);
  await page.getByTestId('switch-patient').click();
  await page.getByTestId('pick-guest').click();
  await startActivity(page, 'comprehension', 'comp-read');
  await playSession(page, 'comp-read');
  await expect(page.getByTestId('results-saved')).toContainText('not saved');
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('smrt-speech');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction('sessions').objectStore('sessions').count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        };
      }),
  );
  expect(stored).toBe(0);
});

test('the privacy PIN protects patient records after a session starts', async ({ page }) => {
  await openApp(page);
  await turnOffAutoAdvance(page);
  await addPatient(page, 'SS-020');
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('pin-new-input').fill('2468');
  await page.getByTestId('pin-save').click();
  await page.getByTestId('back').click();

  await startActivity(page, 'comprehension', 'comp-read');
  await page.getByTestId('session-home').click();
  await page.getByTestId('exit-leave').click();

  await page.getByTestId('nav-patients').click();
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  for (const digit of '2468') await page.getByTestId(`pin-key-${digit}`).click();
  await expect(page.getByTestId('patient-row-SS-020')).toBeVisible();
});
