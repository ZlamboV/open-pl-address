# TypeScript / JavaScript SDK Reference

The `open-pl-address` npm package provides an embedded, zero-runtime-dependency client SDK for Node.js (22+) and Bun.

---

## 1. Installation & Runtime Requirements

```bash
npm install open-pl-address
```

### Zero Runtime Production Dependencies
`open-pl-address` is designed with security and minimal attack surface in mind:
- **0 runtime dependencies**: It relies exclusively on built-in Node.js modules: `node:sqlite` (`DatabaseSync`), `node:fs`, `node:path`, `node:crypto`, `node:zlib`, `node:stream`, `node:readline`.
- **Node.js 22.0.0+** or **Bun** is required out of the box.
- For older Node versions (<22), `better-sqlite3` is supported via the optional `databaseAdapter` configuration option.

---

## 2. Configuration Interface (`SDKConfig`)

```typescript
export interface SDKConfig {
  /**
   * Path to the SQLite database file.
   * Default: process.env.OPEN_PL_ADDRESS_DB_PATH or './data/pl_addresses.sqlite'
   */
  dbPath?: string;

  /**
   * Remote release URL for manifest and database updates.
   * Default: 'https://github.com/ZlamboV/open-pl-address/releases/latest/download'
   */
  updateUrl?: string;

  /**
   * Interval in days between automated background update checks.
   * Set to 0 to disable automated background polling.
   * Default: 7
   */
  autoUpdateDays?: number;

  /**
   * Automatically download the database archive if missing upon initialization.
   * Default: true
   */
  autoDownloadOnMissing?: boolean;

  /**
   * Custom SQLite adapter interface (e.g. better-sqlite3 wrapper or mock).
   */
  databaseAdapter?: ISqliteDatabase;
}
```

---

## 3. Public API: `PolishAddressSDK`

The primary entry point is the `PolishAddressSDK` facade class:

```typescript
import { PolishAddressSDK } from 'open-pl-address';
```

### 3.1 `initialize(): Promise<this>`
Asynchronously initializes the SDK:
1. Resolves the database file location (walking up directory trees if needed).
2. Downloads and unpacks `pl_addresses.sqlite.gz` if missing and `autoDownloadOnMissing` is enabled.
3. Attaches the in-process SQLite database connection with read-optimized pragmas.
4. Starts the background update check timer if `autoUpdateDays > 0`.

```typescript
const sdk = new PolishAddressSDK();
await sdk.initialize();
```

---

### 3.2 `findByPostalCode(postalCode: string): PostalCodeSearchResult | null`
Reverse-lookup of all cities and streets served by an official Polish postal code (**PNA**).

- **Parameters**:
  - `postalCode` (`string`): Postal code in `"XX-XXX"` or `"XXXXX"` format.
- **Returns**: `PostalCodeSearchResult | null`
- **Example**:
  ```typescript
  const result = sdk.findByPostalCode('20-029');
  if (result) {
    console.log(`Postal code ${result.postalCode} covers ${result.cities.length} cities`);
    for (const city of result.cities) {
      console.log(`- City: ${city.name} (TERC: ${city.terytCode}), Streets: ${city.streets.length}`);
    }
  }
  ```

---

### 3.3 `searchCity(query: string, limit = 10): CitySearchResult[]`
Searches for Polish cities, towns, and villages. Handles missing diacritics and phonetic Ukrainian/Russian Cyrillic transliteration.

- **Parameters**:
  - `query` (`string`): Search term (e.g. `"Люблін"`, `"warsz"`, `"krakow"`).
  - `limit` (`number`, optional): Maximum results to return (default: `10`).
- **Returns**: `CitySearchResult[]`
- **Example**:
  ```typescript
  const cities = sdk.searchCity('Люблін', 5);
  // Returns:
  // [
  //   {
  //     simcId: "0954995",
  //     terytCode: "0663011",
  //     name: "Lublin",
  //     wojewodztwo: "LUBELSKIE",
  //     powiat: "m. Lublin",
  //     gmina: "Lublin",
  //     postalCodes: ["20-001", "20-002", ...]
  //   }
  // ]
  ```

---

### 3.4 `searchStreet(simcId: string, query: string, postalCode?: string, limit = 15): StreetSearchResult[]`
Autocompletes street names within a specific city SIMC identifier. Automatically strips common street prefixes (`ul.`, `aleja`, `вул.`).

- **Parameters**:
  - `simcId` (`string`): 7-digit SIMC identifier of the city.
  - `query` (`string`): Search term (e.g. `"wieniaw"`, `"Липова"`).
  - `postalCode` (`string`, optional): Filter streets serving this specific postal code.
  - `limit` (`number`, optional): Maximum results (default: `15`).
