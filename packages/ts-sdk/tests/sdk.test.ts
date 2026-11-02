import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import { PolishAddressSDK } from '../src/sdk.ts';

test('PolishAddressSDK - full end-to-end facade lifecycle', async () => {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const sdk = new PolishAddressSDK({ dbPath });
  await sdk.initialize();

  // 1. findByPostalCode
  const pna = sdk.findByPostalCode('20-071');
  assert.ok(pna);
  assert.strictEqual(pna.postalCode, '20-071');

  // 2. searchCity
  const cities = sdk.searchCity('Варшава');
  assert.ok(cities.length > 0);
  assert.strictEqual(cities[0].name, 'Warszawa');

  // 3. searchStreet
  const streets = sdk.searchStreet('0954995', 'Wieniawska');
  assert.ok(streets.length > 0);
  assert.strictEqual(streets[0].name, 'Wieniawska');

  // 4. validateBuilding
  const bld = sdk.validateBuilding('0954995', '24123', '12');
  assert.strictEqual(bld.exists, true);
  assert.strictEqual(bld.postalCode, '20-029');

  // 5. resolveTaxOffice
  const us = sdk.resolveTaxOffice({
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '24123',
    buildingNumber: '12',
  });
  assert.ok(us);
  assert.strictEqual(us.usCode, '0610');
  assert.strictEqual(us.name, 'Pierwszy Urząd Skarbowy w Lublinie');

  // 6. validateAndFormatForExport
  const exp = sdk.validateAndFormatForExport({
    miejscowosc: 'Lublin',
    ulica: 'Wieniawska',
    nrDomu: '12',
    nrLokalu: '2A',
  });
  assert.strictEqual(exp.isValid, true);
  assert.strictEqual(exp.normalized?.kodPocztowy, '20-029');
  assert.strictEqual(exp.normalized?.nrLokalu, '2A');
  assert.strictEqual(exp.taxOffice?.usCode, '0610');
  assert.strictEqual(exp.normalized?.taxOffice?.usCode, '0610');

  sdk.close();
});
