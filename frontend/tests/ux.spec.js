import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import buildTargetHealth from '../src/utils/targetHealth.js';
import { buildInterventionTimeline } from '../src/utils/interventionTimeline.js';
import { durationFilterForDate, weekCountFor } from '../src/utils/analyticsScope.js';
import { ALL_PROGRAMS_ID, cumulativeMasterySeries } from '../src/utils/targetAnalytics.js';
import { buildExplorerCatalog } from '../src/utils/trendExplorer.js';
import { measurementFamilyFor } from '../src/utils/measurementFamilies.js';

const read = promisify(readFile);
const seed = JSON.parse(readFileSync(new URL('../../data/clinicalSeed.json', import.meta.url), 'utf8'));
const client = seed.clients[0];
const programs = seed.programs.filter(program => program.clientId === client.id);
const skillProgram = programs.find(program => program.category === 'SkillAcquisition');
const clientSessions = seed.sessionData.filter(row => row.clientId === client.id);
const behaviorPrograms = programs.filter(program => program.category === 'BehaviorReduction');
const skillPrograms = programs.filter(program => program.category === 'SkillAcquisition');
const test = base.extend({
  runtimeErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  }, { auto: true }]
});

async function open(page, tab = 'Progress overview') {
  await page.goto('./');
  await activate(page, tab);
}
// Most interaction tests need an analyzed chart; do that through the same explicit
// selection journey the practitioner uses rather than relying on a preselected graph.
async function activate(page, tab, { prepareAnalysis = true } = {}) {
  const button = page.getByRole('tab', { name: tab, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: tab, exact: true })).toBeVisible();
  if (tab === 'Target analysis' && prepareAnalysis) await ensureTargetAnalysisReady(page);
}
async function openTargetSelection(page) {
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  const change = nav.getByRole('button', { name: 'Change selection', exact: true });
  if (await change.count()) await change.click();
  await expect(nav.getByRole('group', { name: 'Analysis category', exact: true })).toBeVisible();
}
async function finishSelection(page, preferredMeasurement = '') {
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  const families = nav.locator('.explorer-family__chip');
  if (await families.count()) {
    let family = preferredMeasurement
      ? families.filter({ hasText: new RegExp(preferredMeasurement, 'i') }).first()
      : families.filter({ hasText: /Trial by trial/i }).first();
    if (!await family.count()) family = families.filter({ hasNotText: /Anecdotal/i }).first();
    if (!await family.count()) family = families.first();
    if (await family.count() && await family.getAttribute('aria-pressed') !== 'true') await family.click();
  }
  const selectAll = nav.getByRole('button', { name: 'Select all compatible targets', exact: true });
  if (await selectAll.count() && await selectAll.isEnabled()) await selectAll.click();
  const analyze = nav.getByRole('button', { name: 'View analysis', exact: true });
  if (await analyze.count()) await analyze.click();
}
async function ensureTargetAnalysisReady(page) {
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (!await nav.count()) return;
  if (await page.locator('#target-analysis .chart-control-strip').count()) return;
  await openTargetSelection(page);
  const categories = nav.getByRole('group', { name: 'Analysis category', exact: true });
  const programsChoice = categories.getByRole('button', { name: /Programs/ });
  if (await programsChoice.getAttribute('aria-pressed') !== 'true') await programsChoice.click();
  const picker = page.locator('#target-program');
  if (await picker.count() && !await picker.inputValue()) {
    const clientId = await page.getByLabel('Current client').inputValue();
    const initialProgram = seed.programs.find(program => program.clientId === clientId && program.category === 'SkillAcquisition')?.id || '';
    if (initialProgram) await picker.selectOption(initialProgram);
  }
  await finishSelection(page);
}
async function selectProgram(page, programId, preferredMeasurement = '') {
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  const categories = nav.getByRole('group', { name: 'Analysis category', exact: true });
  const programsChoice = categories.getByRole('button', { name: /Programs/ });
  if (await programsChoice.getAttribute('aria-pressed') !== 'true') await programsChoice.click();
  await page.locator('#target-program').selectOption(programId);
  await finishSelection(page, preferredMeasurement);
}
async function changeMeasurement(page, label) {
  await openTargetSelection(page);
  await finishSelection(page, label);
}
async function selectBehaviorAnalysis(page, measurement = 'Frequency') {
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.getByRole('group', { name: 'Analysis category', exact: true }).getByRole('button', { name: /Behaviors/ }).click();
  await finishSelection(page, measurement);
}
async function accessible(page) {
  await page.evaluate(async () => {
    // Scans run after fonts and finite transitions settle. Both waits are bounded: an
    // interrupted CSS transition can leave its `finished` promise pending forever, and a
    // single stuck animation must fail the scan's assertions rather than hang the worker.
    const settle = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 5000))]);
    await settle(document.fonts.ready);
    const finite = document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity);
    await settle(Promise.all(finite.map(animation => animation.finished.catch(() => {}))));
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
async function openContext(page) {
  // Clinical context, annotations and target details share the always-visible right rail.
  await expect(page.getByRole('complementary', { name: 'Clinical context', exact: true })).toBeVisible();
}
async function expectChartOptionsVisible(page) {
  await expect(page.locator('#target-analysis .chart-options')).toBeVisible();
}
async function openAnnotations(page) {
  await openContext(page);
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
    for (const tab of ['Progress overview', 'Target analysis', 'ABC observations', 'Service & data quality', 'Reports']) {
      await activate(page, tab);
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
      expect(dimensions.width, `overflow in “${tab}”`).toBeLessThanOrEqual(dimensions.viewport);
    }
  });
}

test('default dashboard has accessible names, contrast and semantic sections', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('heading', { name: 'Progress overview', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'About skill mastery' })).toHaveAttribute('aria-expanded', 'false');
  const sectionNavigation = page.getByRole('navigation', { name: 'Progress overview sections' });
  // Portfolio status, mastery, the progress map, the target health matrix and the timeline.
  await expect(sectionNavigation.getByRole('link')).toHaveCount(5);
  await expect(sectionNavigation.getByRole('link').nth(3)).toHaveText('Target health matrix');
  await expect(sectionNavigation.getByRole('link').nth(4)).toHaveText('Intervention timeline');
  const timelineLink = sectionNavigation.getByRole('link', { name: 'Intervention timeline' });
  await timelineLink.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#overview-timeline')).toBeFocused();
  await expect(page).toHaveURL(/#overview$/);
  await accessible(page);
});