- **Returns**: `StreetSearchResult[]`
- **Example**:
  ```typescript
  const streets = sdk.searchStreet('0954995', 'wieniaw');
  // Returns:
  // [
  //   {
  //     id: 1042,
  //     simcId: "0954995",
  //     ulicId: "24123",
  //     cecha: "ul.",
  //     name: "Wieniawska",
  //     postalCodes: ["20-071"]
  //   }
  // ]
  ```

---

### 3.5 `validateBuilding(simcId: string, ulicId: string | null, buildingNumber: string): BuildingValidationResult`
Validates whether a specific house/building number officially exists in GUGiK PRG records for the given street or village.

- **Parameters**:
  - `simcId` (`string`): 7-digit SIMC identifier.
  - `ulicId` (`string | null`): 5-digit ULIC identifier, or `null` for villages without streets.
  - `buildingNumber` (`string`): Building identifier (e.g. `"12"`, `"12A"`, `"15/17"`).
- **Returns**: `BuildingValidationResult`
  - `exists` (`boolean`): Whether the building was found in PRG data.
  - `postalCode` (`string | null`): Official postal code assigned to this exact house number.
  - `allPostalCodesForStreet` (`string[]`): All postal codes linked to this street.
  - `availableNumbers` (`string[]`): Registered numbers on this street (useful for suggestions).
- **Example**:
  ```typescript
  const check = sdk.validateBuilding('0954995', '24123', '12');
  console.log(`Building exists: ${check.exists}`);
  console.log(`Exact Postal Code: ${check.postalCode}`);
  ```

---

### 3.6 `resolveTaxOffice(params: ResolveTaxOfficeParams): TaxOffice | null`
Executes the 4-tier waterfall resolution algorithm to determine the competent Polish Tax Office (**Urząd Skarbowy**) according to Ministry of Finance decrees.

- **Parameters** (`ResolveTaxOfficeParams`):
  - `terytCode` (`string`): 7-digit TERC code.
  - `simcId` (`string`): 7-digit SIMC code.
  - `ulicId` (`string`, optional): 5-digit ULIC code.
  - `buildingNumber` (`string`, optional): Building number (e.g. `"12A"`).
- **Returns**: `TaxOffice | null`
  - `usCode` (`string`): 4-digit MF CRD code (e.g. `"0610"`).
  - `name` (`string`): Official office name.
  - `city` (`string`): Office locality.
  - `street` (`string`): Office street address.
  - `postalCode` (`string`): Office postal code.
- **Example**:
  ```typescript
  const office = sdk.resolveTaxOffice({
    terytCode: '0663011',
    simcId: '0954995',
    ulicId: '11181', // ul. Lipowa
    buildingNumber: '8'
  });
  console.log(`Tax Office: ${office?.name} (Code: ${office?.usCode})`);
  ```

---

### 3.7 `validateAndFormatForExport(input: RawAddressInput): ValidationResult`
Comprehensive validator and formatter. Resolves administrative division, street, building number, postal code, and competent tax office into a standardized `NormalizedAddress` ready for ZUS Płatnik and ERP systems.

- **Parameters** (`RawAddressInput`):
  - `miejscowosc` (`string`): City or village name.
  - `simcId` (`string`, optional): Known SIMC code.
  - `ulica` (`string`, optional): Street name (empty for rural villages without streets).
  - `ulicId` (`string`, optional): Known ULIC code.
  - `nrDomu` (`string`): House / building number.
  - `nrLokalu` (`string`, optional): Apartment or suite number.
  - `kodPocztowy` (`string`, optional): Postal code.
  - `allowManualBuilding` (`boolean`, optional): If `true`, permits unlisted house numbers (e.g., brand-new construction) with a warning instead of a validation error.
- **Returns**: `ValidationResult`
  - `isValid` (`boolean`): Whether address satisfies all validation criteria.
  - `errors` (`string[]`): Fatal validation errors preventing legal export.
  - `warnings` (`string[]`): Non-fatal notices (e.g., unverified new building).
  - `normalized` (`NormalizedAddress | null`): Canonical address structure.
  - `taxOffice` (`TaxOffice | null`): Competent tax office.

---

### 3.8 `checkForUpdate(): Promise<boolean>`
Triggers an immediate hot-swap update check against GitHub Releases. If a newer database version is found, downloads, verifies SHA256 checksum, and swaps connections with zero downtime.

- **Returns**: `Promise<boolean>` (`true` if updated, `false` if already on latest version).

---

### 3.9 `close(): void`
Closes the active SQLite connection and cancels any scheduled background polling timers.

---

## 4. Low-Level Database Manager: `AddressDatabaseManager`

