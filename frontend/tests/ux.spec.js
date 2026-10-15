import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const read = promisify(readFile);
const seed = JSON.parse(readFileSync(new URL('../../data/clinicalSeed.json', import.meta.url), 'utf8'));
const client = seed.clients[0];
const programs = seed.programs.filter(program => program.clientId === client.id);
const skillProgram = programs.find(program => program.category === 'SkillAcquisition');
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  }, { auto: true }]
});

async function open(page) {
  await page.goto('./');
  await expect(page.locator('#target-analysis')).toBeVisible();
  await expect(page.locator('#abc-observations')).toBeVisible();
}
async function accessible(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map(animation => animation.finished.catch(() => {})));
  });
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => ({
    target: node.target, summary: node.failureSummary, checks: node.any.map(check => check.data)
  })) }))).toEqual([]);
}
async function download(page, trigger, option) {
  await page.getByRole('button', { name: trigger, exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: option, exact: true }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  await expect(page.getByRole('button', { name: trigger, exact: true })).toBeFocused();
  return { name: file.suggestedFilename(), bytes: await read(await file.path()) };
}
async function record(page, target) {
  await page.getByRole('button', { name: 'Record observation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record observation', exact: true });
  await dialog.getByRole('button', { name: 'Single target', exact: true }).click();
  await dialog.getByLabel('Program & target').selectOption(target.id);
  return dialog;
}
function csv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  row.push(cell); rows.push(row);
  return rows;
}

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`layout stays within the ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await open(page);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test('default dashboard has accessible names, contrast and semantic sections', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Progress overview', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About skill mastery' })).toHaveAttribute('aria-expanded', 'false');
  await accessible(page);
});

test('client switching isolates records and retains valid program selections', async ({ page }) => {
  await open(page);
  for (const item of seed.clients) {
    await page.getByLabel('Current client').selectOption(item.id);
    await expect(page.locator('.client-identity').getByRole('heading', { name: item.name, exact: true })).toBeVisible();
    const first = seed.programs.find(program => program.clientId === item.id && program.category === 'SkillAcquisition');
    await expect(page.locator('#target-program')).toHaveValue(first.id);
    const count = seed.sessionData.filter(row => row.clientId === item.id).length;
    await expect(page.locator('.metric').filter({ hasText: 'Session observations' }).locator('.metric-number')).toHaveText(String(count));
  }
});

test('no-client state has real choices and inactive recording', async ({ page }) => {
  await open(page);
  await page.getByLabel('Current client').selectOption('');
  await expect(page.getByRole('heading', { name: 'Start with a client.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Record observation', exact: true })).toBeDisabled();
  await expect(page.locator('#target-analysis')).toHaveCount(0);
  await accessible(page);
  await page.getByRole('button', { name: new RegExp(seed.clients[1].name) }).click();
  await expect(page.locator('.client-identity')).toContainText(seed.clients[1].name);
  await expect(page.locator('#target-analysis')).toBeVisible();
});

test('desktop rail or mobile drawer stays named, focusable and reversible', async ({ page }, testInfo) => {
  await open(page);
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('button', { name: 'Open workspace navigation' })).toBeHidden();
    await page.getByRole('button', { name: 'Collapse navigation' }).click();
    const rail = page.locator('.sidebar--collapsed');
    await expect(rail).toBeVisible();
    const destination = rail.getByRole('link', { name: 'Target analysis', exact: true });
    await destination.focus();
    await expect(rail.locator('.nav-tooltip').filter({ hasText: 'Target analysis' })).toBeVisible();
    const box = await destination.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await destination.press('Enter');
    await expect(destination).toHaveAttribute('aria-current', 'location');
    await page.getByRole('button', { name: 'Expand navigation' }).click();
    await expect(page.locator('.sidebar--collapsed')).toHaveCount(0);
  } else {
    const trigger = page.getByRole('button', { name: 'Open workspace navigation' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Workspace', exact: true });
    await expect(dialog).toBeVisible();
    await accessible(page);
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('dialog').getByRole('link', { name: 'ABC observations', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#abc-observations')).toBeFocused();
  }
});

test('help works with keyboard and touch without leaving the viewport', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'About skill mastery' });
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const popup = page.getByRole('group', { name: 'About skill mastery' });
  await expect(popup).toContainText('maintenance');
  const box = await popup.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize()).width);
  await trigger.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await trigger.press('Tab');
  await expect(popup).toHaveCount(0);
});

test('behavior comparison opens on click, supports checkboxes and dismisses with Escape', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Behavior reduction/ }).click();
  const trigger = page.getByRole('button', { name: /Choose behaviors/ });
  await trigger.click();
  const popup = page.getByRole('group', { name: /Choose behaviors/ });
  const checkboxes = popup.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(programs.filter(program => program.category === 'BehaviorReduction').length);
  await checkboxes.nth(1).check();
  await expect(trigger).toContainText('(2)');
  await checkboxes.nth(1).press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel('Show missing dates')).toBeVisible();
  await accessible(page);
});

test('chart title updates persist after refresh and overlay controls are keyboard accessible', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Edit chart title:/ }).click();
  await page.getByLabel('Chart title', { exact: true }).fill('Labeling responses over time');
  await page.getByLabel('Chart title', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Edit chart title: Labeling responses over time' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh target analysis' }).click();
  await expect(page.getByRole('button', { name: 'Edit chart title: Labeling responses over time' })).toBeVisible();
  await page.getByLabel('Average', { exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#target-analysis svg.chart-svg')).toContainText('Avg:');
  await page.getByLabel('Trend', { exact: true }).check();
  await expect(page.getByLabel('Trend calculation')).toHaveValue('regression');
  await expect(page.locator('#target-analysis .chart-caption')).toContainText('Regression:');
  await page.getByLabel('Trend calculation').selectOption('directional');
  await expect(page.locator('#target-analysis .chart-caption')).not.toContainText('Regression:');
});

test('mastery and all-hidden target states explain a path forward', async ({ page }) => {
  await open(page);
  const pending = programs.find(program => program.category === 'SkillAcquisition' && program.targets.every(target => !['Maintenance', 'Generalization', 'Completed'].includes(target.phase)));
  await page.locator('#mastery-prog').selectOption(pending.id);
  await expect(page.getByRole('heading', { name: 'Mastery is still ahead.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export mastery', exact: true })).toBeDisabled();
  const legend = page.locator('#target-analysis .target-legend').first();
  for (const target of skillProgram.targets.filter(item => item.type === 'TrialByTrial')) await legend.getByRole('button', { name: target.name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No series are visible.' })).toBeVisible();
  await legend.getByRole('button', { name: skillProgram.targets[0].name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No series are visible.' })).toHaveCount(0);
});

test('recording validation stays inline and focuses the first invalid input', async ({ page }) => {
  await open(page);
  const target = programs.flatMap(program => program.targets).find(item => item.type === 'TrialByTrial');
  const dialog = await record(page, target);
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  await expect(dialog.getByText('Review the marked fields before saving.')).toBeVisible();
  await expect(dialog.getByLabel('Correct trials')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByLabel('Correct trials')).toBeFocused();
  await dialog.getByLabel('Correct trials').fill('12');
  await dialog.getByLabel('Total trials').fill('10');
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  await expect(dialog.getByText('Correct trials cannot exceed total trials.')).toBeVisible();
  await accessible(page);
  await dialog.getByLabel('Correct trials').fill('7');
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  await expect(dialog).toHaveCount(0);
  const row = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).at(-1));
  expect(row.value).toBe(70);
  expect(row.correctCount).toBe(7);
  expect(row.totalTrials).toBe(10);
  expect(row.clientId).toBe(client.id);
  await expect(page.getByRole('button', { name: 'Record observation', exact: true })).toBeFocused();
});

for (const type of ['Duration', 'Frequency', 'IntervalData', 'FluencyRate', 'Anecdotal']) {
  test(`records a valid ${type} observation without changing measurement semantics`, async ({ page }) => {
    await open(page);
    const target = programs.flatMap(program => program.targets).find(item => item.type === type);
    const dialog = await record(page, target);
    if (type === 'Duration') await dialog.getByLabel('Recorded duration (seconds)').fill('137');
    if (['Frequency', 'FluencyRate'].includes(type)) {
      await dialog.getByRole('spinbutton', { name: /^Occurrences/ }).fill('7');
      await dialog.getByLabel('Observation minutes').fill('8.5');
    }
    if (type === 'IntervalData') {
      await dialog.getByLabel('Intervals scored').fill('3');
      await dialog.getByLabel('Total intervals').fill(String(target.intervalSettings?.numberOfIntervals || 12));
    }
    if (type === 'Anecdotal') await dialog.getByRole('textbox', { name: /^Observation/ }).fill('Used a model prompt, then requested a break independently.');
    await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
    await expect(dialog).toHaveCount(0);
    const row = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).at(-1));
    expect(row.targetId).toBe(target.id);
    if (type === 'Duration') expect(row.value).toBe(137);
    if (['Frequency', 'FluencyRate'].includes(type)) { expect(row.occurrenceCount).toBe(7); expect(row.lessonDurationMinutes).toBe(8.5); }
    if (type === 'IntervalData') expect(row.value).toBe(Math.round(300 / row.totalIntervals));
    if (type === 'Anecdotal') expect(row.qualitativeEntry).toContain('requested a break');
  });
}

test('a whole program is recorded in one pass, with per-target phase changes', async ({ page }) => {
  await open(page);
  const program = programs.find(item => item.category === 'SkillAcquisition' && item.targets.filter(target => target.type === 'TrialByTrial').length >= 2);
  const trials = program.targets.filter(target => target.type === 'TrialByTrial');
  const skipped = program.targets.find(target => target.type !== 'TrialByTrial');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).length);
  await page.getByRole('button', { name: 'Record observation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record observation', exact: true });
  await dialog.getByLabel('Program', { exact: true }).selectOption(program.id);
  await expect(dialog.getByText(`${trials.length} of ${program.targets.length} targets selected`)).toBeVisible();
  // Untick a target that was not worked on: it must not be written.
  if (skipped) await dialog.locator('.record-target').filter({ hasText: skipped.name }).getByRole('checkbox').uncheck();
  for (const target of trials) {
    const row = dialog.locator('.record-target').filter({ hasText: target.name });
    await row.getByLabel('Correct trials').fill('8');
    await row.getByLabel('Total trials').fill('10');
    await expect(row).toContainText('80% accuracy');
  }
  await dialog.locator('.record-target').filter({ hasText: trials[0].name }).getByLabel('Phase change').selectOption('Maintenance');
  await dialog.getByLabel('Session date & time').fill('2026-10-13T09:30');
  await dialog.getByRole('button', { name: new RegExp(`^Save ${trials.length} observations$`) }).click();
  await expect(dialog).toHaveCount(0);
  const added = await page.evaluate(count => JSON.parse(localStorage.getItem('welina_sessions')).slice(count), before);
  expect(added).toHaveLength(trials.length);
  for (const target of trials) {
    const row = added.find(item => item.targetId === target.id);
    expect(row.value).toBe(80);
    expect(row.timestamp).toBe('2026-10-13T09:30:00');
    expect(row.therapistName).toBeTruthy();
  }
  expect(added.some(row => skipped && row.targetId === skipped.id)).toBe(false);
  // Session numbers advance per target, and the phase change wrote its own line.
  const line = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_phase_lines')).at(-1));
  expect(line.targetId).toBe(trials[0].id);
  expect(line.date).toBe('2026-10-13');
  expect(line.label).toBe('Maintenance starts');
});

test('save and next session keeps the sheet open for the following appointment', async ({ page }) => {
  await open(page);
  const target = programs.flatMap(program => program.targets).find(item => item.type === 'TrialByTrial');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).length);
  const dialog = await record(page, target);
  await dialog.getByLabel('Correct trials').fill('9');
  await dialog.getByLabel('Total trials').fill('10');
  await dialog.getByRole('button', { name: 'Save & next session' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Saved 1 observation/)).toBeVisible();
  await expect(dialog.getByLabel('Session date & time')).toHaveValue('2026-10-15T10:00');
  await expect(dialog.getByLabel('Total trials')).toHaveValue('10');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).length)).toBe(before + 1);
  await accessible(page);
  await page.keyboard.press('Escape');
});

test('copy last session and shared minutes fill a whole program in two clicks', async ({ page }) => {
  await open(page);
  const program = programs.find(item => item.targets.some(target => ['Frequency', 'FluencyRate'].includes(target.type)));
  await page.getByRole('button', { name: 'Record observation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record observation', exact: true });
  await dialog.getByLabel('Program', { exact: true }).selectOption(program.id);
  await dialog.getByLabel('Session length (minutes)').fill('12');
  await dialog.getByRole('button', { name: 'Apply minutes to all rows' }).click();
  for (const row of await dialog.locator('.record-target').all()) {
    const minutes = row.getByLabel('Observation minutes');
    if (await minutes.count()) await expect(minutes).toHaveValue('12');
  }
  await dialog.getByRole('button', { name: 'Copy last session' }).click();
  const first = dialog.locator('.record-target').filter({ hasText: program.targets[0].name });
  await expect(first.locator('input[type="number"]').first()).not.toHaveValue('');
  await accessible(page);
  await page.keyboard.press('Escape');
});

test('the vertical axis can be fixed by the clinician and recovers from a bad range', async ({ page }) => {
  await open(page);
  const chart = page.locator('#target-analysis svg.chart-svg');
  await expect(chart).toContainText('100');
  await page.getByRole('button', { name: /^Y axis/ }).click();
  const popup = page.getByRole('group', { name: /^Y axis/ });
  await popup.getByLabel('Minimum').fill('40');
  await popup.getByLabel('Maximum').fill('120');
  await expect(chart).toContainText('120');
  await expect(page.getByRole('button', { name: /^Y axis/ })).toContainText('40–120');
  // A reversed range is reported instead of silently rescaling the chart.
  await popup.getByLabel('Maximum').fill('20');
  await expect(popup.getByText(/greater than/)).toBeVisible();
  await expect(chart).toContainText('120');
  await popup.getByRole('button', { name: 'Use automatic scale' }).click();
  await expect(page.getByRole('button', { name: /^Y axis/ })).toContainText('automatic');
  await expect(chart).toContainText('100');
  await accessible(page);
});

test('every measurement type can be drawn as bars, points or a cumulative record', async ({ page }) => {
  await open(page);
  const chart = page.locator('#target-analysis svg.chart-svg');
  await expect(chart.locator('path[stroke-width="2.2"]').first()).toBeVisible();
  await page.getByLabel('Plot', { exact: true }).selectOption('bars');
  await expect(chart.locator('rect[rx="2"]').first()).toBeVisible();
  await page.getByLabel('Plot', { exact: true }).selectOption('points');
  await expect(chart.locator('circle[r="4.6"]').first()).toBeVisible();
  // Percentages have no meaningful cumulative record, so that option stays unavailable.
  await expect(page.getByLabel('Plot', { exact: true }).locator('option[value="cumulative"]')).toBeDisabled();
  const program = programs.find(item => item.targets.some(target => target.type === 'Frequency'));
  await page.locator('#target-program').selectOption(program.id);
  await page.getByRole('button', { name: 'Frequency', exact: true }).click();
  await page.getByLabel('Plot', { exact: true }).selectOption('cumulative');
  await expect(chart).toContainText('Cumulative Occurrence count');
  await accessible(page);
});

test('phase labels sit in their own strip, clear of every plotted point', async ({ page }) => {
  await open(page);
  const chart = page.locator('#target-analysis svg.chart-svg');
  const strip = chart.locator('.condition-bar');
  await expect(strip).toBeVisible();
  const labels = await strip.locator('text').allTextContents();
  expect(labels.join(' ')).toMatch(/Baseline|Acquisition|Maintenance/);
  const stripBox = await strip.boundingBox();
  const pointBox = await chart.locator('rect[width="9"]').first().boundingBox();
  expect(stripBox.y + stripBox.height).toBeLessThan(pointBox.y);
  await page.getByRole('button', { name: 'Phase labels', exact: true }).click();
  await expect(strip).toHaveCount(0);
  expect(await chart.locator('line[stroke-opacity="0.4"]').count()).toBeGreaterThan(0);
  await accessible(page);
});

test('value labels print each plotted measurement when the timeline is short', async ({ page }) => {
  await open(page);
  await page.getByLabel('Group by').selectOption('Weekly');
  const chart = page.locator('#target-analysis svg.chart-svg');
  await page.getByRole('button', { name: 'Values', exact: true }).click();
  const label = chart.locator('text[font-size="10"][paint-order="stroke"]').first();
  await expect(label).toBeVisible();
  expect(await label.textContent()).toMatch(/\d/);
  await page.getByRole('button', { name: 'Values', exact: true }).click();
  await expect(chart.locator('text[font-size="10"][paint-order="stroke"]')).toHaveCount(0);
});

test('behavior zero and untracked records stay distinct in local data and CSV', async ({ page }) => {
  await open(page);
  const target = programs.find(program => program.category === 'BehaviorReduction' && program.targets[0].type === 'Frequency').targets[0];
  let dialog = await record(page, target);
  await dialog.getByRole('spinbutton', { name: /^Occurrences/ }).fill('0');
  await dialog.getByLabel('Observation minutes').fill('11.5');
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  await expect(dialog).toHaveCount(0);
  dialog = await record(page, target);
  await dialog.getByRole('radio', { name: /Not tracked/ }).check();
  await expect(dialog.getByRole('spinbutton', { name: /^Occurrences/ })).toBeDisabled();
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).slice(-2));
  expect(rows[0].value).toBe(0); expect(rows[0].missingDataMode).toBe('ZeroOut');
  expect(rows[1].value).toBeNull(); expect(rows[1].missingDataMode).toBe('DataNotTracked');
  expect(rows[1]).not.toHaveProperty('occurrenceCount');
  await page.getByRole('button', { name: /Behavior reduction/ }).click();
  const output = await download(page, 'Export targets', 'Raw observations · CSV');
  const parsed = csv(output.bytes.toString());
  const mode = parsed[0].indexOf('Missing Data Mode'), value = parsed[0].indexOf('Value');
  expect(parsed.some(row => row[mode] === 'ZeroOut' && row[value] === '0')).toBe(true);
  expect(parsed.some(row => row[mode] === 'DataNotTracked' && row[value] === '')).toBe(true);
});

test('phase-change recording creates the line on the chosen target and date', async ({ page }) => {
  await open(page);
  const target = programs.flatMap(program => program.targets).find(item => item.type === 'Duration');
  const dialog = await record(page, target);
  await dialog.getByLabel('Recorded duration (seconds)').fill('133');
  await dialog.getByLabel('Session date & time').fill('2026-10-12T09:43');
  await dialog.getByLabel('Phase change').selectOption('Generalization');
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  const data = await page.evaluate(() => ({ programs: JSON.parse(localStorage.getItem('welina_programs')), line: JSON.parse(localStorage.getItem('welina_phase_lines')).at(-1) }));
  const updated = data.programs.flatMap(program => program.targets).find(item => item.id === target.id);
  expect(updated.phase).toBe('Generalization'); expect(updated.phaseEnteredDate).toBe('2026-10-12');
  expect(data.line.targetId).toBe(target.id); expect(data.line.date).toBe('2026-10-12');
  expect(data.line.label).toBe('Generalization starts');
});

test('annotation add/edit uses the plotted target, validates ranges, and keeps mastery selection', async ({ page }) => {
  await open(page);
  const chosen = programs.find(program => program.category === 'SkillAcquisition' && program.id !== skillProgram.id && seed.sessionData.some(row => program.targets.some(target => target.id === row.targetId)));
  await page.locator('#target-program').selectOption(chosen.id);
  const type = await page.locator('.measurement-tabs button[aria-pressed="true"]').innerText();
  const target = chosen.targets.find(item => item.type === Object.entries({ TrialByTrial: 'Trial by trial', Duration: 'Duration', Frequency: 'Frequency', IntervalData: 'Interval data', Anecdotal: 'Anecdotal', FluencyRate: 'Fluency / rate' }).find(([, label]) => label === type)[0]);
  await page.locator('#mastery-prog').selectOption(chosen.id);
  await page.getByRole('button', { name: 'Phase line', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Add phase line' });
  await expect(dialog).toContainText(target.name);
  await dialog.getByLabel('Phase label').fill('Context check');
  await dialog.getByRole('button', { name: 'Save phase line' }).click();
  await expect(dialog).toHaveCount(0);
  const line = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_phase_lines')).at(-1));
  expect(line.targetId).toBe(target.id);
  await expect(page.locator('#mastery-prog')).toHaveValue(chosen.id);
  await page.getByRole('button', { name: 'Edit Context check' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit phase line' });
  await dialog.getByLabel('Phase label').fill('Revised context');
  await dialog.getByRole('button', { name: 'Save phase line' }).click();
  const after = await page.evaluate(id => JSON.parse(localStorage.getItem('welina_phase_lines')).filter(item => item.id === id), line.id);
  expect(after).toHaveLength(1); expect(after[0].label).toBe('Revised context');
  await page.getByRole('button', { name: 'Phase range', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Add phase range' });
  await dialog.getByLabel('Start date').fill('2026-10-14');
  await dialog.getByLabel('End date').fill('2026-10-01');
  await dialog.getByLabel('Range label').fill('Prompt fading');
  await dialog.getByRole('button', { name: 'Save phase range' }).click();
  await expect(dialog.getByText('The end date must be on or after the start date.')).toBeVisible();
  await expect(dialog.getByLabel('End date')).toBeFocused();
  await accessible(page);
  await dialog.getByLabel('End date').fill('2026-10-14');
  await dialog.getByRole('button', { name: 'Save phase range' }).click();
  await expect(dialog).toHaveCount(0);
});

test('graph notes validate, save and edit; native dialogs contain focus and honor Escape', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Note', exact: true });
  await trigger.click();
  let dialog = page.getByRole('dialog', { name: 'Add graph note' });
  for (let index = 0; index < 12; index++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => Boolean(document.activeElement.closest('dialog')))).toBe(true); }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click();
  dialog = page.getByRole('dialog', { name: 'Add graph note' });
  await dialog.getByRole('button', { name: 'Save graph note' }).click();
  await expect(dialog.getByLabel('Author')).toBeFocused();
  await accessible(page);
  await dialog.getByLabel('Author').fill('Maya Patel, RBT');
  await dialog.getByRole('textbox', { name: 'Note', exact: true }).fill('A quieter room supported this fictional observation.');
  await dialog.getByRole('button', { name: 'Save graph note' }).click();
  await expect(dialog).toHaveCount(0);
  const note = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_graph_notes')).at(-1));
  await page.locator('.annotation-item').filter({ hasText: note.noteText }).getByRole('button', { name: 'Edit graph note' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit graph note' });
  await dialog.getByRole('textbox', { name: 'Note', exact: true }).fill('Revised fictional observation context.');
  await dialog.getByRole('button', { name: 'Save graph note' }).click();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('welina_graph_notes')).find(item => item.id === id).noteText, note.id)).toBe('Revised fictional observation context.');
});

test('frequency views, narrative notes, data tables and log pagination remain functional', async ({ page }) => {
  await open(page);
  const frequencyProgram = programs.find(program => program.category === 'SkillAcquisition' && program.targets.some(target => target.type === 'Frequency'));
  await page.locator('#target-program').selectOption(frequencyProgram.id);
  await page.getByRole('button', { name: 'Frequency', exact: true }).click();
  await page.getByLabel('Frequency measure').selectOption('Rate per Minute');
  await page.locator('#target-analysis summary').filter({ hasText: 'View plotted data table' }).click();
  await expect(page.locator('#target-analysis .data-table')).toContainText('per minute');
  await page.locator('#target-program').selectOption(skillProgram.id);
  await page.getByRole('button', { name: 'Anecdotal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Observation notes', exact: true })).toBeVisible();
  await page.locator('#abc-observations').getByRole('button', { name: 'Log', exact: true }).click();
  const table = page.locator('.abc-table');
  const initial = await table.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: 'Next ABC records' }).click();
  expect(await table.locator('tbody tr').first().innerText()).not.toBe(initial);
  await page.getByRole('button', { name: 'Export ABC', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vector chart · SVG', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
});

test('CSV, SVG, PNG and ZIP exports produce actual files without changing target names', async ({ page }) => {
  await open(page);
  const output = await download(page, 'Export mastery', 'Mastery data · CSV');
  expect(output.name).toMatch(/\.csv$/); expect(output.bytes.toString()).toContain('Cumulative Mastered Targets');
  const svg = await download(page, 'Export mastery', 'Vector chart · SVG');
  expect(svg.name).toMatch(/\.svg$/); expect(svg.bytes.toString()).toContain('<svg');
  const png = await download(page, 'Export mastery', 'Chart image · PNG');
  expect([...png.bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const raw = await download(page, 'Export targets', 'Raw observations · CSV');
  const parsed = csv(raw.bytes.toString());
  expect(parsed[1][parsed[0].indexOf('Target Name')]).toBe(skillProgram.targets[0].name);
  const zip = await download(page, 'Export targets', 'All client targets · ZIP');
  expect(zip.name).toMatch(/\.zip$/); expect(zip.bytes.subarray(0, 2).toString()).toBe('PK');
  const abc = await download(page, 'Export ABC', 'Observation log · CSV');
  expect(abc.bytes.toString()).toContain('Antecedents');
});

test('export failures explain the error rather than silently doing nothing', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.getByRole('button', { name: 'Export mastery', exact: true }).click();
  await page.getByRole('button', { name: 'Chart image · PNG', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('We couldn’t prepare this export.');
});

test('blocked storage stays usable and warns that records will not persist', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage is full', 'QuotaExceededError'); }; });
  await open(page);
  await expect(page.getByRole('alert')).toContainText('Changes aren’t being saved.');
  const target = programs.flatMap(program => program.targets).find(item => item.type === 'Duration');
  const dialog = await record(page, target);
  await dialog.getByLabel('Recorded duration (seconds)').fill('119');
  await dialog.getByRole('button', { name: /^Save 1 observation$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.metric').filter({ hasText: 'Session observations' }).locator('.metric-number')).toHaveText(String(seed.sessionData.filter(row => row.clientId === client.id).length + 1));
  await expect(page.locator('.notification-region')).toContainText('for this session only');
});

test('reset uses a safe confirmation with working cancel and restore paths', async ({ page }, testInfo) => {
  await open(page);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
  } else await page.getByRole('button', { name: 'Reset demo data', exact: true }).first().click();
  let dialog = page.getByRole('dialog', { name: 'Restore demo data?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep my changes' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep my changes' }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Record observation', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reset demo data' }).click();
  } else await page.getByRole('button', { name: 'Reset demo data', exact: true }).first().click();
  dialog = page.getByRole('dialog', { name: 'Restore demo data?' });
  await dialog.getByRole('button', { name: 'Restore demo data', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('welina_sessions')).length)).toBe(seed.sessionData.length);
});

test('slow code loading gets a layout skeleton and respects reduced motion', async ({ page, context }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await context.route('**/assets/ClientSpecificSection*.js', async route => { await gate; await route.continue(); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main .analytics-skeleton').first()).toBeVisible();
  release();
  await expect(page.locator('#target-analysis')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
});

test('privacy, terms and a true nested-path 404 have accessible return paths', async ({ page }) => {
  await open(page);
  for (const link of ['Privacy', 'Terms of use']) {
    await page.locator('.workspace-footer').getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await accessible(page);
    await page.getByRole('link', { name: 'Back to analytics', exact: true }).click();
    await expect(page.locator('#target-analysis')).toBeVisible();
  }
  const response = await page.goto('missing/deep-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Let’s get you back to the workspace.' })).toBeVisible();
  await accessible(page);
  await page.getByRole('link', { name: 'Back to analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress overview' })).toBeVisible();
});

test('the skip link bypasses workspace navigation with a visible focus target', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to analytics', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await skip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('session pagination and weekly/monthly labels follow the actual grouped data', async ({ page }) => {
  await open(page);
  await page.getByLabel('Group by').selectOption({ label: 'Session' });
  await page.locator('#target-analysis summary').filter({ hasText: 'View plotted data table' }).click();
  const firstCell = page.locator('#target-analysis .data-table tbody tr').first().locator('td').first();
  const first = await firstCell.innerText();
  await page.getByRole('button', { name: 'Next session page' }).click();
  expect(await firstCell.innerText()).not.toBe(first);
  await page.getByRole('button', { name: 'Previous session page' }).click();
  await expect(firstCell).toHaveText(first);
  await page.getByLabel('Group by').selectOption('Weekly');
  await expect(page.locator('#target-analysis .data-table')).toContainText('Sep 28–Oct 4');
  await page.getByLabel('Group by').selectOption('Monthly');
  await expect(page.locator('#target-analysis .data-table')).toContainText('Oct 2026');
});

test('clinician splitting and all-hidden clinician recovery only use the active target', async ({ page }) => {
  await open(page);
  const targets = skillProgram.targets.filter(target => target.type === 'TrialByTrial');
  for (const target of targets.slice(1)) await page.locator('#target-analysis .target-legend').first().getByRole('button', { name: target.name, exact: true }).click();
  await page.getByLabel('Split by clinician').check();
  const legend = page.locator('#target-analysis .target-legend').nth(1);
  const since = new Date(`${seed.asOfDate}T23:59:59`);
  since.setMonth(since.getMonth() - 1);
  const names = [...new Set(seed.sessionData.filter(row => row.targetId === targets[0].id && new Date(row.timestamp) >= since).map(row => row.therapistName))];
  await expect(legend.getByRole('button')).toHaveCount(names.length);
  for (const name of names) await legend.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No series are visible.' })).toBeVisible();
  await legend.getByRole('button', { name: names[0], exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No series are visible.' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Monochrome', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Monochrome', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const grid = page.locator('#target-analysis svg.chart-svg line[stroke-dasharray="3 3"]');
  expect(await grid.count()).toBeGreaterThan(0);
  await page.locator('#target-analysis').getByRole('button', { name: 'Gridlines', exact: true }).click();
  await expect(grid).toHaveCount(0);
  await accessible(page);
});

test('range and note editing/deletion do not duplicate or lose unrelated annotations', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Phase range', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Add phase range' });
  await dialog.getByLabel('Start date').fill('2026-10-05');
  await dialog.getByLabel('End date').fill('2026-10-12');
  await dialog.getByLabel('Range label').fill('Supported practice');
  await dialog.getByRole('button', { name: 'Save phase range' }).click();
  const range = await page.evaluate(() => JSON.parse(localStorage.getItem('welina_phase_ranges')).at(-1));
  await page.getByRole('button', { name: 'Edit Supported practice' }).click();
  dialog = page.getByRole('dialog', { name: 'Edit phase range' });
  await dialog.getByLabel('Range label').fill('Revised practice');
  await dialog.getByLabel('End date').fill('2026-10-14');
  await dialog.getByRole('button', { name: 'Save phase range' }).click();
  const ranges = await page.evaluate(id => JSON.parse(localStorage.getItem('welina_phase_ranges')).filter(row => row.id === id), range.id);
  expect(ranges).toHaveLength(1); expect(ranges[0].color).toMatch(/33$/);
  await page.getByRole('button', { name: 'Delete Revised practice' }).click();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('welina_phase_ranges')).some(row => row.id === id), range.id)).toBe(false);
  const phase = seed.phaseLines.find(line => line.targetId === skillProgram.targets[0].id);
  await page.getByRole('button', { name: `Delete ${phase.label}` }).click();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('welina_phase_lines')).some(row => row.id === id), phase.id)).toBe(false);
  const original = seed.graphNotes.find(note => note.targetId === skillProgram.targets[0].id);
  await page.locator('.annotation-item').filter({ hasText: original.noteText }).getByRole('button', { name: 'Delete graph note' }).click();
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('welina_graph_notes')).some(row => row.id === id), original.id)).toBe(false);
});

test('program setup remains inspectable and demo learning materials actually download', async ({ page }) => {
  await open(page);
  await page.locator('#target-analysis summary').filter({ hasText: 'Program setup' }).click();
  const definition = page.getByRole('article', { name: `${skillProgram.name} definition` });
  await expect(definition).toContainText(skillProgram.programObjective);
  await expect(definition).toContainText('Prompt hierarchy:');
  const material = skillProgram.learningMaterials[0];
  const pending = page.waitForEvent('download');
  await definition.getByRole('link', { name: new RegExp(material.fileName.replace(/\./g, '\\.')) }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  expect(file.suggestedFilename()).toBe(material.fileName);
  expect((await read(await file.path())).toString()).toContain('DEMO LEARNING MATERIAL');
});

test('recording sheet also fits a 320px screen without clipping', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await open(page);
  const target = programs.flatMap(program => program.targets).find(item => item.type === 'Frequency');
  const dialog = await record(page, target);
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await accessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('empty program recording starts with that program’s target, not the first program', async ({ page }) => {
  await open(page);
  const chosen = programs.filter(program => program.category === 'SkillAcquisition')[1];
  await page.evaluate(ids => {
    const rows = JSON.parse(localStorage.getItem('welina_sessions'));
    localStorage.setItem('welina_sessions', JSON.stringify(rows.filter(row => !ids.includes(row.targetId))));
  }, chosen.targets.map(target => target.id));
  await page.reload();
  await page.locator('#target-program').selectOption(chosen.id);
  await expect(page.getByRole('heading', { name: 'No observations for this program yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Record an observation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record observation', exact: true });
  await expect(dialog.getByLabel('Program & target')).toHaveValue(chosen.targets[0].id);
  await expect(dialog.getByLabel('Recorded duration (seconds)')).toBeVisible();
});

test('out-of-range data is not mislabeled as hidden series and has a recovery action', async ({ page }) => {
  await open(page);
  await page.evaluate(ids => {
    const rows = JSON.parse(localStorage.getItem('welina_sessions'));
    localStorage.setItem('welina_sessions', JSON.stringify(rows.map(row => ids.includes(row.targetId) ? { ...row, timestamp: '2026-01-14T10:00:00' } : row)));
  }, skillProgram.targets.map(target => target.id));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'No measured observations in this range.' })).toBeVisible();
  await page.getByRole('button', { name: 'Change date range', exact: true }).click();
  await expect(page.locator('#target-date-range')).toBeFocused();
  await page.locator('#target-date-range').selectOption('1 year');
  await expect(page.locator('#target-analysis svg.chart-svg')).toBeVisible();
});

test('metadata, social artwork, local fonts and project-prefixed assets all exist', async ({ page, request }) => {
  const failures = [];
  page.on('response', response => { if (response.status() >= 400 && /\/(assets|fonts)\//.test(response.url())) failures.push(response.url()); });
  await open(page);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://pkiran-aloha.github.io/ADC/social-preview.png');
  for (const asset of ['social-preview.png', 'favicon.svg', 'fonts/geist-latin-wght-normal.woff2', 'fonts/outfit-latin-wght-normal.woff2']) {
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  expect(failures).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('16px Geist'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px Outfit'))).toBe(true);
});

test('navigation and manual scrolling agree about the active section without double header offsets', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const destinations = [['abc-observations', 'ABC observations'], ['target-analysis', 'Target analysis'], ['overview', 'Progress overview']];
  for (const [id, name] of destinations) {
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Open workspace navigation' }).click();
      await page.getByRole('dialog').getByRole('link', { name, exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } else await page.getByRole('navigation', { name: 'Analytics navigation', exact: true }).getByRole('link', { name, exact: true }).click();
    const offset = await page.evaluate(sectionId => ({
      panel: document.getElementById(sectionId).getBoundingClientRect().top,
      header: document.querySelector('.app-header').getBoundingClientRect().height
    }), id);
    expect(offset.panel).toBeGreaterThanOrEqual(offset.header);
    expect(offset.panel).toBeLessThanOrEqual(offset.header + 40);
    await expect(page.locator(`.shell-layout > .sidebar a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location');
  }
  await page.evaluate(() => { const section = document.getElementById('abc-observations'); window.scrollTo({ top: scrollY + section.getBoundingClientRect().top - 110, behavior: 'instant' }); });
  await expect(page.locator('.shell-layout > .sidebar a[href="#abc-observations"]')).toHaveAttribute('aria-current', 'location');
});

