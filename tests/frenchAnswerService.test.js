import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dictationAnswersMatch,
  parseFrenchNumber,
} from '../services/frenchAnswerService.js';

test('accepts Arabic digits and equivalent French number words', () => {
  assert.equal(dictationAnswersMatch('3', 'trois'), true);
  assert.equal(dictationAnswersMatch('trois', '3'), true);
  assert.equal(dictationAnswersMatch('44', 'quarante-quatre'), true);
  assert.equal(dictationAnswersMatch('quarante quatre', '44'), true);
  assert.equal(dictationAnswersMatch('100', 'cent'), true);
});

test('parses common beginner French numbers without confusing other words', () => {
  assert.equal(parseFrenchNumber('soixante-dix'), 70);
  assert.equal(parseFrenchNumber('quatre-vingt-dix-neuf'), 99);
  assert.equal(parseFrenchNumber('deux cent quarante-quatre'), 244);
  assert.equal(parseFrenchNumber('première'), null);
});

test('does not accept a different number or unrelated word', () => {
  assert.equal(dictationAnswersMatch('43', 'quarante-quatre'), false);
  assert.equal(dictationAnswersMatch('droite', '44'), false);
});