For specialized environments (custom connection pools, manual update triggers, or dependency injection containers), `open-pl-address` exposes `AddressDatabaseManager` directly:

```typescript
import { AddressDatabaseManager } from 'open-pl-address';

const manager = new AddressDatabaseManager({
  dbPath: './data/pl_addresses.sqlite',
  autoUpdateDays: 7,
  autoDownloadOnMissing: true
});

const db = await manager.initialize();
```

### Methods:
- **`initialize(): Promise<ISqliteDatabase>`**: Resolves database path, auto-downloads and decompresses `pl_addresses.sqlite.gz` if missing, opens read-optimized connection, and schedules background updates.
- **`getDatabase(): ISqliteDatabase`**: Returns the active in-process SQLite database handle. Throws if not initialized.
- **`checkForUpdate(): Promise<boolean>`**: Fetches `manifest.json` from the release server, compares SHA256 checksums, downloads newer database archives, validates checksum integrity, and invokes `hotSwapDatabase` with zero downtime.
- **`hotSwapDatabase(newDbPath: string): Promise<void>`**: Performs safe atomic hot-swap: verifies schema query against new DB, closes current handle, performs atomic file rename (`fs.renameSync`), and reopens connection transparently.
- **`close(): void`**: Clears background interval timers and closes active database connection.

---

## 5. Text Normalizer & Transliteration Utility: `TextNormalizer`

A pure functional utility module with zero dependencies powering search tolerance across diacritics, Cyrillic alphabets, postal codes, and house numbers:

```typescript
import {
  stripPolishDiacritics,
  transliterateCyrillic,
  normalizeText,
  normalizePostalCode,
  isValidPostalCode,
  normalizeBuildingNumber,
  extractBuildingNumericPart
} from 'open-pl-address';
```

### Exported Functions:
- **`stripPolishDiacritics(text: string): string`**: Converts Polish characters (`ą, ć, ę, ł, ń, ó, ś, ź, ż`) to plain ASCII equivalents (`a, c, e, l, n, o, s, z, z`).
- **`transliterateCyrillic(text: string): string`**: Transliterates Ukrainian and Russian Cyrillic input (e.g., `"Люблін"` -> `"lublin"`, `"Венявська"` -> `"wieniawska"`, `"Варшава"` -> `"warszawa"`) into Polish Latin phonetics, stripping common prefixes (`"вул."`, `"вулиця"`).
- **`normalizeText(text: string): string`**: Comprehensive search string normalizer combining Cyrillic transliteration, diacritic stripping, lowercasing, and whitespace sanitization.
- **`normalizePostalCode(input?: string | null): string | null`**: Standardizes 5-digit postal code strings into canonical `"XX-XXX"` format (e.g. `"20029"` -> `"20-029"`). Returns `null` if invalid.
- **`isValidPostalCode(input?: string | null): boolean`**: Validates whether a string matches the Polish `"^\d{2}-\d{3}$"` pattern.
- **`normalizeBuildingNumber(input?: string | null): string`**: Cleans building numbers by stripping spaces, uppercasing suffixes, and discarding trailing apartment markers (e.g. `" 12 a "` -> `"12A"`, `"14 / 2"` -> `"14"`).
- **`extractBuildingNumericPart(input?: string | null): number | null`**: Extracts integer numeric value for tax office range and parity evaluation (e.g. `"12A"` -> `12`, `"84/92"` -> `84`, `"4A"` -> `4`).

---

## 6. Complete Domain Types Reference

