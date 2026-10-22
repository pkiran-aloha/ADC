import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OVERVIEW_ORDER, OVERVIEW_MODULES, describeOverviewMove, moveOverviewModule,
  moveOverviewModuleTo, normalizeOverviewOrder, readOverviewOrder, writeOverviewOrder
} from '../frontend/src/utils/overviewOrder.js';

const memoryStorage = () => {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value))
  };
};

test('the default module order lists every overview module once', () => {
  assert.deepEqual([...DEFAULT_OVERVIEW_ORDER], ['triage', 'timeline', 'mastery', 'progress-map']);
  assert.equal(DEFAULT_OVERVIEW_ORDER.length, OVERVIEW_MODULES.length);
  // Every module maps to the section anchor the in-page navigation targets.
  for (const module of OVERVIEW_MODULES) assert.match(module.offset, /^overview-/);
});

test('stored orders are accepted only as a complete permutation of known modules', () => {
  assert.deepEqual(normalizeOverviewOrder(['mastery', 'triage', 'timeline', 'progress-map']), ['mastery', 'triage', 'timeline', 'progress-map']);
  // Duplicates, unknown ids and non-strings are dropped, and missing modules are appended.
  assert.deepEqual(normalizeOverviewOrder(['progress-map', 'progress-map', 'bogus', 7, null]), ['progress-map', 'triage', 'timeline', 'mastery']);
  assert.deepEqual(normalizeOverviewOrder([]), [...DEFAULT_OVERVIEW_ORDER]);
  for (const value of [null, undefined, 'mastery', 42, { 0: 'mastery' }]) {
    assert.deepEqual(normalizeOverviewOrder(value), [...DEFAULT_OVERVIEW_ORDER], String(value));
  }
});

test('moving a module respects the ends and never loses or duplicates a module', () => {
  const order = [...DEFAULT_OVERVIEW_ORDER];
  assert.deepEqual(moveOverviewModule(order, 'triage', -1), order);
  assert.deepEqual(moveOverviewModule(order, 'progress-map', 1), order);
  assert.deepEqual(moveOverviewModule(order, 'mastery', -1), ['triage', 'mastery', 'timeline', 'progress-map']);
  assert.deepEqual(moveOverviewModule(order, 'mastery', 5), order);
  assert.deepEqual(moveOverviewModule(order, 'not-a-module', 1), order);
  assert.deepEqual(moveOverviewModuleTo(order, 'progress-map', 0), ['progress-map', 'triage', 'timeline', 'mastery']);
  assert.deepEqual(moveOverviewModuleTo(order, 'triage', 99), ['timeline', 'mastery', 'progress-map', 'triage']);
  // The input order is never mutated, so render-phase state stays predictable.
  assert.deepEqual(order, [...DEFAULT_OVERVIEW_ORDER]);
  for (const next of [moveOverviewModule(order, 'mastery', -1), moveOverviewModuleTo(order, 'triage', 3)]) {
    assert.deepEqual([...next].sort(), [...DEFAULT_OVERVIEW_ORDER].sort());
  }
});

test('move messages name the module and its new position for the live region', () => {
  assert.equal(describeOverviewMove(['triage', 'mastery', 'timeline', 'progress-map'], 'mastery'), 'Skill mastery moved to position 2 of 4.');
  assert.equal(describeOverviewMove(DEFAULT_OVERVIEW_ORDER, 'progress-map'), 'Weekly progress map moved to position 4 of 4.');
  assert.equal(describeOverviewMove(DEFAULT_OVERVIEW_ORDER, 'unknown'), '');
});

test('the module order round-trips through storage and survives a blocked browser', () => {
  const storage = memoryStorage();
  assert.deepEqual(readOverviewOrder(storage), [...DEFAULT_OVERVIEW_ORDER]);
  assert.equal(writeOverviewOrder(['timeline', 'triage', 'progress-map', 'mastery'], storage), true);
  assert.deepEqual(readOverviewOrder(storage), ['timeline', 'triage', 'progress-map', 'mastery']);

  storage.setItem('welina_overview_module_order', '{not json');
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
