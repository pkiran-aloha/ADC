import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme } from '../frontend/src/utils/theme.js';

test('an explicit choice wins over the system setting', () => {
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
});

test('without a choice the system setting decides, and anything else is ignored', () => {
  assert.equal(resolveTheme(null, true), 'dark');
  assert.equal(resolveTheme(null, false), 'light');
  assert.equal(resolveTheme('sepia', true), 'dark');
});
