import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { NodeSqliteAdapter } from '../src/db-adapter.ts';
import { AddressService } from '../src/address-service.ts';

const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
const db = new NodeSqliteAdapter(dbPath, { readOnly: true });
const service = new AddressService(db);

test('AddressService.findByPostalCode - valid postal codes', () => {
  const result = service.findByPostalCode('20-071');
  assert.ok(result, 'Result should exist');
  assert.strictEqual(result.postalCode, '20-071');
  assert.ok(result.cities.length > 0, 'Should find cities for 20-071');

  const lublin = result.cities.find((c) => c.name === 'Lublin');
  assert.ok(lublin, 'Should find Lublin');
  assert.strictEqual(lublin.wojewodztwo, 'LUBELSKIE');
  assert.strictEqual(lublin.terytCode, '0663011');
  assert.strictEqual(lublin.simcId, '0954995');

  const wieniawska = lublin.streets.find((s) => s.name === 'Wieniawska');
  assert.ok(wieniawska, 'Should find street Wieniawska for postal code 20-071');
  assert.strictEqual(wieniawska.ulicId, '24123');
});

test('AddressService.findByPostalCode - non-existent and invalid postal codes', () => {
  assert.strictEqual(service.findByPostalCode('99-999'), null);
  assert.strictEqual(service.findByPostalCode('invalid'), null);
});

test('AddressService.searchCity - diacritics and Cyrillic transliteration', () => {
  // Polish diacritics
  const lodz1 = service.searchCity('Łódź');
  assert.ok(lodz1.length > 0);
  assert.strictEqual(lodz1[0].name, 'Łódź');

  // ASCII normalized
  const lodz2 = service.searchCity('lodz');
  assert.ok(lodz2.length > 0);
  assert.strictEqual(lodz2[0].name, 'Łódź');

  // Ukrainian Cyrillic
  const lublinUkr = service.searchCity('Люблін');
  assert.ok(lublinUkr.length > 0);
  assert.strictEqual(lublinUkr[0].name, 'Lublin');
  assert.strictEqual(lublinUkr[0].terytCode, '0663011');

  const warsawUkr = service.searchCity('Варшава');
  assert.ok(warsawUkr.length > 0);
  assert.strictEqual(warsawUkr[0].name, 'Warszawa');
});

test('AddressService.searchStreet - city streets search and filtering', () => {
  const simcLublin = '0954995';

  // Exact name
  const streets1 = service.searchStreet(simcLublin, 'Wieniawska');
  assert.ok(streets1.length > 0);
  assert.strictEqual(streets1[0].name, 'Wieniawska');
  assert.strictEqual(streets1[0].cecha, 'ul.');
  assert.strictEqual(streets1[0].ulicId, '24123');

  // Without diacritics
  const streets2 = service.searchStreet(simcLublin, 'krakowskie');
  assert.ok(streets2.length > 0);
  assert.strictEqual(streets2[0].name, 'Krakowskie Przedmieście');

  // Cyrillic street name for Telegram bot
  const streets3 = service.searchStreet(simcLublin, 'венявська');
  assert.ok(streets3.length > 0);
  assert.strictEqual(streets3[0].name, 'Wieniawska');

  // Filter by postal code
  const streetsFiltered = service.searchStreet(simcLublin, 'Wieniawska', '20-071');
  assert.strictEqual(streetsFiltered.length, 1);
  assert.strictEqual(streetsFiltered[0].name, 'Wieniawska');
});

test('AddressService.validateBuilding - validates building numbers on street and in village', () => {
  const simcLublin = '0954995';
  const ulicWieniawska = '24123';

  // Building 12 is under 20-029
  const res12 = service.validateBuilding(simcLublin, ulicWieniawska, '12');
  assert.strictEqual(res12.exists, true);
  assert.strictEqual(res12.postalCode, '20-029');

  // Building 3 is under 20-071
  const res3 = service.validateBuilding(simcLublin, ulicWieniawska, '3');
  assert.strictEqual(res3.exists, true);
  assert.strictEqual(res3.postalCode, '20-071');

  // Non-existent building 999
  const res999 = service.validateBuilding(simcLublin, ulicWieniawska, '999');
  assert.strictEqual(res999.exists, false);
  assert.strictEqual(res999.postalCode, null);
  assert.ok(res999.availableNumbers.length > 0);

  // Village Biskupice without streets
  const simcBiskupice = '0379114';
  const resVillage = service.validateBuilding(simcBiskupice, null, '4A');
  assert.strictEqual(resVillage.exists, true);
  assert.strictEqual(resVillage.postalCode, '21-020');
});

test('AddressService.validateAndFormatForExport - export format for Gratyfikant nexo and ZUS Płatnik', () => {
  // 1. Full standard address
  const result1 = service.validateAndFormatForExport({
    kodPocztowy: '20-029',
    miejscowosc: 'Lublin',
    ulica: 'Wieniawska',
    nrDomu: '12',
    nrLokalu: '4',
  });

  assert.strictEqual(result1.isValid, true);
  assert.strictEqual(result1.errors.length, 0);
  assert.ok(result1.normalized);
  assert.strictEqual(result1.normalized.wojewodztwo, 'LUBELSKIE');
  assert.strictEqual(result1.normalized.powiat, 'm. Lublin');
  assert.strictEqual(result1.normalized.gmina, 'Lublin');
  assert.strictEqual(result1.normalized.terytGminaCode, '0663011');
  assert.strictEqual(result1.normalized.miejscowosc, 'Lublin');
  assert.strictEqual(result1.normalized.simcId, '0954995');
  assert.strictEqual(result1.normalized.ulica, 'Wieniawska');
  assert.strictEqual(result1.normalized.ulicId, '24123');
  assert.strictEqual(result1.normalized.cechaUlicy, 'ul.');
  assert.strictEqual(result1.normalized.nrDomu, '12');
  assert.strictEqual(result1.normalized.nrLokalu, '4');
  assert.strictEqual(result1.normalized.kodPocztowy, '20-029');
  assert.strictEqual(result1.normalized.poczta, 'Lublin');

  // 2. Cyrillic input from Telegram bot
  const result2 = service.validateAndFormatForExport({
    miejscowosc: 'Люблін',
    ulica: 'Венявська',
    nrDomu: '3',
  });

  assert.strictEqual(result2.isValid, true);
  assert.ok(result2.normalized);
  assert.strictEqual(result2.normalized.miejscowosc, 'Lublin');
  assert.strictEqual(result2.normalized.ulica, 'Wieniawska');
  assert.strictEqual(result2.normalized.kodPocztowy, '20-071');

  // 3. Village without streets
  const result3 = service.validateAndFormatForExport({
    miejscowosc: 'Biskupice',
    nrDomu: '4A',
  });

  assert.strictEqual(result3.isValid, true);
  assert.ok(result3.normalized);
  assert.strictEqual(result3.normalized.miejscowosc, 'Biskupice');
  assert.strictEqual(result3.normalized.ulica, null);
  assert.strictEqual(result3.normalized.ulicId, null);
  assert.strictEqual(result3.normalized.kodPocztowy, '21-020');

  // 4. Invalid building number with suggestions
  const result4 = service.validateAndFormatForExport({
    miejscowosc: 'Lublin',
    ulica: 'Wieniawska',
    nrDomu: '999',
  });

  assert.strictEqual(result4.isValid, false);
  assert.ok(result4.errors.length > 0);
  assert.ok(result4.suggestions.length > 0);
});
