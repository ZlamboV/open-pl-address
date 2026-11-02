# Recipe: Telegram Bot Address Wizard with Cyrillic Transliteration

In recruitment, logistics, and relocation across Poland, foreign candidates and workers (from Ukraine, Belarus, etc.) frequently enter Polish addresses using Cyrillic keyboards or mixed phonetic transliterations (e.g. `"Люблін"`, `"Варшава"`, `"вулиця Липова"`, `"Маршалковська"`).

This recipe demonstrates how to build a production-grade Telegram bot in Node.js using `open-pl-address` and `telegraf`. The bot guides candidates through an interactive multi-step address collection wizard with sub-millisecond autocomplete, PRG house number validation, and automatic **Urząd Skarbowy (Tax Office)** determination.

---

## 1. Prerequisites & Installation

```bash
npm install telegraf open-pl-address
```

Ensure your environment defines `TELEGRAM_BOT_TOKEN`.

---

## 2. Complete Interactive Bot Implementation

```typescript
import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { PolishAddressSDK, type CitySearchResult, type StreetSearchResult } from 'open-pl-address';

// 1. Session state interface
interface AddressSessionData extends Scenes.SceneSessionData {
  foundCities?: CitySearchResult[];
  city?: CitySearchResult;
  street?: StreetSearchResult;
  buildingNumber?: string;
  apartment?: string;
}

interface BotContext extends Scenes.SceneContext<AddressSessionData> {}

// 2. Initialize open-pl-address SDK (< 1 ms in-process lookup)
const sdk = new PolishAddressSDK({
  autoUpdateDays: 7
});
await sdk.initialize();

// 3. Define the Multi-Step Address Wizard Scene
const addressWizard = new Scenes.WizardScene<BotContext>(
  'address-collector-wizard',

  // Step 0: Prompt user for city name
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
      await ctx.reply('Будь ласка, введіть назву міста текстовим повідомленням:');
      return;
    }

    // Instant local search with Cyrillic tolerance (< 1 ms)
    const cities = sdk.searchCity(text, 5);

    if (cities.length === 0) {
      await ctx.reply(`❌ Місто "${text}" не знайдено. Спробуйте уточнити назву ще раз:`);
      return;
    }

    // Save search results in session for button selection in Step 2
    ctx.scene.session.foundCities = cities;

    const buttons = cities.map((c) =>
      Markup.button.callback(`${c.name} (${c.powiat}, ${c.wojewodztwo})`, `city:${c.simcId}`)
    );

    await ctx.reply('Оберіть ваше місто зі списку:', Markup.inlineKeyboard(buttons, { columns: 1 }));
    return ctx.wizard.next();
  },

  // Step 2: Handle City Selection Callback & Prompt for Street
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Будь ласка, натисніть кнопку з вашим містом у списку вище.');
      return;
    }

    const data = (ctx.callbackQuery as any).data as string;
    if (!data.startsWith('city:')) return;

    const simcId = data.replace('city:', '');
    const foundCities = ctx.scene.session.foundCities || [];
    const selectedCity = foundCities.find((c) => c.simcId === simcId);

    if (!selectedCity) {
      await ctx.reply('Не вдалося знайти обране місто. Будь ласка, почніть введення знову:');
      return ctx.wizard.selectStep(0);
    }

    ctx.scene.session.city = selectedCity;
    await ctx.answerCbQuery();

    await ctx.reply(
      `✅ Місто: *${selectedCity.name}*\nТепер введіть назву вулиці (напр. "Wieniawska" або "Липова"):`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // Step 3: Handle Street Query & Display Autocomplete Buttons
  async (ctx) => {
    const text = (ctx.message as any)?.text?.trim();
    const city = ctx.scene.session.city;
    if (!city || !text) return;

    // Autocomplete street names in city with Cyrillic phonetic support
    const streets = sdk.searchStreet(city.simcId, text, undefined, 5);

    if (streets.length === 0) {
      await ctx.reply(`Вулицю не знайдено в м. ${city.name}. Спробуйте ввести іншу частину назви:`);
      return;
    }

    const buttons = streets.map((s) =>
      Markup.button.callback(`${s.cecha} ${s.name}`, `street:${s.ulicId}`)
    );

    await ctx.reply('Оберіть вулицю зі списку:', Markup.inlineKeyboard(buttons, { columns: 1 }));
    return ctx.wizard.next();
  },

  // Step 4: Handle Street Selection & Prompt for Building / Apartment
  async (ctx) => {
    if (!ctx.callbackQuery) {
      await ctx.reply('Будь ласка, оберіть вулицю за допомогою кнопки:');
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

    await ctx.reply('Введіть номер будинку (та номер квартири через дріб, напр. "12" або "14/4"):');
    return ctx.wizard.next();
  },

  // Step 5: Validate Building & Finalize Address with Urząd Skarbowy
  async (ctx) => {
    const text = (ctx.message as any)?.text?.trim();
    if (!text) return;

    const [buildingInput, aptInput] = text.split('/');
    const buildingNumber = buildingInput.trim();
    const apartment = aptInput ? aptInput.trim() : undefined;

    const city = ctx.scene.session.city!;
    const street = ctx.scene.session.street!;

    // Complete validation against official PRG building points & tax resolution
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
        `⚠️ Помилка: ${validation.errors.join(', ')}\nПеревірте номер будинку та введіть ще раз:`
      );
      return;
    }

    const norm = validation.normalized!;
    const us = validation.taxOffice;

    await ctx.reply(
      `🎉 **Адреса успішно верифікована для ZUS та Декларацій!**\n\n` +
      `📍 **Офіційна адреса в Польщі:**\n` +
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

// 4. Setup Bot & Middleware
const bot = new Telegraf<BotContext>(process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN');
const stage = new Scenes.Stage<BotContext>([addressWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.command('start', (ctx) => ctx.scene.enter('address-collector-wizard'));
bot.command('address', (ctx) => ctx.scene.enter('address-collector-wizard'));

// 5. Launch Bot
bot.launch().then(() => {
  console.log('🤖 Polish Address Collector Bot is active and listening...');
});

// Enable graceful shutdown
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  sdk.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  sdk.close();
});
```

---

## 3. Production Advantages

1. **Zero Network Latency**: Because the entire Polish address database runs in-process via SQLite, search queries finish in **< 1 ms**, preventing Telegram bot timeouts during peak registration spikes.
2. **Keyboard Agnostic**: Candidates do not need to install Polish keyboard layouts or look up how to type `ł`, `ą`, `ę`, `ć`, `ż`, or `ź`.
3. **Official HR Compatibility**: The final output includes exact 7-digit TERC and 4-digit MF CRD codes, ready to be piped directly into ZUS Płatnik or InsERT Gratyfikant nexo.
