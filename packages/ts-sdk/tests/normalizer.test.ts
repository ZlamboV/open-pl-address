import test from 'node:test';
import assert from 'node:assert';
import {
  stripPolishDiacritics,
  transliterateCyrillic,
  normalizeText,
  normalizePostalCode,
  isValidPostalCode,
  normalizeBuildingNumber,
  extractBuildingNumericPart,
} from '../src/normalizer.ts';

test('TextNormalizer - Polish diacritics stripping', () => {
  assert.strictEqual(stripPolishDiacritics('Łódź'), 'Lodz');
  assert.strictEqual(stripPolishDiacritics('Krakowskie Przedmieście'), 'Krakowskie Przedmiescie');
  assert.strictEqual(stripPolishDiacritics('Świętokrzyska'), 'Swietokrzyska');
  assert.strictEqual(stripPolishDiacritics('Zażółć gęślą jaźń'), 'Zazolc gesla jazn');
});

test('TextNormalizer - Cyrillic transliteration for Ukrainian & Russian input', () => {
  assert.strictEqual(transliterateCyrillic('Люблін'), 'lublin');
  assert.strictEqual(transliterateCyrillic('Варшава'), 'warszawa');
  assert.strictEqual(transliterateCyrillic('Лодзь'), 'lodz');
  assert.strictEqual(transliterateCyrillic('Краків'), 'krakow');
  assert.strictEqual(transliterateCyrillic('Вроцлав'), 'wroclaw');
  assert.strictEqual(transliterateCyrillic('вул. Венявська'), 'wieniawska');
  assert.strictEqual(transliterateCyrillic('вулиця Липова'), 'lipowa');
});

test('TextNormalizer - normalizeText canonicalization', () => {
  assert.strictEqual(normalizeText('  ŁÓDŹ  '), 'lodz');
  assert.strictEqual(normalizeText('ul. Krakowskie Przedmieście'), 'krakowskie przedmiescie');
  assert.strictEqual(normalizeText('al. Racławickie'), 'raclawickie');
  assert.strictEqual(normalizeText('Люблін'), 'lublin');
});

test('TextNormalizer - Postal code normalization and validation', () => {
  assert.strictEqual(normalizePostalCode('20002'), '20-002');
  assert.strictEqual(normalizePostalCode('20 002'), '20-002');
  assert.strictEqual(normalizePostalCode('20-002'), '20-002');
  assert.strictEqual(normalizePostalCode('invalid'), null);
  assert.strictEqual(normalizePostalCode('123'), null);

  assert.strictEqual(isValidPostalCode('20-002'), true);
  assert.strictEqual(isValidPostalCode('00-001'), true);
  assert.strictEqual(isValidPostalCode('20002'), false);
  assert.strictEqual(isValidPostalCode('abc'), false);
});

test('TextNormalizer - Building number normalization', () => {
  assert.strictEqual(normalizeBuildingNumber('  12 a  '), '12A');
  assert.strictEqual(normalizeBuildingNumber('14 / 2'), '14');
  assert.strictEqual(normalizeBuildingNumber('16 m. 4'), '16');
  assert.strictEqual(normalizeBuildingNumber('32A'), '32A');
  assert.strictEqual(normalizeBuildingNumber('84/92'), '84');
});

test('TextNormalizer - extractBuildingNumericPart', () => {
  assert.strictEqual(extractBuildingNumericPart('12'), 12);
  assert.strictEqual(extractBuildingNumericPart('12A'), 12);
  assert.strictEqual(extractBuildingNumericPart('  15/17  '), 15);
  assert.strictEqual(extractBuildingNumericPart('84/92'), 84);
  assert.strictEqual(extractBuildingNumericPart('4A'), 4);
  assert.strictEqual(extractBuildingNumericPart(''), null);
  assert.strictEqual(extractBuildingNumericPart(null), null);
  assert.strictEqual(extractBuildingNumericPart(undefined), null);
  assert.strictEqual(extractBuildingNumericPart('ABC'), null);
});