test('client switching isolates records and retains valid program selections', async ({ page }) => {
  await open(page, 'Target analysis');
  for (const item of seed.clients) {
    await page.getByLabel('Current client').selectOption(item.id);
    await activate(page, 'Progress overview');
    await expect(page.locator('.client-identity').getByRole('heading', { name: item.name, exact: true })).toBeVisible();
    const count = seed.sessionData.filter(row => row.clientId === item.id).length;
    await expect(page.locator('.metric').filter({ hasText: 'Session observations' }).locator('.metric-number')).toHaveText(String(count));
    await activate(page, 'Target analysis');
    const first = seed.programs.find(program => program.clientId === item.id && program.category === 'SkillAcquisition');
    await openTargetSelection(page);
    await expect(page.locator('#target-program')).toHaveValue(first.id);
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
  await activate(page, 'Target analysis');
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

test('behavior comparison is a category-first multi-select that never mixes measurement types', async ({ page }) => {
  await open(page, 'Target analysis');
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.getByRole('group', { name: 'Analysis category', exact: true }).getByRole('button', { name: /Behaviors/ }).click();
  await nav.locator('.explorer-family__chip').filter({ hasText: 'Frequency' }).click();

  // Every behavior-reduction target is listed, while only the selected family can be plotted.
  const behaviors = programs.filter(program => program.category === 'BehaviorReduction').flatMap(program => program.targets);
  await expect(nav.locator('.explorer-target')).toHaveCount(behaviors.length);
  const compatible = behaviors.filter(target => target.type === 'Frequency');
  await expect(nav.locator('.explorer-target__check').first()).not.toBeChecked();

  // Behavior shortcuts are secondary and scoped to the selected measurement family.
  await nav.locator('.explorer-presets-details summary').click();
  const presets = nav.getByRole('group', { name: 'Behavior quick picks' });
  await expect(presets.getByRole('button').first()).toBeVisible();
  await presets.getByRole('button').first().click();
  if (compatible.length < behaviors.length) {
    await expect(nav.locator('.explorer-notice')).toContainText(/use a different measurement type/);
    await nav.getByRole('button', { name: 'Dismiss selection note' }).click();
  }

  const incompatible = nav.locator('.explorer-target--incompatible input[type="checkbox"]');
  expect(await incompatible.count()).toBe(behaviors.length - compatible.length);
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
  await page.locator('.chart-display-menu summary').click();
  await expect(page.getByLabel('Show missing dates')).toBeVisible();
  await expect(page.getByLabel('Show missing dates')).toBeEnabled();
  await accessible(page);
});

test('chart title updates persist after refresh and overlay controls are keyboard accessible', async ({ page }) => {
  await open(page, 'Target analysis');
  await page.getByRole('button', { name: /^Edit chart title:/ }).click();
  await page.getByLabel('Chart title', { exact: true }).fill('Labeling responses over time');
  await page.getByLabel('Chart title', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Edit chart title: Labeling responses over time' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh target analysis', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit chart title: Labeling responses over time' })).toBeVisible();
  await expectChartOptionsVisible(page);
  await page.getByLabel('Average', { exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#target-analysis svg.chart-svg')).toContainText('Avg:');
  await page.getByLabel('Trend', { exact: true }).check();
  await expect(page.getByLabel('Trend calculation')).toHaveValue('regression');
  await expect(page.locator('#target-analysis .chart-caption')).toContainText('Regression:');
  await page.getByLabel('Trend calculation').selectOption('directional');
  await expect(page.locator('#target-analysis .chart-caption')).not.toContainText('Regression:');
});

test('mastery and cleared target selections explain a path forward', async ({ page }) => {
  await open(page);
  const pending = programs.find(program => program.category === 'SkillAcquisition' && program.targets.every(target => !['Maintenance', 'Generalization', 'Completed'].includes(target.phase)));
  await page.locator('#mastery-prog').selectOption(pending.id);
  await expect(page.getByRole('heading', { name: 'Mastery is still ahead.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export mastery', exact: true })).toBeDisabled();
  await activate(page, 'Target analysis');
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.getByRole('button', { name: 'Clear target selection', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'View analysis', exact: true })).toHaveCount(0);
  await expect(page.locator('.analysis-guidance')).toContainText('Select targets to analyze');
  const firstCompatible = nav.locator('.explorer-target__check:not(:disabled)').first();
  await firstCompatible.check();
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
  await expect(page.locator('#target-analysis .chart-control-strip')).toBeVisible();
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
  await open(page, 'Target analysis');
  const chart = page.locator('#target-analysis svg.chart-svg');
  await expect(chart).toContainText('100');
  const display = page.locator('#target-analysis .chart-display-menu');
  await display.locator('summary').click();
  const popup = display.locator('.chart-menu__panel');
  await popup.getByLabel('Minimum').fill('40');
  await popup.getByLabel('Maximum').fill('120');
  await expect(chart).toContainText('120');
  await expect(popup).toContainText('Y-axis range · 40–120');
  // A reversed range is reported instead of silently rescaling the chart.
  await popup.getByLabel('Maximum').fill('20');
  await expect(popup.getByText(/greater than/)).toBeVisible();
  await expect(chart).toContainText('120');
  await popup.getByRole('button', { name: 'Use automatic scale' }).click();
  await expect(popup).toContainText('Y-axis range · automatic');
  await expect(chart).toContainText('100');
  await accessible(page);
});

test('every measurement type can be drawn as bars, points or a cumulative record', async ({ page }) => {
  await open(page, 'Target analysis');
  const chart = page.locator('#target-analysis svg.chart-svg');
  await expect(chart.locator('path[stroke-width="2.2"]').first()).toBeVisible();
  await expectChartOptionsVisible(page);
  await page.getByLabel('Plot', { exact: true }).selectOption('bars');
  await expect(chart.locator('rect[rx="2"]').first()).toBeVisible();
  await page.getByLabel('Plot', { exact: true }).selectOption('points');
  await expect(chart.locator('circle[r="4.6"]').first()).toBeVisible();
  // Percentages have no meaningful cumulative record, so that option stays unavailable.
  await expect(page.getByLabel('Plot', { exact: true }).locator('option[value="cumulative"]')).toBeDisabled();
  const program = programs.find(item => item.targets.some(target => target.type === 'Frequency'));
  await selectProgram(page, program.id, 'Frequency');
  await page.getByLabel('Plot', { exact: true }).selectOption('cumulative');
  await expect(chart).toContainText('Cumulative Occurrence count');
  await accessible(page);
});

test('phase labels sit in their own strip, clear of every plotted point', async ({ page }) => {
  await open(page, 'Target analysis');
  const chart = page.locator('#target-analysis svg.chart-svg');
  const strip = chart.locator('.condition-bar');
  await expect(strip).toBeVisible();
  const labels = await strip.locator('text').allTextContents();
  expect(labels.join(' ')).toMatch(/Baseline|Acquisition|Maintenance/);
  const stripBox = await strip.boundingBox();
  const pointBox = await chart.locator('rect[width="9"]').first().boundingBox();
  expect(stripBox.y + stripBox.height).toBeLessThan(pointBox.y);
  const display = page.locator('#target-analysis .chart-display-menu');
  await display.locator('summary').click();
  await display.getByLabel('Phase labels').uncheck();
  await expect(strip).toHaveCount(0);
  expect(await chart.locator('line[stroke-opacity="0.4"]').count()).toBeGreaterThan(0);
  await accessible(page);
});

test('value labels print each plotted measurement when the timeline is short', async ({ page }) => {
  await open(page, 'Target analysis');
  await page.getByLabel('Group by').selectOption('Weekly');
  const chart = page.locator('#target-analysis svg.chart-svg');
  const display = page.locator('#target-analysis .chart-display-menu');
  await display.locator('summary').click();
  await display.getByLabel('Values').check();
  const label = chart.locator('text[font-size="10"][paint-order="stroke"]').first();
  await expect(label).toBeVisible();
  expect(await label.textContent()).toMatch(/\d/);
  await display.getByLabel('Values').uncheck();
  await expect(chart.locator('text[font-size="10"][paint-order="stroke"]')).toHaveCount(0);
});

test('behavior zero and untracked records stay distinct in local data and CSV', async ({ page }) => {
  await open(page, 'Target analysis');
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
  await selectBehaviorAnalysis(page, 'Frequency');
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
  await open(page, 'Target analysis');
  const chosen = programs.find(program => program.category === 'SkillAcquisition' && program.id !== skillProgram.id && seed.sessionData.some(row => program.targets.some(target => target.id === row.targetId)));
  await selectProgram(page, chosen.id);
  const selectedFamily = await page.locator('.explorer-family__chip[aria-pressed="true"]').getAttribute('aria-label');
  const target = chosen.targets.find(item => selectedFamily?.startsWith(`${measurementFamilyFor(item).label},`));
  // The mastery chart lives in the progress workflow; its selection must survive the trip.
  await activate(page, 'Progress overview');
  await page.locator('#mastery-prog').selectOption(chosen.id);
  await activate(page, 'Target analysis');
  await openAnnotations(page);
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
  await open(page, 'Target analysis');
  await openAnnotations(page);
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
  await open(page, 'Target analysis');
  const frequencyProgram = programs.find(program => program.category === 'SkillAcquisition' && program.targets.some(target => target.type === 'Frequency'));
  await selectProgram(page, frequencyProgram.id);
  await changeMeasurement(page, 'Frequency');
  await expectChartOptionsVisible(page);
  await page.getByLabel('Frequency measure').selectOption('Rate per Minute');
  await page.locator('#target-analysis summary').filter({ hasText: 'View plotted data table' }).click();
  await expect(page.locator('#target-analysis .data-table')).toContainText('per minute');
  await selectProgram(page, skillProgram.id);
  await changeMeasurement(page, 'Anecdotal');
  await expect(page.getByRole('heading', { name: 'Observation notes', exact: true })).toBeVisible();
  await activate(page, 'ABC observations');
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
  await activate(page, 'Target analysis');
  const raw = await download(page, 'Export targets', 'Raw observations · CSV');
  const parsed = csv(raw.bytes.toString());
  expect(parsed[1][parsed[0].indexOf('Target Name')]).toBe(skillProgram.targets[0].name);
  const zip = await download(page, 'Export targets', 'All client targets · ZIP');
  expect(zip.name).toMatch(/\.zip$/); expect(zip.bytes.subarray(0, 2).toString()).toBe('PK');
  await activate(page, 'ABC observations');
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
  // Heavy workflows load their own chunk on first visit, with a layout-shaped skeleton.
  await page.getByRole('tab', { name: 'Target analysis', exact: true }).click();
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
    await expect(page.getByRole('heading', { name: 'Progress overview', level: 1 })).toBeVisible();
  }
  const response = await page.goto('missing/deep-page');
  expect(response.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Let’s get you back to the workspace.' })).toBeVisible();
  await accessible(page);
  await page.getByRole('link', { name: 'Back to analytics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Progress overview' })).toBeVisible();
});

test('the skip link bypasses workspace navigation with a visible focus target', async ({ page }) => {
  // A fresh load puts sequential focus at the document start, so Tab reaches the skip link.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Progress overview', level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to analytics', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await skip.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('session pagination and weekly/monthly labels follow the actual grouped data', async ({ page }) => {
  await open(page, 'Target analysis');
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
  await open(page, 'Target analysis');
  const targets = skillProgram.targets.filter(target => target.type === 'TrialByTrial');
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.getByRole('button', { name: 'Clear target selection', exact: true }).click();
  await nav.locator('.explorer-target').filter({ hasText: targets[0].name }).locator('input[type="checkbox"]').check();
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
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
  const display = page.locator('#target-analysis .chart-display-menu');
  await display.locator('summary').click();
  await display.getByLabel('Monochrome').check();
  const grid = page.locator('#target-analysis svg.chart-svg line[stroke-dasharray="3 3"]');
  expect(await grid.count()).toBeGreaterThan(0);
  await display.getByLabel('Gridlines').uncheck();
  await expect(grid).toHaveCount(0);
  await accessible(page);
});

test('range and note editing/deletion do not duplicate or lose unrelated annotations', async ({ page }) => {
  await open(page, 'Target analysis');
  await openAnnotations(page);
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
  await open(page, 'Target analysis');
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
  await open(page, 'Target analysis');
  const chosen = programs.filter(program => program.category === 'SkillAcquisition')[1];
  await page.evaluate(ids => {
    const rows = JSON.parse(localStorage.getItem('welina_sessions'));
    localStorage.setItem('welina_sessions', JSON.stringify(rows.filter(row => !ids.includes(row.targetId))));
  }, chosen.targets.map(target => target.id));
  await page.reload();
  await selectProgram(page, chosen.id);
  await expect(page.getByRole('heading', { name: 'No observations for this program yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Record an observation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Record observation', exact: true });
  await expect(dialog.getByLabel('Program & target')).toHaveValue(chosen.targets[0].id);
  await expect(dialog.getByLabel('Recorded duration (seconds)')).toBeVisible();
});

test('out-of-range data is not mislabeled as hidden series and has a recovery action', async ({ page }) => {
  await open(page, 'Target analysis');
  await page.evaluate(ids => {
    const rows = JSON.parse(localStorage.getItem('welina_sessions'));
    localStorage.setItem('welina_sessions', JSON.stringify(rows.map(row => ids.includes(row.targetId) ? { ...row, timestamp: '2026-01-14T10:00:00' } : row)));
  }, skillProgram.targets.map(target => target.id));
  await page.reload();
  await selectProgram(page, skillProgram.id);
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

test('workflow tabs show one screen at a time, sync the sidebar and keep deep links', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const workflows = [['overview', 'Progress overview'], ['target-analysis', 'Target analysis'], ['abc-observations', 'ABC observations'], ['service-quality', 'Service & data quality'], ['reports', 'Reports']];
  for (const [id, name] of workflows) {
    await activate(page, name);
    const panel = page.locator(`#workflow-panel-${id}`);
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('aria-labelledby', `workflow-tab-${id}`);
    expect(new URL(page.url()).hash).toBe(`#${id}`);
    for (const [otherId] of workflows) {
      if (otherId !== id) await expect(page.locator(`#workflow-panel-${otherId}`)).toBeHidden();
    }
    await expect(page.locator(`.shell-layout > .sidebar a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location');
  }
  // Arrow keys move along the tab strip with a roving tabindex.
  await page.getByRole('tab', { name: 'Reports', exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Progress overview', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Target analysis', exact: true })).toHaveAttribute('aria-selected', 'true');
  // Deep links open the named workflow without a scroll hunt.
  await page.goto('./#abc-observations');
  await expect(page.getByRole('tab', { name: 'ABC observations', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#abc-observations')).toBeVisible();
});

test('documentation lazy-loads and its full page index stays scrollable', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: 620 });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/DocumentationSection*.js', async route => { await gate; await route.continue(); });
  await page.goto('./#documentation', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#workflow-panel-documentation .analytics-skeleton')).toBeVisible();
  release();

  const navigation = page.getByRole('navigation', { name: 'Documentation sections' });
  const techStack = navigation.getByRole('link', { name: 'Tech stack & architecture', exact: true });
  await expect(page.getByRole('heading', { name: 'Start here', level: 1 })).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(11);
  if (mobile) {
    const dimensions = await navigation.evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
    await navigation.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  } else {
    const dimensions = await navigation.evaluate(element => ({
      scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, overflowY: getComputedStyle(element).overflowY
    }));
    expect(dimensions.overflowY).toBe('auto');
    expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
    await navigation.evaluate(element => { element.scrollTop = element.scrollHeight; });
  }
  // The container scroll is exercised above, but layout reflow after font/markdown settle
  // can leave this link just outside the viewport. Scroll the target itself into view so
  // the visibility assertion is deterministic rather than a scroll-position race.
  await techStack.scrollIntoViewIfNeeded();
  await expect(techStack).toBeInViewport();
  await techStack.click();
  await expect(page.getByRole('heading', { name: 'Tech stack & architecture', level: 1 })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('doc')).toBe('tech-stack');
  expect(new URL(page.url()).hash).toBe('#documentation');
});

test('workspace sidebar scrolls its lower items into view on short screens', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.setViewportSize({ width: mobile ? 390 : 1280, height: 520 });
  await open(page);
  let scrollArea;
  let sidebar;
  if (mobile) {
    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    sidebar = page.getByRole('dialog', { name: 'Workspace', exact: true });
    scrollArea = sidebar.locator('.dialog-content');
  } else {
    sidebar = page.locator('.shell-layout > .sidebar');
    scrollArea = sidebar;
  }
  const dimensions = await scrollArea.evaluate(element => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await scrollArea.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(sidebar.getByRole('button', { name: 'Reset demo data' })).toBeInViewport();
  const docsLink = sidebar.getByRole('link', { name: 'Documentation', exact: true });
  await docsLink.scrollIntoViewIfNeeded();
  await expect(docsLink).toBeInViewport();
});

test('returning to a workflow keeps its chart state instead of resetting the screen', async ({ page }) => {
  await open(page, 'Target analysis');
  await page.getByLabel('Group by').selectOption('Weekly');
  await activate(page, 'Reports');
  await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
  await activate(page, 'Target analysis');
  await expect(page.getByLabel('Group by')).toHaveValue('Weekly');
});

test('default controls provide 44px pointer targets or full-sized associated labels', async ({ page }) => {
  await open(page);
  for (const tab of ['Progress overview', 'Target analysis', 'ABC observations', 'Service & data quality', 'Reports']) {
    await activate(page, tab);
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
    expect(small, `small targets in “${tab}”`).toEqual([]);
  }
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
  await open(page, 'Target analysis');
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
  await open(page, 'Target analysis');
  await page.locator('#target-date-range').selectOption('6 months');
  const helpers = skillProgram.targets.find(target => target.phase === 'Acquisition' && target.type === 'TrialByTrial');
  await openTargetSelection(page);
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  await nav.getByRole('button', { name: 'Clear target selection', exact: true }).click();
  await nav.locator('.explorer-target').filter({ hasText: helpers.name }).locator('input[type="checkbox"]').check();
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
  const more = page.locator('#target-analysis .chart-more-menu');
  await more.locator('summary').click();
  const menu = more.locator('.chart-menu__panel');
  for (const name of ['Median line', 'Mastery criterion line', 'Projection (80% band)', 'Stability envelope', 'Condition means', 'IOA markers']) {
    await menu.getByRole('checkbox', { name: new RegExp(`^${name.replace(/[()]/g, '\\$&')}`) }).check();
  }
  await more.locator('summary').click();
  await expect(more.locator('summary')).toBeFocused();
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
  await open(page, 'Target analysis');
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
  await open(page, 'Target analysis');
  await expectChartOptionsVisible(page);
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Prompt levels', exact: true }).click();
  await expect(page.locator('#target-analysis svg.chart-svg title').first()).toHaveText('Prompt levels');
  const fluency = programs.find(program => program.targets.some(target => target.type === 'FluencyRate'));
  await selectProgram(page, fluency.id, 'Fluency / rate');
  await page.locator('#target-date-range').selectOption('3 months');
  await page.getByRole('group', { name: 'Chart view' }).getByRole('button', { name: 'Celeration', exact: true }).click();
  await expect(page.locator('#target-analysis svg.chart-svg')).toContainText('/wk');
  await accessible(page);
});

test('ABC patterns drill into the log and the forecast reports its own accuracy', async ({ page }) => {
  await open(page, 'ABC observations');
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
  // The map itself lives in the progress workflow; go back to it before filtering.
  await activate(page, 'Progress overview');
  await map.getByRole('button', { name: 'Behaviors', exact: true }).click();
  await expect(map.locator('tbody tr')).toHaveCount(behaviorTargets.length);
});

test('portfolio triage summarizes trends, filters the matrix and drills into a target', async ({ page }) => {
  await open(page);
  const health = buildTargetHealth({
    programs,
    sessions: seed.sessionData.filter(row => row.clientId === client.id),
    asOfDate: seed.asOfDate
  });
  const triage = page.locator('.kpi-strip').first();
  await expect(triage).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clinical attention center' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Target health matrix' })).toBeVisible();

  // A KPI card filters the matrix to exactly the items its number represents. The matrix is a
  // separate module lower on the page, so pressing the card also takes the reviewer there and
  // the matrix announces what it now shows.
  const reviewCard = triage.locator('.kpi-card[data-filter="needsReview"]');
  await reviewCard.click();
  await expect(page.locator('#overview-matrix')).toBeFocused();
  await expect(reviewCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.health-matrix tbody tr.health-matrix__row')).toHaveCount(health.kpis.needsReview);
  // The panel <section> and its scrollable table wrapper are both named regions, so read the
  // filter chip itself rather than matching a region by a shared prefix.
  await expect(page.locator('.health-matrix-panel .matrix-filter')).toContainText(`Filtered: Needs review · ${health.kpis.needsReview} of ${health.items.length}`);
  await expect(page.locator('.health-matrix-panel [role="status"]')).toContainText(`Showing ${health.kpis.needsReview} of ${health.items.length} targets`);
  await accessible(page);
  // Clearing keeps the reviewer in the table instead of dropping focus to the document body.
  await page.getByRole('button', { name: 'Clear filter' }).click();
  await expect(page.locator('.health-matrix-panel')).toBeFocused();
  await expect(page.locator('.health-matrix tbody tr.health-matrix__row')).toHaveCount(health.items.length);
  await expect(page.locator('.health-matrix-panel [role="status"]')).toContainText(`Filter cleared. Showing all ${health.items.length} targets`);

  // An attention card opens that target in the target analysis via the focus channel.
  const firstAttention = page.locator('.attention-card').first();
  const attentionName = await firstAttention.locator('.attention-card__name').innerText();
  await firstAttention.click();
  await expect(page.locator('#target-analysis')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Target analysis' })).toBeVisible();

  // A matrix row offers the same one-click drilldown, keyboard included.
  await activate(page, 'Progress overview');
  const firstRow = page.locator('.health-matrix tbody tr.health-matrix__row').first();
  await firstRow.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#target-analysis')).toBeFocused();

  // Recent successes can seed the reporting workflow without a new navigation pattern.
  await activate(page, 'Progress overview');
  await page.getByRole('button', { name: 'Use in report' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Reports' })).toBeVisible();
  expect(attentionName).toBeTruthy();
});

test('service and data quality summarize dosage, IOA, fidelity and supervision', async ({ page }) => {
  await open(page, 'Service & data quality');
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
  await open(page, 'Reports');
  const reports = page.locator('#reports');
  await expect(reports.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
  await expect(reports.getByLabel('Template')).toHaveValue('clinical-review');
  await reports.getByLabel('Template').selectOption('reassessment');
  await expect(reports.getByLabel('Date range')).toHaveValue('3 months');
  const report = page.waitForEvent('download');
  await reports.getByRole('button', { name: 'Download report', exact: true }).first().click();
  const html = await report;
  expect(html.suggestedFilename()).toMatch(/\.html$/);
  expect((await read(await html.path())).toString()).toContain('<svg');

  // The roster is a separate task so report-building controls do not compete for attention.
  await reports.getByRole('button', { name: /Target roster/ }).click();
  const roster = reports.locator('table.data-table');
  expect(await roster.locator('tbody tr').count()).toBeGreaterThan(0);
  // The roster carries introduction and mastery dates for acquisition-rate reporting.
  await expect(roster.locator('thead')).toContainText('Introduced');
  await expect(roster.locator('thead')).toContainText('Mastered');
  const csv = page.waitForEvent('download');
  await reports.getByRole('button', { name: 'Export CSV', exact: true }).click();
  expect((await csv).suggestedFilename()).toMatch(/^Target_roster_.*\.csv$/);
  await accessible(page);
});

test('view-only analytics access keeps reading and exporting but blocks every change', async ({ page }, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem('welina_access_level', 'view'));
  await open(page, 'Target analysis');
  await expect(page.locator('.view-only-notice').first()).toContainText('View-only analytics access');
  await expect(page.getByRole('button', { name: 'Record observation', exact: true })).toBeDisabled();
  await expect(page.locator('#target-analysis .annotation-actions button').first()).toBeDisabled();
  const display = page.locator('#target-analysis .chart-display-menu');
  await display.locator('summary').click();
  await expect(display.getByLabel('Show missing dates')).toBeDisabled();
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
  await open(page, 'Service & data quality');
  const activity = page.locator('.live-activity');
  await expect(activity.getByRole('heading', { name: /Session activity/ })).toBeVisible();
  await expect(activity).toContainText('Appointments today');
  await expect(activity).toContainText('Documentation');
  const appointmentDetails = activity.locator('details.service-appointments');
  await expect(appointmentDetails.locator('summary')).toContainText('Appointment details');
  await appointmentDetails.locator('summary').click();
  await expect(activity.getByRole('table', { name: /Appointments on/ })).toBeVisible();
  await expect(activity.locator('.week-strip > div')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'Service and data quality sections' }).getByRole('link')).toHaveCount(5);
  await accessible(page);
});

test('event timestamps read as a time-of-day scatterplot in the ABC patterns', async ({ page }) => {
  await open(page, 'ABC observations');
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

test('the shared overview scope drives triage, timeline, mastery and the progress map', async ({ page }) => {
  await open(page);
  const scope = page.locator('.overview-scope');
  const rangeGroup = scope.getByRole('group', { name: 'Time range' });
  const programGroup = scope.getByRole('group', { name: 'Program scope' });
  await expect(rangeGroup.getByRole('button', { name: 'Last 90 days' })).toHaveAttribute('aria-pressed', 'true');
  await expect(programGroup.getByRole('button', { name: 'All programs' })).toHaveAttribute('aria-pressed', 'true');
  await expect(scope).toContainText('90 days');
  await expect(page.locator('.kpi-strip')).toHaveAttribute('aria-label', 'Portfolio status for the last 90 days');

  // Behavior scope keeps only behavior programs: the matrix, the map rows and the mastery panel
  // all follow the same choice instead of each holding its own filter.
  await programGroup.getByRole('button', { name: 'Behavior reduction' }).click();
  await expect(programGroup.getByRole('button', { name: 'Behavior reduction' })).toHaveAttribute('aria-pressed', 'true');
  const behaviorHealth = buildTargetHealth({ programs: behaviorPrograms, sessions: clientSessions, asOfDate: seed.asOfDate, windowDays: 90 });
  await expect(page.locator('.health-matrix tbody tr.health-matrix__row')).toHaveCount(behaviorHealth.items.length);
  await expect(page.getByRole('heading', { name: 'No skill programs in this scope.' })).toBeVisible();
  const map = page.locator('.progress-heatmap');
  await expect(map).toContainText('Rows follow the program scope');
  await expect(map.getByRole('button', { name: 'Skills', exact: true })).toHaveCount(0);
  await accessible(page);

  // Back to all programs; a shorter shared range resizes every section together.
  await programGroup.getByRole('button', { name: 'All programs' }).click();
  await rangeGroup.getByRole('button', { name: 'Last 30 days' }).click();
  await expect(scope).toContainText('30 days');
  await expect(page.locator('.kpi-strip')).toHaveAttribute('aria-label', 'Portfolio status for the last 30 days');
  const shortHealth = buildTargetHealth({ programs, sessions: clientSessions, asOfDate: seed.asOfDate, windowDays: 30 });
  await expect(page.locator('.health-matrix tbody tr.health-matrix__row')).toHaveCount(shortHealth.items.length);
  await expect(page.getByRole('region', { name: 'Clinical attention center' })).toContainText('over the last 30 days');
  await expect(map.locator('thead th')).toHaveCount(weekCountFor({ days: 30 }) + 1);
  await expect(map).toContainText(`over the last ${weekCountFor({ days: 30 })} weeks`);
  const shortWindow = { start: '2026-09-14', asOfDate: seed.asOfDate };
  const shortTimeline = buildInterventionTimeline({
    programs, phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: seed.asOfDate, windowStart: shortWindow.start
  });
  await expect(page.locator('.timeline-panel .timeline-event')).toHaveCount(Math.min(shortTimeline.total, 25));
  // The shared range survives a workflow switch, like every other workspace filter.
  await activate(page, 'Target analysis');
  await activate(page, 'Progress overview');
  await expect(rangeGroup.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true');
});

test('the intervention timeline merges phase pairs and opens a date-scoped chart', async ({ page }) => {
  await open(page);
  const timeline = page.locator('.timeline-panel');
  await expect(timeline.getByRole('heading', { name: 'Intervention timeline' })).toBeVisible();
  const expected = buildInterventionTimeline({
    programs, phaseLines: seed.phaseLines, phaseRanges: seed.phaseRanges, graphNotes: seed.graphNotes,
    asOfDate: seed.asOfDate, windowStart: '2026-07-16'
  });
  await expect(timeline.locator('.timeline-event')).toHaveCount(Math.min(expected.total, 25));
  // The completion sample from the findings doc appears once, with its companion line folded in.
  const first = timeline.locator('.timeline-event').first();
  const label = await first.getAttribute('aria-label');
  expect(label).toContain('Phase change: Completed');
  await expect(first).toContainText('Also recorded: Target completed');
  await expect(first.locator('.timeline-event__flag')).toHaveText('Phase line merged');

  // Selecting an event opens that target's chart with a date filter that contains the event.
  const eventDate = label.slice(0, 10);
  await first.click();
  await expect(page.locator('#target-analysis')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Target analysis' })).toBeVisible();
  await expect(page.locator('#target-date-range')).toHaveValue(durationFilterForDate(eventDate, seed.asOfDate));

  // Filters narrow the feed without changing the data; the table is the non-visual equivalent.
  await activate(page, 'Progress overview');
  const filters = timeline.getByRole('group', { name: 'Timeline events' });
  await filters.getByRole('button', { name: new RegExp(`^Phase changes, ${expected.counts.phase} events`) }).click();
  await expect(timeline.locator('.timeline-event .stat-chip').first()).toHaveText('Phase change');
  await filters.getByRole('button', { name: new RegExp(`^All ${expected.total} events`) }).click();
  await timeline.locator('summary').filter({ hasText: 'View timeline as a table' }).click();
  await expect(timeline.locator('table.timeline-table')).toBeVisible();
  await expect(timeline.locator('table.timeline-table tbody tr')).toHaveCount(expected.total);
  await accessible(page);
});

test('skill mastery aggregates all programs by default and follows the shared range', async ({ page }) => {
  await open(page);
  const mastery = page.locator('section.panel[aria-labelledby="mastery-title"]');
  await expect(page.locator('#mastery-prog')).toHaveValue(ALL_PROGRAMS_ID);
  await expect(mastery).toContainText('Newly mastered in this range');
  await expect(mastery).toContainText('Mastered overall');
  const all = cumulativeMasterySeries(skillPrograms, { from: '2026-07-16', to: seed.asOfDate });
  await expect(mastery.getByRole('img', { name: /All skill programs/ })).toHaveAttribute('aria-label', new RegExp(`${all.at(-1).cumulativeCount} targets mastered`));

  // One program still shows only its own transitions, and the choice survives a workflow switch.
  await page.locator('#mastery-prog').selectOption(skillProgram.id);
  await expect(mastery.getByRole('img', { name: new RegExp(skillProgram.name) })).toBeVisible();
  await activate(page, 'Target analysis');
  await activate(page, 'Progress overview');
  await expect(page.locator('#mastery-prog')).toHaveValue(skillProgram.id);
  await accessible(page);
});

test('target analysis guides category, program, measurement and compatible targets before graphing', async ({ page }) => {
  await page.goto('./');
  await activate(page, 'Target analysis', { prepareAnalysis: false });
  const catalog = buildExplorerCatalog({ programs, sessions: clientSessions, asOfDate: seed.asOfDate });
  const nav = page.getByRole('navigation', { name: 'Target explorer', exact: true });
  const rail = page.getByRole('complementary', { name: 'Clinical context', exact: true });
  const categoryGroup = nav.getByRole('group', { name: 'Analysis category', exact: true });

  await expect(categoryGroup.getByRole('button')).toHaveCount(3);
  await expect(categoryGroup.getByRole('button', { name: /Programs/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(categoryGroup.getByRole('button', { name: /Behaviors/ })).toBeVisible();
  await expect(categoryGroup.getByRole('button', { name: /ABC data/i })).toBeVisible();
  await expect(page.locator('#target-program')).toHaveValue('');
  await expect(page.locator('.analysis-guidance')).toContainText('Choose a program');
  await expect(nav.locator('.explorer-family__chip')).toHaveCount(0);
  await expect(page.locator('.trend-explorer__center svg.chart-svg')).toHaveCount(0);

  // Program selection reveals its measurement types; compatible target rows wait for a type.
  const program = skillPrograms[0];
  await page.locator('#target-program').selectOption(program.id);
  const familyChips = nav.locator('.explorer-family__chip');
  await expect(familyChips.first()).toBeVisible();
  await expect(familyChips.filter({ hasText: 'Trial by trial' })).toHaveAttribute('aria-pressed', 'false');
  await expect(nav.locator('.explorer-target')).toHaveCount(0);
  await familyChips.filter({ hasText: 'Trial by trial' }).click();
  await expect(nav.locator('.explorer-target')).toHaveCount(program.targets.length);
  await expect(nav.locator('.explorer-count')).toContainText('0 of');

  // Different data definitions are explained and cannot be selected with trial-by-trial data.
  const incompatible = nav.locator('.explorer-target--incompatible');
  if (await incompatible.count()) {
    await expect(incompatible.first().locator('input[type="checkbox"]')).toBeDisabled();
    await expect(incompatible.first().locator('.explorer-target__reason')).toContainText(/can.t be plotted with/);
  }
  const search = page.getByLabel('Search targets in this selection');
  await search.fill(program.targets[0].name);
  await expect(nav.locator('.explorer-target')).toHaveCount(1);
  await nav.getByRole('button', { name: 'Clear target search' }).click();
  await expect(nav.locator('.explorer-target')).toHaveCount(program.targets.length);
  const boxes = nav.locator('.explorer-target__check');
  await boxes.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(boxes.nth(1)).toBeFocused();

  await nav.getByRole('button', { name: 'Select all compatible targets', exact: true }).click();
  const selectedCount = await nav.locator('.explorer-target__check:checked').count();
  expect(selectedCount).toBeGreaterThan(0);
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
  await expect(nav.getByRole('button', { name: 'Change selection', exact: true })).toBeVisible();
  await expect(nav.locator('.explorer-selection-summary')).toContainText(`${selectedCount} targets selected`);
  await expect(nav.locator('.explorer-selection-summary')).toContainText('Trial by trial');
  await expect(nav.locator('.explorer-selection-summary')).toContainText('1 month');
  await expect(rail.getByRole('heading', { name: 'Clinical context', exact: true })).toBeVisible();
  await expect(rail.getByRole('heading', { name: 'Annotations', exact: true })).toBeVisible();
  await expect(rail.getByRole('heading', { name: 'Target definition', exact: true })).toBeVisible();
  await expect(rail).toContainText('Discriminative stimuli:');
  await expect(page.locator('.trend-explorer__center svg.chart-svg')).toBeVisible();
  await accessible(page);

  // Changing measurement keeps compatibility explicit and does not silently replace targets.
  await nav.getByRole('button', { name: 'Change selection', exact: true }).click();
  const frequency = nav.locator('.explorer-family__chip').filter({ hasText: 'Frequency' });
  if (await frequency.count()) {
    await frequency.click();
    await expect(nav.locator('.explorer-notice')).toContainText(/different data types can.t share one analysis/);
    await expect(frequency).toHaveAttribute('aria-pressed', 'true');
    await expect(nav.locator('.explorer-target__check:checked')).toHaveCount(0);
    await nav.getByRole('button', { name: 'Dismiss selection note' }).click();
  }

  // Behaviors exposes only behavior-reduction measurement choices and ABC retains its workflow.
  await categoryGroup.getByRole('button', { name: /Behaviors/ }).click();
  await expect(page.locator('#target-program')).toHaveCount(0);
  const behaviorRows = nav.locator('.explorer-target');
  const behaviorTargetCount = behaviorPrograms.flatMap(group => group.targets).length;
  await expect(behaviorRows).toHaveCount(behaviorTargetCount);
  const behaviorFrequency = nav.locator('.explorer-family__chip').filter({ hasText: 'Frequency' });
  await expect(behaviorFrequency).toBeVisible();
  if (await behaviorFrequency.getAttribute('aria-pressed') !== 'true') await behaviorFrequency.click();
  const firstBehavior = behaviorPrograms.flatMap(group => group.targets).find(target => target.type === 'Frequency');
  await expect(nav.locator('.explorer-target').filter({ has: page.locator('.explorer-target__name', { hasText: firstBehavior.name }) })).toBeVisible();
  const behaviorCheck = nav.locator('.explorer-target').filter({ hasText: firstBehavior.name }).locator('input[type="checkbox"]');
  await behaviorCheck.check();
  await nav.getByRole('button', { name: 'View analysis', exact: true }).click();
  await expect(rail).toContainText('Function hypothesis:');

  await nav.getByRole('button', { name: 'Change selection', exact: true }).click();
  await categoryGroup.getByRole('button', { name: /ABC data/i }).click();
  await expect(nav.getByRole('region', { name: 'Antecedent options' })).toBeVisible();
  await expect(nav.getByRole('region', { name: 'Behavior options' })).toBeVisible();
  await expect(nav.getByRole('region', { name: 'Consequence options' })).toBeVisible();
  await expect(page.locator('#target-analysis-abc')).toBeVisible();
  await expect(page.getByRole('group', { name: 'ABC analysis', exact: true })).toBeVisible();
  await expect(page.locator('#target-analysis-abc svg.chart-svg')).toBeVisible();
  await accessible(page);

  await categoryGroup.getByRole('button', { name: /Programs/ }).click();
  await expect(page.locator('#target-program')).toHaveValue(program.id);
  await expect(nav.locator('.explorer-target')).toHaveCount(program.targets.length);
  expect(catalog.counts.targets).toBeGreaterThan(program.targets.length);
});

test('reports collapse the builder after generating and preview the document in place', async ({ page }) => {
  await open(page, 'Reports');
  const reports = page.locator('#reports');
  const builder = reports.locator('details.reports-builder');
  const preview = reports.locator('#report-preview');

  // The builder starts expanded and its summary states the current settings.
  await expect(builder).toHaveAttribute('open', '');
  await expect(builder.locator('.reports-builder__current')).toContainText('Clinical review');
  await expect(preview).toHaveCount(0);

  await reports.getByLabel('Template').selectOption('reassessment');
  await reports.getByRole('button', { name: 'Generate preview', exact: true }).first().click();

  // Generating collapses the parameters and moves focus to the generated document.
  await expect(builder).not.toHaveAttribute('open', '');
  await expect(preview).toBeVisible();
  const heading = preview.getByRole('heading', { level: 3 });
  await expect(heading).toBeFocused();
  await expect(heading).toContainText('Reassessment');
  await expect(preview).toContainText('Target list');
  // Graphs are rendered as inert SVG images, so previewing cannot execute report markup.
  const graphs = preview.locator('figure img');
  expect(await graphs.count()).toBeGreaterThan(0);
  for (const source of await graphs.evaluateAll(images => images.map(image => image.getAttribute('src')))) {
    expect(source.startsWith('data:image/svg+xml')).toBe(true);
  }
  // The clinical caveat travels with the document, not only the download.
  await expect(preview).toContainText('Not a clinical determination.');
  // Wide report tables stay inside their own named scroll region: the document must never
  // widen the page, which on a phone would zoom the whole workspace out to fit.
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(widths.page, 'generated preview must not overflow the page').toBeLessThanOrEqual(widths.viewport);
  const scrollRegion = preview.getByRole('region', { name: 'Report target list' });
  await scrollRegion.focus();
  await expect(scrollRegion).toBeFocused();
  // Graphs keep their drawn size inside a keyboard-scrollable region instead of shrinking
  // their axis labels to fit the column.
  const graphRegion = preview.getByRole('region', { name: /^Graph: / }).first();
  await graphRegion.focus();
  await expect(graphRegion).toBeFocused();
  await accessible(page);

  // Editing the settings re-opens the builder, restores the fields and focuses the first one.
  await preview.getByRole('button', { name: 'Edit settings', exact: true }).click();
  await expect(builder).toHaveAttribute('open', '');
  await expect(reports.getByLabel('Template')).toBeFocused();
  await expect(reports.getByLabel('Template')).toHaveValue('reassessment');

  // An out-of-date preview says so instead of silently showing stale output.
  await expect(preview).toContainText('Preview generated');
  await reports.getByLabel('Date range').selectOption('6 months');
  await expect(preview).toContainText('Settings changed since this preview was generated');
  await reports.getByRole('button', { name: 'Generate preview', exact: true }).first().click();
  await expect(preview).not.toContainText('Settings changed since this preview was generated');

  // The header keeps a single primary action and the export remains one menu away.
  await expect(reports.locator('.panel-actions .button--primary')).toHaveCount(1);
  await expect(reports.locator('.panel-header').getByRole('button', { name: 'Export reports' })).toBeVisible();
});

test('overview modules can be reordered by keyboard and the order survives a reload', async ({ page }) => {
  await open(page);
  const order = page.locator('.module-order');
  await expect(order.locator('.module-order__summary')).toContainText(
    'Portfolio status & attention › Skill mastery › Weekly progress map › Target health matrix › Intervention timeline');

  // The default page order closes with the target health matrix and the intervention timeline.
  const ids = ['overview-triage', 'overview-mastery', 'overview-progress-map', 'overview-matrix', 'overview-timeline'];
  const readOrder = () => page.evaluate(destinationIds => [...destinationIds]
    .sort((a, b) => document.getElementById(a).compareDocumentPosition(document.getElementById(b)) & 4 ? -1 : 1), ids);
  expect(await readOrder()).toEqual(ids);
  await expect(page.getByRole('heading', { name: 'Clinical attention center' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Target health matrix' })).toBeVisible();

  await order.locator('summary').click();
  const items = order.locator('.module-order__item');
  await expect(items).toHaveCount(5);
  await expect(items.first()).toContainText('Portfolio status & attention');
  await expect(items.nth(3)).toContainText('Target health matrix');
  await expect(items.nth(4)).toContainText('Intervention timeline');
  // The first module cannot move up and the last cannot move down.
  await expect(order.getByRole('button', { name: 'Move Portfolio status & attention up' })).toBeDisabled();
  await expect(order.getByRole('button', { name: 'Move Intervention timeline down' })).toBeDisabled();

  // Reordering is a plain button press, so it works with keyboard, touch and pointer alike.
  const moveUp = order.getByRole('button', { name: 'Move Target health matrix up' });
  await moveUp.focus();
  await page.keyboard.press('Enter');
  await expect(items.nth(2)).toContainText('Target health matrix');
  await expect(items.nth(3)).toContainText('Weekly progress map');
  await expect(order.locator('.module-order__footer [role="status"]')).toContainText('Target health matrix moved up to position 3 of 5');

  // The page, the section links and the DOM reading order follow the same order.
  expect(await readOrder()).toEqual(['overview-triage', 'overview-mastery', 'overview-matrix', 'overview-progress-map', 'overview-timeline']);
  const links = page.getByRole('navigation', { name: 'Progress overview sections' }).getByRole('link');
  await expect(links).toHaveCount(5);
  expect(await links.allTextContents()).toEqual(
    ['Portfolio status & attention', 'Skill mastery', 'Target health matrix', 'Weekly progress map', 'Intervention timeline']);
  await expect(page.locator('#overview-matrix')).toBeVisible();
  await expect(page.locator('#overview-progress-map')).toBeVisible();
  await accessible(page);

  await page.reload();
  await expect(page.locator('.module-order__summary')).toContainText(
    'Portfolio status & attention › Skill mastery › Target health matrix › Weekly progress map › Intervention timeline');
  // The section link still lands on the moved module and focuses it.
  await page.getByRole('navigation', { name: 'Progress overview sections' }).getByRole('link', { name: 'Target health matrix' }).click();
  await expect(page.locator('#overview-matrix')).toBeFocused();

  await page.locator('.module-order summary').click();
  await page.getByRole('button', { name: 'Reset order', exact: true }).click();
  await expect(page.locator('.module-order__item').first()).toContainText('Portfolio status & attention');
  await expect(page.locator('.module-order__item').last()).toContainText('Intervention timeline');
  // Reset restores the default closing order rather than the previous session's arrangement.
  expect(await readOrder()).toEqual(ids);
});

test('Target analysis keeps refresh beside export while other workflow actions overflow', async ({ page }) => {
  await open(page, 'Target analysis');
  const header = page.locator('#target-analysis .panel-header');
  await expect(header.getByRole('button', { name: 'Export targets', exact: true })).toBeVisible();
  await header.getByRole('button', { name: 'Refresh target analysis', exact: true }).click();
  await expect(header.getByRole('button', { name: 'Refresh target analysis', exact: true })).toBeVisible();

  // The shared header redesign remains in place for the unrelated ABC workflow.
  await activate(page, 'ABC observations');
  const abcHeader = page.locator('#abc-observations .panel-header');
  await abcHeader.getByRole('button', { name: 'More actions', exact: true }).click();
  await expect(abcHeader.getByRole('button', { name: 'Refresh ABC observations', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await accessible(page);
});
