# `@open-pl-address/sdk` (TypeScript / Node.js)

High-performance Embedded SQLite SDK for searching, autocompleting, and strictly validating Polish addresses. Fully compliant with **ZUS Płatnik**, **InsERT Gratyfikant nexo**, and Polish tax systems.

## Key Features
- **Embedded Database (<1 ms queries)**: Reads local `.sqlite` database using native SQLite or `better-sqlite3`. Zero network latency during queries.
- **Zero-Config & Auto-Sync**: Automatically downloads the database file on first run and safely checks for monthly updates with atomic Hot-swap in the background.
- **Diacritics & Cyrillic Resilience**: Search `lodz` or `wieniawska` to find `Łódź` and `Wieniawska`. Ukrainian/Russian transliteration allows Telegram bot users to type `Люблін` or `вул. Венявська`.
- **Building Validation**: Confirms house numbers (including letters like `12A`, `84/92`) and maps them directly to exact postal codes.
- **Official TERYT / PRG Compliance**: Exports canonical 7-digit TERC gmina codes, 7-digit SIMC city codes, and 5-digit ULIC street codes.

---

## Installation

```bash
npm install open-pl-address
# Optional (for projects requiring better-sqlite3):
# npm install better-sqlite3
```

---

## Quick Start

```typescript
import { PolishAddressSDK } from 'open-pl-address';

const sdk = new PolishAddressSDK({
  dbPath: './data/pl_addresses.sqlite',
  // Optional remote source for monthly auto-updates:
  // updateUrl: 'https://github.com/your-org/open-pl-address/releases/latest/download'
});

await sdk.initialize();

// 1. Search city by prefix / transliteration
const cities = sdk.searchCity('Люблін');
console.log(cities[0]);
// {
//   simcId: '0954995',
//   terytCode: '0663011',
//   name: 'Lublin',
//   wojewodztwo: 'LUBELSKIE',
//   powiat: 'm. Lublin',
//   gmina: 'Lublin'
// }

// 2. Autocomplete streets in city
const streets = sdk.searchStreet('0954995', 'wieniaw');
console.log(streets[0]);
// {
//   id: 1,
//   simcId: '0954995',
//   ulicId: '24123',
//   cecha: 'ul.',
//   name: 'Wieniawska'
// }

// 3. Validate building number
const bld = sdk.validateBuilding('0954995', '24123', '12');
console.log(bld);
// {
//   exists: true,
//   postalCode: '20-029',
//   availableNumbers: ['2', '4', '6', '8', '10', '12', '14']
// }

// 4. Validate and format for InsERT Gratyfikant nexo / ZUS Płatnik / PIT
const exportAddress = sdk.validateAndFormatForExport({
  miejscowosc: 'Lublin',
  ulica: 'Wieniawska',
  nrDomu: '12',
  nrLokalu: '4'
});
console.log(exportAddress);
// {
//   isValid: true,
//   errors: [],
//   suggestions: [],
//   normalized: {
//     wojewodztwo: 'LUBELSKIE',
//     powiat: 'm. Lublin',
//     gmina: 'Lublin',
//     terytGminaCode: '0663011',
//     miejscowosc: 'Lublin',
//     simcId: '0954995',
//     ulica: 'Wieniawska',
//     ulicId: '24123',
//     cechaUlicy: 'ul.',
//     nrDomu: '12',
//     nrLokalu: '4',
//     kodPocztowy: '20-029',
//     poczta: 'Lublin',
//     taxOffice: {
//       usCode: '0610',
//       name: 'Pierwszy Urząd Skarbowy w Lublinie',
//       city: 'Lublin',
//       street: 'ul. Sądowa 5',
//       postalCode: '20-027'
//     }
//   },
//   taxOffice: {
//     usCode: '0610',
//     name: 'Pierwszy Urząd Skarbowy w Lublinie',
//     city: 'Lublin',
//     street: 'ul. Sądowa 5',
//     postalCode: '20-027'
//   }
// }

// 5. Direct Urząd Skarbowy resolution (< 1 ms by hierarchy)
const taxOffice = sdk.resolveTaxOffice({
  terytCode: '0663011',
  simcId: '0954995',
  ulicId: '11181', // ul. Lipowa
  buildingNumber: '3' // Odd -> Pierwszy US (0610), Even -> Trzeci US (0612)
});
console.log(taxOffice);
// {
//   usCode: '0610',
//   name: 'Pierwszy Urząd Skarbowy w Lublinie',
//   city: 'Lublin',
//   street: 'ul. Sądowa 5',
//   postalCode: '20-027'
// }
```

---

## API Reference

### `new PolishAddressSDK(config?: SDKConfig)`
- `dbPath`: Path to the `.sqlite` file (default: `./data/pl_addresses.sqlite`).
- `updateUrl`: Optional URL hosting `manifest.json` and `pl_addresses.sqlite.gz`.
- `autoUpdateDays`: Interval in days to poll for updates (default: 7).
- `autoDownloadOnMissing`: Automatically download database if missing locally (default: true).

### `findByPostalCode(postalCode: string): PostalCodeSearchResult | null`
Returns voivodeship, powiat, gmina, teryt code, and all populated places and streets served by this postal code.

### `searchCity(query: string, limit = 10): CitySearchResult[]`
Prefix and full-text search with diacritics stripping (`lodz` -> `Łódź`) and Ukrainian/Russian Cyrillic transliteration (`Люблін` -> `Lublin`).

### `searchStreet(simcId: string, query: string, postalCode?: string, limit = 15): StreetSearchResult[]`
Autocomplete streets belonging to a city `simcId`, optionally filtered by `postalCode`.

### `validateBuilding(simcId: string, ulicId: string | null, buildingNumber: string): BuildingValidationResult`
Checks whether the house number exists and returns its exact postal code.

### `validateAndFormatForExport(input: RawAddressInput): ValidationResult`
Main validation pipeline for ERP exports. Normalizes and checks validity against official registries.
