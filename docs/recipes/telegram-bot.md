# Recipe 1: Telegram Bot Address Collector with Cyrillic Transliteration (Node.js)

In international recruitment, relocation, and logistics in Poland, foreign candidates (from Ukraine, Belarus, etc.) frequently input their Polish addresses using Cyrillic keyboards or mixed phonetic transliteration (e.g., `"Варшава"`, `"вулиця Липова"`, `"Маршалковська"`).

This recipe demonstrates how to build a production-grade Telegram bot using `open-pl-address` and `telegraf` that guides users through a multi-step address collection flow with sub-millisecond autocomplete, PRG house number validation, and automatic **Urząd Skarbowy (Tax Office)** determination.

---

## 1. Prerequisites & Installation

```bash
npm install telegraf open-pl-address
```

---

## 2. Interactive Telegram Bot Implementation

```typescript
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { PolishAddressSDK, type CitySearchResult, type StreetSearchResult } from 'open-pl-address';

interface AddressSession extends Scenes.SceneSessionData {
  city?: CitySearchResult;
  street?: StreetSearchResult;
  buildingNumber?: string;
  apartment?: string;
}

interface BotContext extends Scenes.SceneContext<AddressSession> {}

// Initialize SDK with embedded database
const sdk = new PolishAddressSDK();
await sdk.initialize();

// Step 1: City Search Wizard Scene
const addressWizard = new Scenes.WizardScene<BotContext>(
  'address-collector-wizard',

  // Step 0: Ask for city
  async (ctx) => {
    await ctx.reply(
      '👋 Привіт! Введіть назву вашого міста в Польщі (можна українською, російською або польською, напр. "Люблін", "Warszawa", "Краков"):'
    );
    return ctx.wizard.next();
  },

  // Step 1: Handle City Query & Display Inline Buttons
  async (ctx) => {
    const text = (ctx.message as any)?.text?.trim();
    if (!text) {
      await ctx.reply('Будь ласка, напишіть назву міста текстом:');
      return;
    }

    // Instant local search with Cyrillic tolerance (< 1 ms)
    const cities = sdk.searchCity(text, 5);

    if (cities.length === 0) {
      await ctx.reply(`❌ Місто "${text}" не знайдено. Спробуйте ще раз:`);
      return;
    }

    const buttons = cities.map((c) =>
      Markup.button.callback(`${c.name} (${c.powiat}, ${c.wojewodztwo})`, `city:${c.simcId}`)
    );

    await ctx.reply('Оберіть ваше місто зі списку:', Markup.inlineKeyboard(buttons, { columns: 1 }));
    return ctx.wizard.next();
  },

  // Step 2: Handle City Selection & Ask for Street
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Будь ласка, натисніть кнопку з вашим містом вище.');
      return;
    }

    const data = (ctx.callbackQuery as any).data as string;
    if (!data.startsWith('city:')) return;

    const simcId = data.replace('city:', '');
    const cities = sdk.searchCity('', 100); // Or retrieve directly
    const selectedCity = cities.find((c) => c.simcId === simcId) || {
      simcId,
      name: 'Обране місто',
      terytCode: '',
      wojewodztwo: '',
      powiat: '',
      gmina: '',
      postalCodes: [],
    };

    ctx.scene.session.city = selectedCity;
    await ctx.answerCbQuery();

    await ctx.reply(
      `✅ Місто: *${selectedCity.name}*\nТепер введіть назву вулиці (напр. "Wieniawska" або "Липова"):`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // Step 3: Handle Street Query & Display Autocomplete
  async (ctx) => {
    const text = (ctx.message as any)?.text?.trim();
    const city = ctx.scene.session.city;
    if (!city || !text) return;

    const streets = sdk.searchStreet(city.simcId, text, undefined, 5);

    if (streets.length === 0) {
      await ctx.reply(`Вулицю не знайдено в м. ${city.name}. Спробуйте ввести частину назви ще раз:`);
      return;
    }

    const buttons = streets.map((s) =>
      Markup.button.callback(`${s.cecha} ${s.name}`, `street:${s.ulicId}`)
    );

    await ctx.reply('Оберіть вулицю:', Markup.inlineKeyboard(buttons, { columns: 1 }));
    return ctx.wizard.next();
  },

  // Step 4: Handle Street Selection & Ask for House Number
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Будь ласка, оберіть вулицю кнопкою:');
      return;
    }

    const data = (ctx.callbackQuery as any).data as string;
    const ulicId = data.replace('street:', '');
    const city = ctx.scene.session.city!;

    const streets = sdk.searchStreet(city.simcId, '', undefined, 100);
    const selectedStreet = streets.find((s) => s.ulicId === ulicId) || {
      id: 0,
      simcId: city.simcId,
      ulicId,
      cecha: 'ul.',
      name: 'Обрана вулиця',
      postalCodes: [],
    };

    ctx.scene.session.street = selectedStreet;
    await ctx.answerCbQuery();

    await ctx.reply(`Введіть номер будинку (та номер квартири через дріб, напр. "12" або "14/4"):`);
    return ctx.wizard.next();
  },

  // Step 5: Validate Building & Finalize Address with Tax Office
  async (ctx) => {
    const text = (ctx.message as any)?.text?.trim();
    if (!text) return;

    const [buildingInput, aptInput] = text.split('/');
    const buildingNumber = buildingInput.trim();
    const apartment = aptInput?.trim();

    const city = ctx.scene.session.city!;
    const street = ctx.scene.session.street!;

    // Validate against PRG house numbers & resolve Tax Office
    const validation = sdk.validateAndFormatForExport({
      miejscowosc: city.name,
      simcId: city.simcId,
      ulica: street.name,
      ulicId: street.ulicId || undefined,
      nrDomu: buildingNumber,
      nrLokalu: apartment,
    });

    if (!validation.isValid) {
      await ctx.reply(
        `⚠️ Помилка: ${validation.errors.join(', ')}\nСпробуйте ввести коректний номер будинку:`
      );
      return;
    }

    const norm = validation.normalized!;
    const us = validation.taxOffice;

    await ctx.reply(
      `🎉 **Адреса успішно верифікована для ZUS та Декларацій!**\n\n` +
      `📍 **Офіційна адреса:**\n` +
      `• Місто: ${norm.miejscowosc} (SIMC: \`${norm.simcId}\`)\n` +
      `• Вулиця: ${norm.cechaUlicy} ${norm.ulica} (ULIC: \`${norm.ulicId}\`)\n` +
      `• Будинок: ${norm.nrDomu}${norm.nrLokalu ? `, кв. ${norm.nrLokalu}` : ''}\n` +
      `• Поштовий індекс: \`${norm.kodPocztowy}\`\n` +
      `• Гміна (ZUS TERC): \`${norm.terytGminaCode}\`\n\n` +
      `🏛️ **Підпорядкований Urząd Skarbowy (PIT-11):**\n` +
      `• Код податкової: \`${us?.usCode}\`\n` +
      `• Назва: *${us?.name}*\n` +
      `• Адреса інспекції: ${us?.street}, ${us?.postalCode} ${us?.city}`,
      { parse_mode: 'Markdown' }
    );

    return ctx.scene.leave();
  }
);

const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN');
const stage = new Scenes.Stage<BotContext>([addressWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.command('start', (ctx) => ctx.scene.enter('address-collector-wizard'));
bot.command('address', (ctx) => ctx.scene.enter('address-collector-wizard'));

bot.launch().then(() => {
  console.log('🤖 Address Collector Telegram Bot is running...');
});
```

---

## 3. Key Benefits in Production
1. **0 Network Latency**: City and street autocomplete queries respond in < 1 ms, preventing bot timeouts during peak traffic.
2. **Ukrainian / Russian Friendly**: Candidates do not need to switch keyboard layouts or guess Polish spellings like `Łódź` or `Kraków`.
3. **Instant HR Ready**: The generated output is immediately compatible with ZUS Płatnik and InsERT Gratyfikant nexo.
