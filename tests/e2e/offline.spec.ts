import { expect, test } from '@playwright/test';
import { openApp, playSession, startActivity, turnOffAutoAdvance, useGuest } from './helpers';

test('after the first load, the app reloads and runs a session with the network disabled', async ({ page, context }) => {
  await openApp(page, { download: true });

  // Wait until the service worker controls the page and has finished precaching.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('patient-bar')).toBeVisible();

  await turnOffAutoAdvance(page);
  await useGuest(page);
  await startActivity(page, 'comprehension', 'comp-read');

  // Pictures must come from the offline cache.
  const picture = page.getByTestId('choice-target').locator('img');
  await expect(picture).toBeVisible();
  expect(await picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

  await playSession(page, 'comp-read');
  await expect(page.getByTestId('results-score')).toBeVisible();
  await context.setOffline(false);
});