test('default controls provide 44px pointer targets or full-sized associated labels', async ({ page }) => {
  await open(page);
  const small = await page.evaluate(() => [...document.querySelectorAll('button,a,select,summary,input,textarea')]
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
    .map(element => {
      const rect = element.getBoundingClientRect();
      const label = element.labels?.[0]?.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') || element.id || element.textContent.trim().slice(0, 40),
        width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, label };
    })
    .filter(element => element.bottom > 0 && (element.width < 43.9 || element.height < 43.9) && !(element.label?.width >= 43.9 && element.label?.height >= 43.9))
    .map(({ name, width, height }) => ({ name, width, height })));
  expect(small).toEqual([]);
});

test('404 return button retains contrast at rest, hover and keyboard focus', async ({ page }) => {
  const response = await page.goto('missing/deep-page');
  expect(response.status()).toBe(404);
  const button = page.getByRole('link', { name: 'Back to analytics', exact: true });
  await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(button).toHaveCSS('background-color', 'rgb(52, 99, 76)');
  // Foreground/background must change together, not interpolate through a low-contrast frame.
  await expect(button).toHaveCSS('transition-property', 'transform');
  await accessible(page);
  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(41, 79, 61)');
  await accessible(page);
  await page.mouse.move(0, 0);
  for (let index = 0; index < 4; index++) await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await accessible(page);
});

