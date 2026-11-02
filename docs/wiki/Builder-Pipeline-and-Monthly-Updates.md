# Builder Pipeline & Monthly Updates

This document describes the offline database compiler, streaming parser architecture, release automation, and monthly update lifecycle of **open-pl-address**.

---

## 1. Architectural Mission

The builder subsystem (`builder/`) transforms massive, heterogeneous open government datasets into a single, compact, sub-millisecond SQLite database (<150 MB).

```
┌─────────────────────────────────────────────────────────────┐
│                 Official Government Portals                 │
│                                                             │
│   GUGiK Geoportal       GUS eTeryt          Min. Finance    │
│   (PRG Address Points)  (TERC/SIMC/ULIC)    (CRD Tax XSD)   │
└──────────────┬──────────────────┬─────────────────┬─────────┘
               │                  │                 │
               ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Streaming Extraction & Parser Pipeline         │
│                                                             │
│   1. Recursive archive extractor (nested *.zip, *.csv, *.txt)│
│   2. Streaming CSV parser (delimiter autodetection)         │
│   3. JSON aggregation: {"20-002": ["1", "2", "3A", ...]}   │
│   4. Normalization: Diacritics strip & Cyrillic phonetics   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 SQLite Compilation & Packaging              │
│                                                             │
│   - Relational Tables (terc, cities, streets, tax_offices)  │
│   - FTS5 Virtual Tables (cities_fts, streets_fts)           │
│   - B-Tree Indices                                          │
│   - PRAGMA optimize & VACUUM                                │
│   - Gzip Level 9 Compression -> pl_addresses.sqlite.gz      │
│   - SHA256 Checksums -> manifest.json                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               GitHub Releases & CalVer Cadence              │
│         Monthly on 5th at 03:00 UTC (YYYY.MM.0)             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Automated Monthly Schedule & CalVer

### Schedule: The 5th of Every Month at 03:00 UTC
The GitHub Actions workflow `.github/workflows/update-db.yml` runs on an automated cron trigger:
```yaml
on:
  schedule:
    - cron: '0 3 5 * *'
  workflow_dispatch:
```

#### Why the 5th?
Polish public institutions (GUS and GUGiK) update and publish their official registers during the **1st to 4th calendar days** of each month. Triggering the builder pipeline on the **5th at 03:00 UTC** guarantees that:
- State agencies have concluded their monthly maintenance cycles.
- Address datasets reflect the newest municipal boundary shifts, newly named streets, and new residential building registrations.

### Calendar Versioning (CalVer)
The database uses the `YYYY.MM.0` CalVer format (e.g. `2026.11.0`):
- The version is embedded into the SQLite table `db_metadata (key='version', value='2026.11.0')`.
- It is published in `manifest.json` alongside cryptographic SHA256 hashes.

---

## 3. Official Data Sources

| Registry | Source Agency | Raw Format | Content Description |
| :--- | :--- | :--- | :--- |
| **PRG Punkty Adresowe** | GUGiK Geoportal | ZIP archive (~800MB compressed, >3GB CSV) | ~8.5 million geodetic address points with house numbers, street names, SIMC, and postal codes. |
| **TERC Urzędowy** | GUS eTeryt | XML / CSV | Official administrative division of Poland down to 7-digit gmina codes. |
| **SIMC Urzędowy** | GUS eTeryt | XML / CSV | Locality directory assigning unique 7-digit codes to every city and village. |
| **ULIC Urzędowy** | GUS eTeryt | XML / CSV | Street registry assigning 5-digit codes and prefixes (`ul.`, `al.`, `pl.`). |
| **Kody Urzędów Skarbowych** | Ministerstwo Finansów | XML Schema (`.xsd`) | 4-digit CRD tax office identifiers and territorial regulations. |

---

## 4. Pipeline Execution Stages

### 4.1 Recursive Archive Extraction
When downloading `PRG-punkty_adresowe.zip` from Geoportal, the archive frequently packages 16 voivodeship sub-archives (`PRG_PunktyAdresowe_02.zip` ... `PRG_PunktyAdresowe_32.zip`) inside the parent file.
- The extraction engine unzips iteratively.
- Extracted `.zip` files are processed and unlinked to conserve disk space.
- The parser accepts both `.csv` and `.txt` extensions, automatically inspecting the first 4KB to identify delimiter characters (`;`, `,`, or `\t`).

### 4.2 Streaming Ingestion & JSON Aggregation
Rather than loading millions of rows into RAM or writing individual SQLite rows:
- `PrgStreamParser` reads address points line-by-line via `node:readline`.
- Points are mapped by city (`simcId`) and street (`ulicId`).
- House numbers are grouped by postal code into the `streets.buildings_map` JSON structure:
  ```json
  {
    "20-002": ["1", "2", "3", "3A", "5"],
    "20-071": ["12", "14", "16", "18/20"]
  }
  ```
- This compression technique keeps the entire country's building inventory under **150 MB uncompressed** and **~38 MB gzipped**.

### 4.3 Database Optimization
Before packaging, the compiler runs:
```sql
PRAGMA optimize;
VACUUM;
```
This defragments B-Tree leaves, compacts virtual table indexes, and computes statistics for the SQLite query planner.

### 4.4 Packaging & Manifest Generation
The compiled SQLite file is compressed using gzip at maximum compression (level 9):
```
data/pl_addresses.sqlite       -> data/pl_addresses.sqlite.gz
```
The pipeline computes SHA256 hashes of both uncompressed and compressed files and generates `data/manifest.json`:
```json
{
  "version": "2026.11.0",
  "buildDate": "2026-11-05T03:15:00.000Z",
  "sha256": "3a4f8d...",
  "sha256Compressed": "b2c9e1...",
  "uncompressedSizeBytes": 154140672,
  "compressedSizeBytes": 39845888,
  "counts": {
    "cities": 103254,
    "streets": 284190,
    "taxOffices": 401
  }
}
```

---

## 5. Running the Builder Locally

### 5.1 Fast Seed Build (Development / Testing)
To instantly build a lightweight database using offline seed data (covering Warsaw, Kraków, Łódź, Wrocław, Poznań, Lublin, and Biskupice):

```bash
npm run build:seed
```

Generates:
- `data/pl_addresses.sqlite`
- `data/pl_addresses.sqlite.gz`
- `data/manifest.json`

### 5.2 Full Production Build
To fetch live data from Geoportal and compile all 8.5 million address points:

```bash
npm run build:full
```

*Requirements: Minimum 8 GB available RAM and 15 GB free disk space.*
