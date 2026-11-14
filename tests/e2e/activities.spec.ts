import { expect, test } from '@playwright/test';
import { ACTIVITIES, openApp, playSession, startActivity, turnOffAutoAdvance, useGuest } from './helpers';

// A short session in each of the 15 activities, in guest mode.
for (const [module, activity] of ACTIVITIES) {
  test(`completes a session: ${activity}`, async ({ page }) => {
    const thirdParty: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['data:', 'blob:', 'about:'].includes(url.protocol)) {
        thirdParty.push(req.url());
      }
    });

    await openApp(page);
    await turnOffAutoAdvance(page);
    await useGuest(page);
    await startActivity(page, module, activity);
    await playSession(page, activity);

    if (activity === 'naming-flashcards') {
      await expect(page.getByTestId('results-unscored')).toBeVisible();
    } else {
      await expect(page.getByTestId('results-score')).toBeVisible();
      await expect(page.getByTestId('recommendation')).toBeVisible();
      await expect(page.getByTestId('results-saved')).toContainText('not saved');
    }
    await page.getByTestId('results-done').click();
    await expect(page.getByTestId('patient-bar')).toBeVisible();
    expect(thirdParty, 'the app must make no third-party requests').toEqual([]);
  });
}