// ---------------------------------------------------------------------------
// Analytical charting: drill-down, functions, visual analysis, ABC patterns and forecasts
// ---------------------------------------------------------------------------
const behaviorTargets = programs.filter(program => program.category === 'BehaviorReduction').map(program => program.targets[0]);

test('chart points drill down by pointer and keyboard to sessions and trial-by-trial prompts', async ({ page }) => {
  await open(page);
  const region = page.locator('#target-analysis .chart-scroll').first();
  await region.focus();
  await page.keyboard.press('End');
  await expect(region.locator('[aria-live="polite"]')).not.toHaveText('');
  await page.keyboard.press('Enter');
  const inspector = page.locator('#target-analysis .inspector');
  await expect(inspector.getByRole('heading', { name: 'Observation details' })).toBeVisible();
  const items = inspector.locator('.inspector-item');
  if (await items.count()) await items.first().click();
  await expect(inspector.locator('.inspector-detail')).toBeVisible();
  await expect(inspector.getByRole('list', { name: /^Trial sequence:/ })).toBeVisible();
  await expect(inspector).toContainText('Recorded by');
  await accessible(page);
  await page.getByRole('button', { name: 'Previous observation group' }).click();
  await expect(inspector.getByRole('heading', { name: 'Observation details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close observation details' }).click();
  await expect(inspector).toHaveCount(0);
  // Tap inside the visible part of the (horizontally scrollable) chart.
  await page.locator('#target-analysis svg.chart-svg').scrollIntoViewIfNeeded();
  const box = await page.locator('#target-analysis svg.chart-svg').boundingBox();
  const viewport = page.viewportSize();
  await page.mouse.click(box.x + Math.min(box.width * 0.5, (viewport.width - box.x) * 0.6), box.y + box.height * 0.5);
  await expect(page.getByRole('heading', { name: 'Observation details' })).toBeVisible();
});

test('chart functions add median, criterion, projection, envelope and split-middle overlays', async ({ page }) => {
  await open(page);
  await page.locator('#target-date-range').selectOption('6 months');
  const helpers = skillProgram.targets.find(target => target.phase === 'Acquisition' && target.type === 'TrialByTrial');
  await page.getByLabel('Analyze target').selectOption(helpers.id);
  await page.getByRole('button', { name: /^Chart functions/ }).click();
  const menu = page.getByRole('group', { name: /^Chart functions/ });
  for (const name of ['Median line', 'Mastery criterion line', 'Projection (80% band)', 'Stability envelope', 'Condition means', 'IOA markers']) {
    await menu.getByRole('checkbox', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).check();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Chart functions (6)' })).toBeFocused();
  const svg = page.locator('#target-analysis svg.chart-svg');
  await expect(svg).toContainText('Median:');
  await expect(svg).toContainText('Criterion ≥ 80');
  await expect(svg).toContainText('Projection · 80% band');
  await page.getByLabel('Trend', { exact: true }).check();
  await page.getByLabel('Trend calculation').selectOption('split-middle');
  await expect(page.locator('#target-analysis .chart-caption')).toContainText('Split-middle line of progress');
  await accessible(page);
});

test('visual analysis compares conditions with effect sizes and the dual-criterion lines', async ({ page }) => {
  await open(page);
  await page.locator('#target-date-range').selectOption('6 months');
  const panel = page.locator('.analysis-panel');
  await expect(panel.getByRole('heading', { name: 'Visual analysis' })).toBeVisible();
  await expect(panel.locator('#analysis-comparison')).toContainText('Baseline → Acquisition');
  await expect(panel).toContainText('NAP');
  await expect(panel).toContainText('Conservative dual-criterion');
  await panel.getByLabel('Show criterion lines').check();
  await expect(page.locator('#target-analysis svg.chart-svg')).toContainText('CDC criterion lines');
  for (const tab of ['Progress & decisions', 'Data quality', 'Context']) {
    await panel.getByRole('button', { name: tab, exact: true }).click();
    await expect(panel.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(panel.getByRole('group', { name: 'Break down by' })).toBeVisible();
  await panel.locator('.context-bar').first().click();
  await expect(panel.locator('.context-bar').first()).toHaveAttribute('aria-pressed', 'true');
  await accessible(page);
  await panel.getByRole('button', { name: 'Data quality', exact: true }).click();
  await expect(panel).toContainText('IOA coverage');
});

test('prompt levels and celeration views show the data behind accuracy and fluency', async ({ page }) => {
  await open(page);
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Prompt levels', exact: true }).click();
  await expect(page.locator('#target-analysis svg.chart-svg title').first()).toHaveText('Prompt levels');
  const fluency = programs.find(program => program.targets.some(target => target.type === 'FluencyRate'));
  await page.locator('#target-program').selectOption(fluency.id);
  await page.locator('#target-date-range').selectOption('3 months');
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Celeration', exact: true }).click();
  await expect(page.locator('#target-analysis svg.chart-svg')).toContainText('/wk');
  await accessible(page);
});

test('ABC patterns drill into the log and the forecast reports its own accuracy', async ({ page }) => {
  await open(page);
  const abc = page.locator('#abc-observations');
  await abc.getByRole('button', { name: 'Patterns', exact: true }).click();
  await page.locator('#abc-date-range').selectOption('Past 6 Months');
  await expect(abc.getByRole('heading', { name: 'Antecedents before each behavior' })).toBeVisible();
  await expect(abc.getByRole('heading', { name: 'Descriptive function profile' })).toBeVisible();
  await expect(abc).toContainText(`FBA hypothesis: ${behaviorTargets[0].functionHypothesis}`);
  await accessible(page);
  await abc.locator('button.heat-cell').first().click();
  await expect(abc.getByRole('button', { name: 'Log', exact: true })).toBeVisible();
  await expect(abc.locator('.filter-chips')).toContainText('Antecedent:');
  const rows = abc.locator('.abc-table tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
  await abc.getByRole('button', { name: 'Clear filters' }).click();
  await expect(abc.locator('.filter-chips')).toHaveCount(0);
  await abc.getByRole('button', { name: 'Forecast', exact: true }).click();
  await expect(abc.getByRole('heading', { name: 'Next-session outlook' })).toBeVisible();
  await expect(abc.locator('.model-card')).toContainText('later sessions');
  const result = abc.locator('.forecast-result strong');
  const before = await result.innerText();
  await abc.getByRole('checkbox', { name: /Poor sleep reported/ }).check();
  await expect(abc.locator('.forecast-delta')).toBeVisible();
  expect(Number(await result.innerText())).toBeGreaterThan(Number(before));
  await expect(abc.locator('.likely-list li')).toHaveCount(behaviorTargets.length);
  await accessible(page);
});

test('the weekly progress map opens a target and week in the target analysis', async ({ page }) => {
  await open(page);
  const map = page.locator('.progress-heatmap');
  await expect(map.getByRole('heading', { name: 'Weekly progress map' })).toBeVisible();
  const cell = map.locator('button.heat-cell').first();
  const label = await cell.getAttribute('aria-label');
  await cell.click();
  await expect(page.locator('#target-analysis')).toBeFocused();
  await expect(page.locator('#target-grouping')).toHaveValue('Weekly');
  await expect(page.getByRole('heading', { name: 'Observation details' })).toBeVisible();
  expect(label).toContain(skillProgram.targets[0].name);
  await map.getByRole('button', { name: 'Behaviors', exact: true }).click();
  await expect(map.locator('tbody tr')).toHaveCount(behaviorTargets.length);
});

test('service and data quality summarize dosage, IOA, fidelity and supervision', async ({ page }) => {
  await open(page);
  const section = page.locator('#service-quality');
  await expect(section.getByRole('heading', { name: 'Service & data quality' })).toBeVisible();
  await expect(section).toContainText(`${client.authorizedHoursPerWeek} authorized`);
  await expect(section.getByRole('table', { name: /Supervision of RBT hours/ })).toBeVisible();
  await expect(section).toContainText('IOA coverage');
  await accessible(page);
});

async function visibleTrigger(page, name) {
  return page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();
}

test('reports build a print-ready multi-graph document and a target list by status', async ({ page }) => {
  await open(page);
  const reports = page.locator('#reports');
  await expect(reports.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
  await expect(reports.getByLabel('Template')).toHaveValue('clinical-review');
  await reports.getByLabel('Template').selectOption('reassessment');
  await expect(reports.getByLabel('Date range')).toHaveValue('3 months');
  const roster = reports.locator('table.data-table');
  expect(await roster.locator('tbody tr').count()).toBeGreaterThan(0);
  // The roster carries introduction and mastery dates for acquisition-rate reporting.
  await expect(roster.locator('thead')).toContainText('Introduced');
  await expect(roster.locator('thead')).toContainText('Mastered');
  const report = page.waitForEvent('download');
  await reports.getByRole('button', { name: 'Download report', exact: true }).click();
  const html = await report;
  expect(html.suggestedFilename()).toMatch(/\.html$/);
  expect((await read(await html.path())).toString()).toContain('<svg');
  const csv = page.waitForEvent('download');
  await reports.getByRole('button', { name: 'Export CSV', exact: true }).click();
  expect((await csv).suggestedFilename()).toMatch(/^Target_roster_.*\.csv$/);
  await accessible(page);
});

test('view-only analytics access keeps reading and exporting but blocks every change', async ({ page }, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem('welina_access_level', 'view'));
  await open(page);
  await expect(page.locator('.view-only-notice').first()).toContainText('View-only analytics access');
  await expect(page.getByRole('button', { name: 'Record observation', exact: true })).toBeDisabled();
  await expect(page.locator('#target-analysis .annotation-actions button').first()).toBeDisabled();
  // Phones keep the data-entry actions in the drawer, so open it before checking them.
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await expect((await visibleTrigger(page, 'Add data'))).toBeDisabled();
  await expect((await visibleTrigger(page, 'Import'))).toBeDisabled();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Close Workspace', exact: true }).click();
  // Reading, analysis and exports stay available.
  await expect(page.getByRole('heading', { name: 'Visual analysis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export targets', exact: true })).toBeEnabled();
  await accessible(page);
  if (testInfo.project.name === 'desktop') {
    // Switching back to full access takes effect without a reload.
    await page.getByLabel('Access', { exact: true }).selectOption('full');
    await expect(page.locator('.view-only-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Record observation', exact: true })).toBeEnabled();
  }
});

test('the live session activity panel reports today without opening a session note', async ({ page }) => {
  await open(page);
  const activity = page.locator('.live-activity');
  await expect(activity.getByRole('heading', { name: /Session activity/ })).toBeVisible();
  await expect(activity).toContainText('Appointments today');
  await expect(activity).toContainText('Documentation');
  await expect(activity.getByRole('table', { name: /Appointments on/ })).toBeVisible();
  await expect(activity.locator('.week-strip > div')).toHaveCount(7);
  await accessible(page);
});

test('event timestamps read as a time-of-day scatterplot in the ABC patterns', async ({ page }) => {
  await open(page);
  const abc = page.locator('#abc-observations');
  await abc.getByRole('button', { name: 'Patterns', exact: true }).click();
  await expect(abc.getByRole('heading', { name: 'Time of day' })).toBeVisible();
  await expect(page.getByRole('region', { name: /Scatterplot of event timestamps/ })).toBeVisible();
  await accessible(page);
});

test('manual entry and spreadsheet import record where the data came from', async ({ page }, testInfo) => {
  await open(page);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Open workspace navigation' }).click();
  await (await visibleTrigger(page, 'Add data')).click();
  const dialog = page.getByRole('dialog', { name: 'Add or import data' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Where the data came from')).toBeVisible();
  await dialog.getByRole('button', { name: 'Import spreadsheet', exact: true }).click();
  await expect(dialog.getByLabel('Or paste rows from the spreadsheet')).toBeVisible();
  await dialog.getByLabel('Or paste rows from the spreadsheet').fill(`Date,Target,Correct,Total\n2026-10-01,${skillProgram.targets[0].name},8,10`);
  await expect(dialog.getByRole('region', { name: 'Import preview rows' })).toContainText('Ready');
  await dialog.getByRole('button', { name: /^Import 1 row$/ }).click();
  // The rows land on the graph without a lesson note; the dialog reports what it added.
  await expect(dialog.getByText(/Imported 1 observation/)).toBeVisible();
});
