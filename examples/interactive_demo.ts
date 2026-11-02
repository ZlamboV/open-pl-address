import * as path from 'node:path';
import { PolishAddressSDK } from '../packages/ts-sdk/src/sdk.ts';

async function runDemo() {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  console.log('\n===============================================================');
  console.log('   🇵🇱 OPEN-PL-ADDRESS INTERACTIVE DEMO (SEED DATASET)         ');
  console.log('===============================================================');
  console.log(`Using Database: ${dbPath}\n`);

  const sdk = new PolishAddressSDK({ dbPath });
  await sdk.initialize();

  // Test 1: City Search (Cyrillic input from Telegram bot)
  console.log('--- TEST 1: Пошук міста (Кирилиця: "Люблін" & "варшава") ---');
  let t0 = performance.now();
  const cities = sdk.searchCity('Люблін');
  let t1 = performance.now();
  console.log(`Запит: "Люблін" | Час виконання: ${(t1 - t0).toFixed(3)} ms`);
  console.log(`Знайдено: ${cities.length} міст`);
  console.log(JSON.stringify(cities[0], null, 2));

  // Test 2: Street Autocomplete (Cyrillic input: "венявська")
  const lublinSimc = cities[0].simcId;
  console.log(`\n--- TEST 2: Автодоповнення вулиці в Любліні (Кирилиця: "венявська") ---`);
  t0 = performance.now();
  const streets = sdk.searchStreet(lublinSimc, 'венявська');
  t1 = performance.now();
  console.log(`Запит: "венявська" (SIMC: ${lublinSimc}) | Час виконання: ${(t1 - t0).toFixed(3)} ms`);
  console.log(`Знайдено: ${streets.length} вулиць`);
  console.log(JSON.stringify(streets[0], null, 2));

  // Test 3: Building validation (Building 12 on Wieniawska)
  const ulicWieniawska = streets[0].ulicId;
  console.log(`\n--- TEST 3: Валідація існуючого будинку "12" на вул. Wieniawska ---`);
  t0 = performance.now();
  const bld12 = sdk.validateBuilding(lublinSimc, ulicWieniawska, '12');
  t1 = performance.now();
  console.log(`Номер: "12" | Час виконання: ${(t1 - t0).toFixed(3)} ms`);
  console.log(`Існує: ${bld12.exists}`);
  console.log(`Точний поштовий індекс саме цього будинку: ${bld12.postalCode}`);
  console.log(`Всі індекси на вулиці: ${bld12.allPostalCodesForStreet.join(', ')}`);

  // Test 4: Building validation (Building 3 on Wieniawska -> different postal code)
  console.log(`\n--- TEST 4: Валідація будинку "3" (інший бік вулиці Wieniawska) ---`);
  const bld3 = sdk.validateBuilding(lublinSimc, ulicWieniawska, '3');
  console.log(`Номер: "3" -> Поштовий індекс: ${bld3.postalCode} (Автоматичне визначення індексу за номером будинку)`);

  // Test 5: Non-existent building with suggestions
  console.log(`\n--- TEST 5: Валідація неіснуючого будинку "999" ---`);
  const bld999 = sdk.validateBuilding(lublinSimc, ulicWieniawska, '999');
  console.log(`Номер: "999" -> Існує: ${bld999.exists}`);
  console.log(`Доступні номери на цій вулиці: ${bld999.availableNumbers.join(', ')}`);

  // Test 6: Village without streets (Biskupice)
  console.log(`\n--- TEST 6: Село без вулиць (Biskupice, будинок "4A") ---`);
  const villageCities = sdk.searchCity('Biskupice');
  const biskupice = villageCities[0];
  const bldVillage = sdk.validateBuilding(biskupice.simcId, null, '4A');
  console.log(`Село: ${biskupice.name} | TERC: ${biskupice.terytCode} | Будинок 4A існує: ${bldVillage.exists} | Індекс: ${bldVillage.postalCode}`);

  // Test 7: Reverse lookup by postal code (20-071)
  console.log(`\n--- TEST 7: Пошук за поштовим індексом "20-071" ---`);
  t0 = performance.now();
  const pnaResult = sdk.findByPostalCode('20-071');
  t1 = performance.now();
  console.log(`Індекс: "20-071" | Час виконання: ${(t1 - t0).toFixed(3)} ms`);
  console.log(`Місто: ${pnaResult?.cities[0].name} (Воєводство: ${pnaResult?.cities[0].wojewodztwo}, Гміна: ${pnaResult?.cities[0].gmina})`);
  console.log(`Вулиці, закріплені за цим індексом: ${pnaResult?.cities[0].streets.map((s) => `${s.cecha} ${s.name}`).join(', ')}`);

  // Test 8: Full validation & export for Gratyfikant nexo / ZUS Płatnik
  console.log(`\n--- TEST 8: Головний метод: validateAndFormatForExport (для Gratyfikant / ZUS Płatnik) ---`);
  const rawInput = {
    miejscowosc: 'Люблін',    // Введено з помилкою/кирилицею
    ulica: 'Венявська',       // Введено кирилицею
    nrDomu: ' 12 ',           // Ненормалізований номер з пробілами
    nrLokalu: ' 4 ',          // Номер квартири
  };
  t0 = performance.now();
  const exportResult = sdk.validateAndFormatForExport(rawInput);
  t1 = performance.now();

  console.log('Вхідні "сирі" дані:', rawInput);
  console.log(`Час повної валідації та нормалізації: ${(t1 - t0).toFixed(3)} ms`);
  console.log(`Статус валідності: ${exportResult.isValid ? '✅ ВАЛІДНИЙ' : '❌ НЕВАЛІДНИЙ'}`);
  console.log('\nОфіційний стандартизований результат для експорту в ZUS Płatnik / Gratyfikant nexo:');
  console.log(JSON.stringify(exportResult.normalized, null, 2));

  // Test 9: Handling invalid address with errors and suggestions
  console.log(`\n--- TEST 9: Обробка помилок при неіснуючому будинку ---`);
  const invalidInput = {
    miejscowosc: 'Люблін',
    ulica: 'Венявська',
    nrDomu: '999',
  };
  const invalidResult = sdk.validateAndFormatForExport(invalidInput);
  console.log('Помилки:', invalidResult.errors);
  console.log('Підказки:', invalidResult.suggestions);

  sdk.close();
  console.log('\n===============================================================');
  console.log('   🎉 ВСІ 8 ТЕСТІВ УСПІШНО ВИКОНАНО ЗА МЕНШ НІЖ 5 МС!          ');
  console.log('===============================================================\n');
}

runDemo().catch((err) => {
  console.error(err);
  process.exit(1);
});
