import { expect, type Page } from '@playwright/test';

export const ACTIVITIES = [
  ['comprehension', 'comp-listen'],
  ['comprehension', 'comp-read'],
  ['comprehension', 'comp-listen-read'],
  ['naming', 'naming-flashcards'],
  ['naming', 'naming-practice'],
  ['naming', 'naming-describe'],
  ['naming', 'naming-test'],
  ['reading', 'read-phrase-match'],
  ['reading', 'read-phrase-complete'],
  ['reading', 'read-sentence-match'],
  ['reading', 'read-sentence-complete'],
  ['writing', 'write-copy'],
  ['writing', 'write-fill'],
  ['writing', 'write-see'],
  ['writing', 'write-hear'],
] as const;

export type ActivityId = (typeof ACTIVITIES)[number][1];

/** Opens the app and gets through the first-run welcome without downloading pictures. */
export async function openApp(page: Page, opts: { download?: boolean } = {}) {
  await page.goto('./');
  const firstRun = page.getByTestId('first-run');
  const home = page.getByTestId('patient-bar');
  await expect(firstRun.or(home)).toBeVisible();
  if (await firstRun.isVisible()) {
    await page.getByTestId('first-run-next').click();
    await page.getByTestId('first-run-name').fill('Test Therapist');
    await page.getByTestId('first-run-next').click();
    if (opts.download) {
      await expect(page.getByTestId('offline-status')).toContainText(/Ready for offline use|No pictures/, { timeout: 180_000 });
      await page.getByTestId('first-run-finish').click();
    } else {
      await page.getByTestId('first-run-skip').click();
    }
  }
  await expect(home).toBeVisible();
}

/** Switches Auto-advance off so tests step with the Next button instead of waiting. */
export async function turnOffAutoAdvance(page: Page) {
  await page.getByTestId('nav-settings').click();
  const toggle = page.getByTestId('setting-auto-advance').getByRole('switch');
  if ((await toggle.getAttribute('aria-checked')) === 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('back').click();
  await expect(page.getByTestId('patient-bar')).toBeVisible();
}

export async function useGuest(page: Page) {
  await page.getByTestId('switch-patient').click();
  await page.getByTestId('pick-guest').click();
  await expect(page.getByTestId('current-patient')).toContainText('Guest');
}

export async function addPatient(page: Page, code: string) {
  await page.getByTestId('nav-patients').click();
  await page.getByTestId('add-patient').click();
  await page.getByTestId('patient-code-input').fill(code);
  await page.getByTestId('save-patient').click();
  await page.getByTestId(`select-${code}`).click();
  await expect(page.getByTestId('current-patient')).toContainText(code);
}

export async function startActivity(page: Page, module: string, activity: ActivityId) {
  await page.getByTestId(`module-${module}`).click();
  await page.getByTestId(`activity-${activity}`).click();
  const start = page.getByTestId('start-session');
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.getByTestId('session')).toBeVisible();
}

const results = (page: Page) => page.getByTestId('results');

async function next(page: Page) {
  const btn = page.getByTestId('next');
  await btn.click();
}

/** Plays one trial of the given activity to its end and moves on. */
async function playTrial(page: Page, activity: ActivityId, trial: number) {
  if (activity.startsWith('comp-') || activity.startsWith('read-')) {
    // Alternate between a clean answer and a wrong-then-right answer.
    if (trial % 3 === 1) {
      const foil = page.getByTestId('choice-foil').first();
      if (await foil.count()) await foil.click();
    }
    if (trial % 4 === 2) await page.getByTestId('hint').click();
    await page.getByTestId('choice-target').click();
    await expect(page.getByTestId('correct-tick')).toBeVisible();
    await next(page);
    return;
  }
  if (activity === 'naming-practice') {
    if (trial % 2 === 1) {
      await page.getByTestId('cue-definition').click();
      await page.getByTestId('cue-firstLetter').click();
      await expect(page.getByTestId('cue-panel')).not.toBeEmpty();
    }
    await page.getByTestId(trial % 3 === 2 ? 'score-cross' : 'score-tick').click();
    await expect(page.getByTestId('model-word')).toBeVisible();
    await next(page);
    return;
  }
  if (activity === 'naming-describe') {
    await page.getByTestId('card-category').locator('.head').click();
    await page.getByTestId('mark-category-afterReveal').click();
    await page.getByTestId('score-tick').click();
    await expect(page.getByTestId('model-word')).toBeVisible();
    await next(page);
    return;
  }
  if (activity === 'naming-test') {
    await page.getByTestId(trial % 5 === 4 ? 'score-skip' : trial % 3 === 2 ? 'score-cross' : 'score-tick').click();
    return;
  }
  if (activity === 'write-copy') {
    // Spell the model word properly: tap each letter in order, Check, then Submit.
    const word = (await page.getByTestId('model-word').innerText()).trim().toLowerCase();
    for (const letter of word) await page.getByTestId('tile-pool').getByTestId(`tile-${letter}`).first().click();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('review')).toBeVisible();
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('correct-tick')).toBeVisible();
    await next(page);
    return;
  }
  // Other writing activities: the hint places the letters one at a time until the word is complete.
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('correct-tick').isVisible()) break;
    const check = page.getByTestId('check');
    if (await check.isVisible()) {
      await check.click();
      await page.getByTestId('submit').click();
      continue;
    }
    await page.getByTestId('hint').click();
  }
  await expect(page.getByTestId('correct-tick')).toBeVisible();
  await next(page);
}

/** Plays a whole session (assumes Auto-advance is off) and waits for the results screen. */
export async function playSession(page: Page, activity: ActivityId) {
  if (activity === 'naming-flashcards') {
    for (let i = 0; i < 3; i++) await page.getByTestId('next').click();
    await page.getByTestId('flash-back').click();
    await page.getByTestId('flash-finish').click();
    await expect(results(page)).toBeVisible();
    return;
  }
  for (let trial = 0; trial < 40; trial++) {
    if (await results(page).isVisible()) break;
    await expect(page.getByTestId('session').or(results(page))).toBeVisible();
    if (await results(page).isVisible()) break;
    const count = page.getByTestId('trial-count');
    const before = await count.textContent();
    await playTrial(page, activity, trial);
    // Wait for the next trial (the counter changes) or, after the last one, the results screen.
    // A patient's session is saved before results appear, so the last trial can linger briefly.
    await expect(async () => {
      if (await results(page).isVisible()) return;
      expect(await count.textContent({ timeout: 1000 })).not.toBe(before);
    }).toPass({ timeout: 20_000 });
  }
  await expect(results(page)).toBeVisible();
}
