import * as readline from 'node:readline';
import * as path from 'node:path';
import { PolishAddressSDK } from '../packages/ts-sdk/src/sdk.ts';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const sdk = new PolishAddressSDK({ dbPath });
  await sdk.initialize();

  const args = process.argv.slice(2);
  if (args.length >= 3) {
    // Quick single-shot query: npm run cli "Люблін" "Венявська" "12" [lokal]
    const [city, street, building, flat] = args;
    console.log(`\n🔍 Швидка валідація адреси: ${city}, ${street} ${building}${flat ? '/' + flat : ''}`);
    const result = sdk.validateAndFormatForExport({
      miejscowosc: city,
      ulica: street,
      nrDomu: building,
      nrLokalu: flat,
    });
    console.log('\nРезультат:');
    console.log(JSON.stringify(result, null, 2));
    sdk.close();
    return;
  }

  // Interactive REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  console.log('\n===============================================================');
  console.log('   🇵🇱 OPEN-PL-ADDRESS: ІНТЕРАКТИВНА ПЕРЕВІРКА АДРЕСИ          ');
  console.log('   (Підтримує польську, українську кирилицю та помилки)        ');
  console.log('===============================================================');

  try {
    while (true) {
      console.log('\nВведіть дані адреси (або Ctrl+C для виходу):');
      const city = await question('1. Місто (напр. Люблін / Lublin / Варшава): ');
      if (!city.trim()) break;

      const street = await question('2. Вулиця (напр. Венявська / Wieniawska / Krak): ');
      const building = await question('3. Номер будинку (напр. 12 або 3 або 4A): ');
      const flat = await question('4. Номер квартири / офісу (опціонально): ');

      console.log('\n⏳ Виконуємо локальну валідацію (< 1 мс)...');
      const start = performance.now();
      const res = sdk.validateAndFormatForExport({
        miejscowosc: city,
        ulica: street,
        nrDomu: building,
        nrLokalu: flat || undefined,
      });
      const elapsed = (performance.now() - start).toFixed(3);

      console.log(`\n⏱️ Час валідації: ${elapsed} мс`);
      console.log(`Статус: ${res.isValid ? '✅ ВАЛІДНА АДРЕСА' : '❌ ЗНАЙДЕНО ПОМИЛКИ'}`);

      if (res.errors.length > 0) {
        console.log('⚠️ Помилки:');
        res.errors.forEach((e) => console.log(`   - ${e}`));
      }
      if (res.suggestions.length > 0) {
        console.log('💡 Підказки / доступні варіанти:');
        res.suggestions.forEach((s) => console.log(`   - ${s}`));
      }
      if (res.normalized) {
        console.log('\n📋 Стандартизований вигляд для ZUS Płatnik / Gratyfikant nexo:');
        console.log(JSON.stringify(res.normalized, null, 2));
      }
      if (res.taxOffice) {
        console.log(`\n🏛️ Urząd Skarbowy (PIT-11): [${res.taxOffice.usCode}] ${res.taxOffice.name}`);
        if (res.taxOffice.city && res.taxOffice.street) {
          console.log(`   Адреса інспекції: ${res.taxOffice.postalCode ?? ''} ${res.taxOffice.city}, ${res.taxOffice.street}`);
        }
      }

      const cont = await question('\nБажаєте перевірити ще одну адресу? (Y/n): ');
      if (cont.toLowerCase().startsWith('n')) break;
    }
  } finally {
    rl.close();
    sdk.close();
    console.log('\nДо побачення!\n');
  }
}

main().catch(console.error);
