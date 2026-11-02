# `open-pl-address`

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Weekly Database Build](https://github.com/open-pl-address/open-pl-address/actions/workflows/update-db.yml/badge.svg)](https://github.com/open-pl-address/open-pl-address/actions/workflows/update-db.yml)

Universal Polish Address Database & Embedded SDK (TERYT + PRG). Provides sub-millisecond search, autocomplete, and strict address validation (from voivodeships down to house numbers and postal codes) for 100% compliance with Polish state, ERP, and accounting systems (**ZUS Płatnik**, **InsERT Gratyfikant nexo**, and tax registries).

---

## Architecture: Embedded Database SDK (MaxMind GeoIP Model)

Instead of slow, rate-limited, and privacy-invasive external web APIs, `open-pl-address` uses an **in-process embedded architecture**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │  Official Polish State Registries (Open Data)              │
 │  - GUS TERYT (TERC, SIMC, ULIC)                             │
 │  - GUGiK PRG (Państwowy Rejestr Granic - Punkty Adresowe)   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  /builder (Weekly GitHub Actions Automation)                │
 │  - Cleans & aggregates 8.5M+ address points into streets    │
 │  - Strips Polish diacritics & generates Cyrillic phonetics  │
 │  - Compiles optimized SQLite + FTS5 full-text virtual tables│
 │  - Produces: pl_addresses.sqlite.gz & manifest.json         │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (GitHub Releases CDN)
                                ▼
          ┌─────────────────────────────────────────┐
          │  Zero-Config Auto-Sync & Hot-Swap       │
          └────────────┬────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
 ┌──────────────────────┐    ┌──────────────────────┐
 │  packages/ts-sdk     │    │  packages/csharp-sdk │
 │  - Node.js / TS      │    │  - .NET 8 / Std 2.0  │
 │  - Telegram Bots     │    │  - Gratyfikant nexo  │
 │  - Web Apps (Fastify)│    │  - ZUS Płatnik       │
 │  Local query < 1 ms  │    │  Local query < 1 ms  │
 └──────────────────────┘    └──────────────────────┘
```

1. **Central Builder (`/builder`)**:
   Automatically parses GUS and GUGiK registries, aggregates house numbers into a memory-efficient JSON structure on the street level (shrinking 8.5M rows into a single ~100-150 MB file), normalizes diacritics and Cyrillic text, and compiles SQLite with FTS5.
2. **Client SDKs (`ts-sdk` and `csharp-sdk`)**:
   Embedded directly into host applications. On boot, the SDK downloads and decompresses the database locally if missing. Background workers periodically poll `manifest.json`, verify SHA256 hashes, and perform atomic, zero-downtime **Hot-swaps**.

---

## Monorepo Layout

```
open-pl-address/
├── .github/
│   └── workflows/
│       └── update-db.yml         # Weekly automated DB compiler & release publisher
├── builder/                      # Pipeline to download, parse, and compile SQLite
│   ├── src/
│   │   ├── downloaders/          # GUS TERYT & GUGiK PRG fetchers
│   │   ├── parsers/              # Streaming PRG address points parser
│   │   ├── normalizer.ts         # Diacritics stripper & Ukrainian/Russian transliteration
│   │   ├── seed_data.ts          # Authentic TERYT seed data (Lublin, Warszawa, etc.)
│   │   ├── db_builder.ts         # SQLite & FTS5 builder + gzip & manifest generator
│   │   └── index.ts              # CLI (--seed or --full)
├── schema/                       # SQL migrations and schema documentation
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── README.md
├── packages/
│   ├── ts-sdk/                   # TypeScript/Node.js package for bots & web apps
│   │   ├── src/                  # SQLite adapter, AddressService, auto-sync
│   │   ├── tests/                # Comprehensive unit/integration tests
│   │   └── README.md
│   └── csharp-sdk/               # C# class library for Gratyfikant nexo / Płatnik
│       ├── OpenPlAddress.Sdk/    # .NET Standard 2.0 & .NET 8 library
│       ├── OpenPlAddress.Sdk.Tests/ # xUnit tests
│       └── README.md
└── data/                         # Local database & manifest storage
    ├── pl_addresses.sqlite
    ├── pl_addresses.sqlite.gz
    └── manifest.json
```

---

## Database Schema (Optimized)

| Table | Description | Key Identifiers |
| :--- | :--- | :--- |
| `terc` | GUS Administrative Division | `teryt_code` (7 digits: WOJ+POW+GMI+RODZ) |
| `cities` | Populated Places (SIMC) | `simc_id` (7 digits), `name`, `postal_codes` |
| `streets` | Streets (ULIC) + Aggregated Buildings | `ulic_id` (5 digits), `cecha`, `buildings_map` |
| `postal_code_index` | Inverted `XX-XXX` index | `postal_code`, `simcId`, `street_id` |
| `cities_fts` | FTS5 Full-Text Search | Tokenized prefix search on normalized city names |
| `streets_fts` | FTS5 Full-Text Search | Tokenized prefix search on normalized street names |
| `tax_offices` | Official MF Polish Tax Offices | `us_code` (4 digits, e.g. "0610"), `name`, `city`, `street`, `postal_code` |
| `tax_office_rules` | Territorial Jurisdiction Hierarchy | `us_code`, `teryt_code`, `simc_id`, `ulic_id`, `building_parity`, `priority` |

---

## API Comparison: TypeScript & C#

Both SDKs expose identical methods and return standardized models:

| Method | Description | Example Input / Output |
| :--- | :--- | :--- |
| `findByPostalCode(postalCode)` | Find cities, gmina, powiat, voivodeship & streets | `20-071` -> Lublin (ul. Wieniawska) |
| `searchCity(query, limit)` | Instant search with Cyrillic & diacritic tolerance | `Люблін` or `lodz` -> `Lublin`, `Łódź` |
| `searchStreet(simcId, query, pna)` | City-scoped street autocomplete | `wieniaw` -> `ul. Wieniawska` |
| `validateBuilding(simcId, ulicId, nr)` | Validate house existence and fetch exact postal code | `12` -> `exists: true, postalCode: 20-029` |
| `resolveTaxOffice(params)` | Resolve official Urząd Skarbowy (< 1 ms) by specificity hierarchy | `terytCode: 0663011, ulicId: 24123` -> Pierwszy US w Lublinie (`0610`) |
| `validateAndFormatForExport(input)` | Standardized export for Gratyfikant nexo, Płatnik & PIT | Normalizes names, TERC codes, postal codes & resolves Tax Office |

### Export Format for ZUS Płatnik & InsERT Gratyfikant nexo

```json
{
  "isValid": true,
  "errors": [],
  "suggestions": [],
  "normalized": {
    "wojewodztwo": "LUBELSKIE",
    "powiat": "m. Lublin",
    "gmina": "Lublin",
    "terytGminaCode": "0663011",
    "miejscowosc": "Lublin",
    "simcId": "0954995",
    "ulica": "Wieniawska",
    "ulicId": "24123",
    "cechaUlicy": "ul.",
    "nrDomu": "12",
    "nrLokalu": "4",
    "kodPocztowy": "20-029",
    "poczta": "Lublin",
    "taxOffice": {
      "usCode": "0610",
      "name": "Pierwszy Urząd Skarbowy w Lublinie",
      "city": "Lublin",
      "street": "ul. Sądowa 5",
      "postalCode": "20-027"
    }
  },
  "taxOffice": {
    "usCode": "0610",
    "name": "Pierwszy Urząd Skarbowy w Lublinie",
    "city": "Lublin",
    "street": "ul. Sądowa 5",
    "postalCode": "20-027"
  }
}
```

---

## Quickstart

### 1. Build the Database (Seed or Full)

```bash
# Generate seed demo database (Lublin, Warszawa, Kraków, Łódź, Wrocław, Biskupice):
npm run build:seed

# Or download and compile all of Poland (requires ~2GB download & network):
npm run build:full
```

### 2. Run TypeScript Tests

```bash
npm run test:ts
```

### 3. Build & Test C# SDK

```bash
cd packages/csharp-sdk
dotnet test OpenPlAddress.sln
```

---

## License
MIT License. Built for Polish and international developers automating address verification and accounting flows.
