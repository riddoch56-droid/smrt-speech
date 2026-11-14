import { expect, test } from '@playwright/test';
import { addPatient, openApp, playSession, startActivity, turnOffAutoAdvance } from './helpers';

test('a backup can be exported and restored on a clean device', async ({ page, browser }) => {
  await openApp(page);
  await turnOffAutoAdvance(page);
  await addPatient(page, 'SS-031');
  await startActivity(page, 'comprehension', 'comp-read');
  await playSession(page, 'comp-read');
  await page.getByTestId('results-done').click();

  await page.getByTestId('nav-settings').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-now').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^SMRTSpeech_backup_\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();

  // A second, empty "device".
  const context = await browser.newContext();
  const other = await context.newPage();
  await openApp(other);
  await other.getByTestId('nav-patients').click();
  await expect(other.getByTestId('patient-row-SS-031')).toHaveCount(0);
  await other.getByTestId('back').click();

  await other.getByTestId('nav-settings').click();
  await other.getByTestId('restore-file-input').setInputFiles(file);
  await other.getByTestId('restore-merge').click();
  await other.getByTestId('restore-confirm').click();
  await expect(other.getByTestId('restore-status')).toBeVisible();

  await other.goto('./#/patients');
  await expect(other.getByTestId('patient-row-SS-031')).toBeVisible();
  await other.getByTestId('history-SS-031').click();
  await expect(other.getByTestId('session-row-0')).toBeVisible();
  await context.close();
});
