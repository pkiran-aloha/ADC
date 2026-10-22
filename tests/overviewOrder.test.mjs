import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OVERVIEW_ORDER, LEGACY_OVERVIEW_MODULE_STORAGE_KEY, OVERVIEW_MODULES,
  OVERVIEW_MODULE_STORAGE_KEY, describeOverviewMove, migrateLegacyOverviewOrder, moduleById,
  moveOverviewModule, moveOverviewModuleTo, normalizeOverviewOrder, readOverviewOrder, writeOverviewOrder
} from '../frontend/src/utils/overviewOrder.js';

const memoryStorage = (seed = {}) => {
  const store = new Map(Object.entries(seed));
  return {
    store,
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
};

test('the default module order lists every overview module once', () => {
  // Portfolio status first, the two longitudinal views next, then the target health matrix
  // and the intervention timeline as the closing modules.
  assert.deepEqual([...DEFAULT_OVERVIEW_ORDER], ['triage', 'mastery', 'progress-map', 'matrix', 'timeline']);
  assert.equal(DEFAULT_OVERVIEW_ORDER.length, OVERVIEW_MODULES.length);
  assert.equal(DEFAULT_OVERVIEW_ORDER.at(-1), 'timeline');
  assert.equal(DEFAULT_OVERVIEW_ORDER.at(-2), 'matrix');
  // Every module maps to the section anchor the in-page navigation targets.
  for (const module of OVERVIEW_MODULES) assert.match(module.offset, /^overview-/);
  // The matrix is a module in its own right, not part of the triage heading any more.
  assert.equal(moduleById('matrix').label, 'Target health matrix');
  assert.equal(moduleById('matrix').offset, 'overview-matrix');
  assert.equal(moduleById('triage').label, 'Portfolio status & attention');
});

test('stored orders are accepted only as a complete permutation of known modules', () => {
  assert.deepEqual(normalizeOverviewOrder(['matrix', 'triage', 'timeline', 'mastery', 'progress-map']),
    ['matrix', 'triage', 'timeline', 'mastery', 'progress-map']);
  // Duplicates, unknown ids and non-strings are dropped, and missing modules are appended.
  assert.deepEqual(normalizeOverviewOrder(['progress-map', 'progress-map', 'bogus', 7, null]),
    ['progress-map', 'triage', 'mastery', 'matrix', 'timeline']);
  assert.deepEqual(normalizeOverviewOrder([]), [...DEFAULT_OVERVIEW_ORDER]);
  for (const value of [null, undefined, 'mastery', 42, { 0: 'mastery' }]) {
    assert.deepEqual(normalizeOverviewOrder(value), [...DEFAULT_OVERVIEW_ORDER], String(value));
  }
});

test('moving a module respects the ends and never loses or duplicates a module', () => {
  const order = [...DEFAULT_OVERVIEW_ORDER];
  assert.deepEqual(moveOverviewModule(order, 'triage', -1), order);
  assert.deepEqual(moveOverviewModule(order, 'timeline', 1), order);
  assert.deepEqual(moveOverviewModule(order, 'mastery', -1), ['mastery', 'triage', 'progress-map', 'matrix', 'timeline']);
  assert.deepEqual(moveOverviewModule(order, 'matrix', 1), ['triage', 'mastery', 'progress-map', 'timeline', 'matrix']);
  assert.deepEqual(moveOverviewModule(order, 'mastery', 5), order);
  assert.deepEqual(moveOverviewModule(order, 'not-a-module', 1), order);
  assert.deepEqual(moveOverviewModuleTo(order, 'timeline', 0), ['timeline', 'triage', 'mastery', 'progress-map', 'matrix']);
  assert.deepEqual(moveOverviewModuleTo(order, 'triage', 99), ['mastery', 'progress-map', 'matrix', 'timeline', 'triage']);
  // The input order is never mutated, so render-phase state stays predictable.
  assert.deepEqual(order, [...DEFAULT_OVERVIEW_ORDER]);
  for (const next of [moveOverviewModule(order, 'mastery', -1), moveOverviewModuleTo(order, 'triage', 4)]) {
    assert.deepEqual([...next].sort(), [...DEFAULT_OVERVIEW_ORDER].sort());
  }
});

test('move messages name the module and its new position for the live region', () => {
  assert.equal(describeOverviewMove(['triage', 'mastery', 'matrix', 'timeline', 'progress-map'], 'mastery'), 'Skill mastery moved to position 2 of 5.');
  assert.equal(describeOverviewMove(DEFAULT_OVERVIEW_ORDER, 'timeline'), 'Intervention timeline moved to position 5 of 5.');
  assert.equal(describeOverviewMove(DEFAULT_OVERVIEW_ORDER, 'matrix'), 'Target health matrix moved to position 4 of 5.');
  assert.equal(describeOverviewMove(DEFAULT_OVERVIEW_ORDER, 'unknown'), '');
});

test('a saved v1 order gains the matrix in its new position and keeps the rest of the intent', () => {
  // The old default simply becomes the new default: "reset" must not pin an obsolete order.
  assert.deepEqual(migrateLegacyOverviewOrder(['triage', 'timeline', 'mastery', 'progress-map']),
    [...DEFAULT_OVERVIEW_ORDER]);
  // A customised order keeps its arrangement; the new module slots in just before the timeline.
  assert.deepEqual(migrateLegacyOverviewOrder(['timeline', 'triage', 'mastery', 'progress-map']),
    ['matrix', 'timeline', 'triage', 'mastery', 'progress-map']);
  assert.deepEqual(migrateLegacyOverviewOrder(['triage', 'mastery', 'progress-map', 'timeline']),
    ['triage', 'mastery', 'progress-map', 'matrix', 'timeline']);
  // An order that already lists the matrix is left alone.
  assert.deepEqual(migrateLegacyOverviewOrder(['matrix', 'triage', 'timeline', 'mastery', 'progress-map']),
    ['matrix', 'triage', 'timeline', 'mastery', 'progress-map']);
  // A corrupt legacy value falls back to the documented default, never to a partial order.
  assert.deepEqual(migrateLegacyOverviewOrder(['bogus']), [...DEFAULT_OVERVIEW_ORDER]);
  assert.deepEqual(migrateLegacyOverviewOrder(null), [...DEFAULT_OVERVIEW_ORDER]);
});

test('the module order round-trips through storage, migrates v1 and survives a blocked browser', () => {
  const storage = memoryStorage();
  assert.deepEqual(readOverviewOrder(storage), [...DEFAULT_OVERVIEW_ORDER]);
  assert.equal(writeOverviewOrder(['timeline', 'triage', 'matrix', 'progress-map', 'mastery'], storage), true);
  assert.deepEqual(readOverviewOrder(storage), ['timeline', 'triage', 'matrix', 'progress-map', 'mastery']);
  assert.equal(JSON.parse(storage.store.get(OVERVIEW_MODULE_STORAGE_KEY)).length, 5);
  assert.equal(storage.store.has(LEGACY_OVERVIEW_MODULE_STORAGE_KEY), false);

  // An untouched v1 key is read, migrated and never mistaken for a v2 preference.
  const legacy = memoryStorage({ [LEGACY_OVERVIEW_MODULE_STORAGE_KEY]: JSON.stringify(['triage', 'timeline', 'mastery', 'progress-map']) });
  assert.deepEqual(readOverviewOrder(legacy), [...DEFAULT_OVERVIEW_ORDER]);
  // A v2 order wins over anything left in the v1 key.
  const both = memoryStorage({
    [OVERVIEW_MODULE_STORAGE_KEY]: JSON.stringify(['timeline', 'matrix', 'triage', 'mastery', 'progress-map']),
    [LEGACY_OVERVIEW_MODULE_STORAGE_KEY]: JSON.stringify(['triage', 'timeline', 'mastery', 'progress-map'])
  });
  assert.deepEqual(readOverviewOrder(both), ['timeline', 'matrix', 'triage', 'mastery', 'progress-map']);

  storage.setItem(OVERVIEW_MODULE_STORAGE_KEY, '{not json');
  assert.deepEqual(readOverviewOrder(storage), [...DEFAULT_OVERVIEW_ORDER]);

  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); }
  };
  assert.deepEqual(readOverviewOrder(blocked), [...DEFAULT_OVERVIEW_ORDER]);
  assert.equal(writeOverviewOrder(DEFAULT_OVERVIEW_ORDER, blocked), false);
  // With no storage at all the write is skipped rather than thrown; the order simply does
  // not persist, matching how the graph preferences degrade.
  assert.equal(writeOverviewOrder(DEFAULT_OVERVIEW_ORDER, null), true);
});
