# Database Schema Documentation (`open-pl-address`)

## Overview
The `open-pl-address` SQLite database is designed as an embedded database following the GeoIP/MaxMind model. It consolidates official Polish registers:
- **TERYT TERC** (Administrative Units: Voivodeship, Powiat, Gmina, Type)
- **TERYT SIMC** (Populated Places / Cities / Towns / Villages)
- **TERYT ULIC** (Streets)
- **GUGiK PRG** (Państwowy Rejestr Granic — Address Points & PNA Postal Codes)

## Core Design Principles
1. **Compact Size (<150 MB for all Poland)**:
   Instead of storing 8.5+ million individual building rows, building numbers are aggregated per street and postal code inside a JSON column `buildings_map`:
   ```json
   {
     "20-002": ["1", "2", "3", "3A", "5", "5/7"],
     "20-003": ["10", "12", "14"]
   }
   ```
2. **Sub-millisecond Local Lookups (< 1ms)**:
   Indexed B-Trees on primary identifiers (`teryt_code`, `simc_id`, `postal_code`, `name_normalized`) and composite indices for fast prefix filtering.
3. **Diacritic-Free & Cyrillic-Resilient Search**:
   The `name_normalized` column contains lowercase text stripped of Polish diacritics (`ą->a, ć->c, ę->e, ł->l, ń->n, ó->o, ś->s, ź->z, ż->z`).
   All client queries are normalized and transliterated (e.g., Ukrainian/Russian Cyrillic `Люблін` -> `lublin`, `Венявська` -> `wieniawska`).
4. **FTS5 Virtual Tables**:
   `cities_fts` and `streets_fts` support instant full-text prefix matching (`MATCH 'query*'`).
5. **Government & ERP Compliance**:
   Provides exact identifiers required by:
   - **ZUS Płatnik**: 7-digit TERC code (`WOJ(2)+POW(2)+GMI(2)+RODZ(1)`), 7-digit SIMC identifier, 5-digit ULIC identifier, official names.
   - **InsERT Gratyfikant nexo**: Voivodeship, powiat, gmina, standard prefix (`ul.`, `al.`, `pl.`), building number, apartment, postal code, post office name.

---

## Tables Specification

### 1. `terc`
Administrative division (TERYT TERC).
| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `teryt_code` | `TEXT PRIMARY KEY` | 7-digit identifier (Woj+Pow+Gmi+Rodz) | `0663011` |
| `wojewodztwo` | `TEXT NOT NULL` | Voivodeship name in uppercase | `LUBELSKIE` |
| `powiat` | `TEXT NOT NULL` | Powiat name | `m. Lublin` |
| `gmina` | `TEXT NOT NULL` | Gmina name | `Lublin` |
| `rodzaj_gminy` | `TEXT NOT NULL` | Gmina type (e.g. gmina miejska) | `1` |

### 2. `cities`
Populated places (TERYT SIMC).
| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `simc_id` | `TEXT PRIMARY KEY` | 7-digit SIMC identifier | `0954995` |
| `teryt_code` | `TEXT NOT NULL` | Foreign key to `terc.teryt_code` | `0663011` |
| `name` | `TEXT NOT NULL` | Official city name | `Lublin` |
| `name_normalized` | `TEXT NOT NULL` | Normalized lowercase string | `lublin` |
| `postal_codes` | `TEXT NOT NULL` | JSON array of main postal codes | `["20-001", "20-002"]` |

### 3. `streets`
Streets (TERYT ULIC + PRG aggregated addresses).
| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-increment internal ID | `101` |
| `simc_id` | `TEXT NOT NULL` | Foreign key to `cities.simc_id` | `0954995` |
| `ulic_id` | `TEXT NULL` | 5-digit ULIC identifier (NULL if village without streets) | `24123` |
| `cecha` | `TEXT NOT NULL` | Street designation prefix | `ul.` |
| `name` | `TEXT NOT NULL` | Official street name | `Wieniawska` |
| `name_normalized` | `TEXT NOT NULL` | Normalized lowercase string | `wieniawska` |
| `buildings_map` | `TEXT NOT NULL` | JSON map of postal code to building numbers | `{"20-002":["1","2","3A"]}` |

### 4. `postal_code_index`
Direct inverted index for `XX-XXX` postal codes.
| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `postal_code` | `TEXT NOT NULL` | Standard postal code format (`XX-XXX`) | `20-002` |
| `simc_id` | `TEXT NOT NULL` | Foreign key to `cities.simc_id` | `0954995` |
| `street_id` | `INTEGER NULL` | Optional street ID | `101` |

### 5. `cities_fts` & `streets_fts`
FTS5 virtual tables using `unicode61` tokenizer for instant prefix search:
```sql
SELECT simc_id, name FROM cities_fts WHERE cities_fts MATCH 'lubl*' LIMIT 10;
```

---

### 6. `tax_offices`
Official Polish Tax Offices (Urzędy Skarbowe) according to Ministerstwo Finansów CRD codes.
| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `us_code` | `TEXT PRIMARY KEY` | 4-digit MF CRD code | `0610` |
| `name` | `TEXT NOT NULL` | Official name of the tax office | `Pierwszy Urząd Skarbowy w Lublinie` |
| `city` | `TEXT NULL` | City where office is located | `Lublin` |
| `street` | `TEXT NULL` | Street address of the office | `ul. Sądowa 5` |
| `postal_code` | `TEXT NULL` | Postal code of the office | `20-027` |

### 7. `tax_office_rules`
Territorial jurisdiction rules mapping administrative locations and address ranges to tax offices.
Rules are resolved by priority:
- **Priority 1**: Street + building number range / parity (`EVEN`, `ODD`)
- **Priority 2**: Whole street (`ulic_id`)
- **Priority 3**: City (`simc_id`)
- **Priority 4**: Gmina / Powiat (`teryt_code`)

| Column | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY` | Auto-increment rule ID | `1` |
| `us_code` | `TEXT NOT NULL` | Foreign key to `tax_offices.us_code` | `0610` |
| `teryt_code` | `TEXT NOT NULL` | TERC code (7 digits or prefix) | `0663011` |
| `simc_id` | `TEXT NULL` | 7-digit SIMC identifier | `0954995` |
| `ulic_id` | `TEXT NULL` | 5-digit ULIC identifier | `24123` |
| `building_parity` | `TEXT DEFAULT 'ALL'` | Building parity filter: `'ALL'`, `'EVEN'`, `'ODD'` | `'ODD'` |
| `building_from` | `INTEGER NULL` | Lower bound building number (inclusive) | `1` |
| `building_to` | `INTEGER NULL` | Upper bound building number (inclusive) | `11` |
| `priority` | `INTEGER NOT NULL` | Specificity priority (1: highest, 4: lowest) | `1` |