```typescript
export interface ISqliteStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface ISqliteDatabase {
  prepare(sql: string): ISqliteStatement;
  exec(sql: string): void;
  close(): void;
}

export interface SDKConfig {
  dbPath?: string;
  updateUrl?: string;
  autoUpdateDays?: number;
  autoDownloadOnMissing?: boolean;
  databaseAdapter?: ISqliteDatabase;
}

export interface TercInfo {
  terytCode: string; // 7-digit code: WOJ(2)+POW(2)+GMI(2)+RODZ(1)
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  rodzajGminy: string;
}

export interface CitySearchResult {
  simcId: string; // 7-digit SIMC identifier
  terytCode: string; // 7-digit TERC code
  name: string; // Official city name (e.g. "Lublin", "Łódź")
  wojewodztwo: string; // e.g. "LUBELSKIE"
  powiat: string; // e.g. "m. Lublin"
  gmina: string; // e.g. "Lublin"
  postalCodes: string[]; // e.g. ["20-001", "20-002"]
}

export interface StreetSearchResult {
  id: number;
  simcId: string;
  ulicId: string | null; // 5-digit ULIC identifier, null for villages
  cecha: string; // "ul.", "al.", "pl.", "os."
  name: string; // Official street name (e.g. "Wieniawska")
  postalCodes: string[]; // Postal codes serving this street
}

export interface BuildingValidationResult {
  exists: boolean;
  postalCode: string | null; // Exact postal code for this specific building
  allPostalCodesForStreet: string[];
  availableNumbers: string[]; // Sample or available building numbers on this street
}

export interface RawAddressInput {
  kodPocztowy?: string; // Format "XX-XXX" or "XXXXX"
  miejscowosc?: string; // City name (e.g. "Lublin", "Люблін", "Lodz")
  simcId?: string; // Optional known SIMC ID
  ulica?: string; // Street name (e.g. "Wieniawska", "Венявська")
  ulicId?: string; // Optional known ULIC ID
  nrDomu: string; // Building number (e.g. "12", "12A", "55", "84/92")
  nrLokalu?: string; // Apartment / premises number (e.g. "4")
  allowManualBuilding?: boolean;
}

export interface TaxOffice {
  usCode: string; // 4-digit MF code, e.g. "0610"
  name: string; // Official name, e.g. "Pierwszy Urząd Skarbowy w Lublinie"
  city: string | null;
  street: string | null;
  postalCode: string | null;
}

export interface ResolveTaxOfficeParams {
  terytCode: string; // 7-digit TERC code, e.g. "0663011"
  simcId?: string | null; // 7-digit SIMC identifier
  ulicId?: string | null; // 5-digit ULIC identifier
  buildingNumber?: string | null; // e.g. "12", "12A", "15/17"
}

export interface NormalizedAddress {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  terytGminaCode: string; // 7-digit GUS code for ZUS Płatnik
  miejscowosc: string;
  simcId: string; // 7-digit SIMC identifier
  ulica: string | null;
  ulicId: string | null; // 5-digit ULIC identifier
  cechaUlicy: string | null;
  nrDomu: string;
  nrLokalu: string | null;
  kodPocztowy: string; // Format XX-XXX
  poczta: string; // Post office town name
  taxOffice?: TaxOffice | null; // Resolved Urząd Skarbowy for PIT-11 / Gratyfikant
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  suggestions: string[];
  normalized: NormalizedAddress | null;
  taxOffice?: TaxOffice | null; // Resolved Urząd Skarbowy
}

export interface PostalCodeSearchResult {
  postalCode: string;
  cities: {
    simcId: string;
    name: string;
    wojewodztwo: string;
    powiat: string;
    gmina: string;
    terytCode: string;
    streets: {
      id: number;
      ulicId: string | null;
      cecha: string;
      name: string;
    }[];
  }[];
}

export interface DatabaseManifest {
  version: string;
  builtAt: string;
  databaseFile: string;
  compressedFile: string;
  sha256: string;
  sha256Compressed: string;
  uncompressedSizeBytes: number;
  compressedSizeBytes: number;
  counts: {
    terc: number;
    cities: number;
    streets: number;
    postalCodes: number;
    taxOffices?: number;
    taxOfficeRules?: number;
  };
}
```

---

## 7. End-to-End Node.js / Bun Example

```typescript
import { PolishAddressSDK } from 'open-pl-address';

async function main() {
  const sdk = new PolishAddressSDK({
    autoUpdateDays: 7
  });

  try {
    await sdk.initialize();
    console.log('✓ PolishAddressSDK initialized successfully');

    // 1. Search city with Ukrainian input
    const cities = sdk.searchCity('Варшава');
    console.log(`Matched city: ${cities[0].name} (${cities[0].simcId})`);

    // 2. Autocomplete street
    const streets = sdk.searchStreet(cities[0].simcId, 'Marszałkowska');
    console.log(`Street: ${streets[0].cecha} ${streets[0].name} (${streets[0].ulicId})`);

    // 3. Full validation for ERP export
    const validation = sdk.validateAndFormatForExport({
      miejscowosc: 'Warszawa',
      ulica: 'Marszałkowska',
      nrDomu: '12',
      nrLokalu: '12'
    });

    if (validation.isValid && validation.normalized) {
      const norm = validation.normalized;
      console.log('----------------------------------------');
      console.log('Canonical Address:');
      console.log(`${norm.cechaUlicy} ${norm.ulica} ${norm.nrDomu}/${norm.nrLokalu}`);
      console.log(`${norm.kodPocztowy} ${norm.miejscowosc}`);
      console.log(`ZUS 7-Digit TERC: ${norm.terytGminaCode}`);
      console.log(`Urząd Skarbowy:   ${validation.taxOffice?.name} (Code: ${validation.taxOffice?.usCode})`);
      console.log('----------------------------------------');
    }
  } finally {
    sdk.close();
  }
}

main().catch(console.error);
```
