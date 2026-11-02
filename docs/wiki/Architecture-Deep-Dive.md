# Architecture Deep Dive

This document details the internal design, database structures, full-text search indexing, data compression strategies, and atomic hot-swap lifecycle powering **open-pl-address**.

---

## 1. In-Process SQLite Engine

Traditional geolocation and address validation architectures rely on microservices communicating over REST or gRPC, or external third-party cloud APIs. While suitable for loose geofencing, this pattern introduces unacceptable bottlenecks in transactional enterprise workloads:
- **Network Overhead**: HTTP handshake, TLS negotiation, and serialization latency add 50–300 ms per address verification.
- **Availability Risk**: Any network partition, DNS glitch, or cloud provider rate-limiting halts payroll runs or checkout funnels.
- **Privacy & Security**: Sending employee addresses (names, home addresses, tax identification numbers) across third-party networks creates GDPR / RODO compliance risks.

### The MaxMind GeoIP Paradigm

Following the proven architecture of **MaxMind GeoIP** (which embeds binary IP geolocation databases directly into host processes), `open-pl-address` bundles an optimized, read-only SQLite database file directly into the application process:

```
┌─────────────────────────────────────────────────────────────┐
│                      Host Application                       │
│  (Node.js / Bun / ASP.NET Core / InsERT Gratyfikant nexo)   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               PolishAddressSDK Facade               │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │ In-process API calls (< 1ms) │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │                 AddressService Engine               │   │
│   │  - FTS5 Prefix Match    - Diacritic Stripping       │   │
│   │  - B-Tree LIKE Fallback - 4-Tier Tax Resolution     │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │ Direct Memory / File Access  │
│   ┌──────────────────────────▼──────────────────────────┐   │
│   │             Embedded SQLite Database Engine         │   │
│   │        (node:sqlite / Microsoft.Data.Sqlite)        │   │
│   │                                                     │   │
│   │  [cities_fts]    [streets_fts]    [tax_office_rules]│   │
│   │  [terc]          [cities]         [streets]         │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Engine Configuration

When initialized, the SQLite connection is configured with high-performance, read-optimized pragmas:
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;    -- 64MB memory page cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;  -- 256MB memory-mapped I/O
```

---

## 2. Complete Relational & Virtual Schema

The database schema (`schema/migrations/001_initial_schema.sql`) models administrative boundaries, streets, address points, and tax rules.

```sql
-- 1. Administrative Division (GUS TERYT TERC)
CREATE TABLE terc (
    teryt_code   TEXT PRIMARY KEY, -- 7 digits: WOJ(2)+POW(2)+GMI(2)+RODZ(1), e.g. '0663011'
    wojewodztwo  TEXT NOT NULL,    -- Uppercase Polish name, e.g. 'LUBELSKIE'
    powiat       TEXT NOT NULL,    -- Powiat name, e.g. 'm. Lublin'
    gmina        TEXT NOT NULL,    -- Gmina name, e.g. 'Lublin'
    rodzaj_gminy TEXT NOT NULL     -- Gmina type: '1'=urban, '2'=rural, '3'=urban-rural, etc.
);

-- 2. Populated Localities (GUS TERYT SIMC)
CREATE TABLE cities (
    simc_id         TEXT PRIMARY KEY, -- 7 digits, e.g. '0954995'
    teryt_code      TEXT NOT NULL REFERENCES terc(teryt_code),
    name            TEXT NOT NULL,    -- Official name with Polish diacritics, e.g. 'Lublin'
    name_normalized TEXT NOT NULL,    -- Lowercase ASCII string, e.g. 'lublin'
    postal_codes    TEXT NOT NULL     -- JSON array of associated PNA strings: '["20-001", ...]'
);
CREATE INDEX idx_cities_norm ON cities(name_normalized);
CREATE INDEX idx_cities_teryt ON cities(teryt_code);

-- 3. Streets (GUS TERYT ULIC + Aggregated GUGiK PRG Numbers)
CREATE TABLE streets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    simc_id         TEXT NOT NULL REFERENCES cities(simc_id),
    ulic_id         TEXT,             -- 5 digits, e.g. '24123' (NULL for villages without streets)
    cecha           TEXT NOT NULL,    -- Street prefix: 'ul.', 'al.', 'pl.', 'os.', etc.
    name            TEXT NOT NULL,    -- Official name, e.g. 'Wieniawska'
    name_normalized TEXT NOT NULL,    -- Lowercase ASCII string, e.g. 'wieniawska'
    buildings_map   TEXT NOT NULL     -- JSON map of postal code to house numbers
);
CREATE INDEX idx_streets_simc ON streets(simc_id);
CREATE INDEX idx_streets_ulic ON streets(ulic_id);
CREATE INDEX idx_streets_norm ON streets(name_normalized);
CREATE INDEX idx_streets_simc_norm ON streets(simc_id, name_normalized);

-- 4. Inverted Postal Code Index
CREATE TABLE postal_code_index (
    postal_code TEXT NOT NULL,        -- 'XX-XXX' format, e.g. '20-071'
    simc_id     TEXT NOT NULL REFERENCES cities(simc_id),
    street_id   INTEGER REFERENCES streets(id),
    PRIMARY KEY (postal_code, simc_id, street_id)
);
CREATE INDEX idx_postal_code ON postal_code_index(postal_code);

-- 5. Full-Text Search (FTS5) Virtual Tables
CREATE VIRTUAL TABLE cities_fts USING fts5(
    simc_id UNINDEXED,
    name_normalized,
    name,
    tokenize = 'unicode61'
);

CREATE VIRTUAL TABLE streets_fts USING fts5(
    street_id UNINDEXED,
    simc_id UNINDEXED,
    name_normalized,
    name,
    tokenize = 'unicode61'
);

-- 6. Tax Offices (Ministerstwo Finansów)
CREATE TABLE tax_offices (
    us_code     TEXT PRIMARY KEY,     -- 4 digits, e.g. '0610'
    name        TEXT NOT NULL,        -- Official name: 'Pierwszy Urząd Skarbowy w Lublinie'
    city        TEXT,                 -- Office city
    street      TEXT,                 -- Office street address
    postal_code TEXT                  -- Office postal code
);

-- 7. Tax Office Territorial Rules
CREATE TABLE tax_office_rules (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    us_code          TEXT NOT NULL REFERENCES tax_offices(us_code),
    teryt_code       TEXT NOT NULL,      -- 7-digit TERC or prefix (e.g. '0663011', '0609')
    simc_id          TEXT,               -- 7-digit SIMC identifier
    ulic_id          TEXT,               -- 5-digit ULIC identifier
    building_parity  TEXT DEFAULT 'ALL', -- 'ALL', 'EVEN', 'ODD'
    building_from    INTEGER,            -- Range lower bound (inclusive)
    building_to      INTEGER,            -- Range upper bound (inclusive)
    priority         INTEGER NOT NULL    -- 1: Street+Range/Parity, 2: Street, 3: City, 4: Gmina
);
CREATE INDEX idx_tax_rules_lookup ON tax_office_rules(teryt_code, simc_id, ulic_id, priority);
CREATE INDEX idx_tax_rules_us ON tax_office_rules(us_code);
CREATE INDEX idx_tax_rules_priority ON tax_office_rules(priority);

-- 8. Metadata and Release CalVer Tracking
CREATE TABLE db_metadata (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 3. FTS5 Virtual Tables & Query Execution

To guarantee instant autocomplete as users type in search boxes or chat bots, `open-pl-address` builds SQLite FTS5 (Full-Text Search 5) virtual tables tokenized with `unicode61`.

### Prefix Search Strategy

When querying `searchCity("warsz")` or `searchStreet(simcId, "lipow")`:
1. The query text is normalized: stripped of Polish diacritics (`ą` -> `a`, `ł` -> `l`), converted to lowercase ASCII, and stripped of punctuation.
2. An FTS5 prefix expression is formulated: `name_normalized : "query"*`.
3. The query executes directly against the FTS5 shadow index:
   ```sql
   SELECT c.simc_id, c.teryt_code, c.name, c.postal_codes,
          t.wojewodztwo, t.powiat, t.gmina
   FROM cities_fts f
   JOIN cities c ON c.simc_id = f.simc_id
   JOIN terc t ON t.teryt_code = c.teryt_code
   WHERE cities_fts MATCH ?
   LIMIT ?;
   ```
4. **B-Tree Fallback**: If the FTS5 query returns fewer rows than the requested limit, the engine executes a secondary indexed B-Tree prefix query:
   ```sql
   SELECT c.simc_id, c.teryt_code, c.name, c.postal_codes,
          t.wojewodztwo, t.powiat, t.gmina
   FROM cities c
   JOIN terc t ON t.teryt_code = c.teryt_code
   WHERE c.name_normalized LIKE ? || '%'
   LIMIT ?;
   ```
   Results are deduplicated in memory. This dual-layer strategy ensures 100% recall even when inputs contain short 2-character prefixes.

---

## 4. Space Optimization: JSON `buildings_map`

Poland has approximately **8.5 million registered physical address points** (house numbers) according to GUGiK PRG.

### Why Relational Rows Fail at Scale
Storing 8.5 million address points as individual relational rows:
```sql
CREATE TABLE address_points (
    id INTEGER PRIMARY KEY,
    street_id INTEGER,
    building_number TEXT,
    postal_code TEXT
);
```
Requires storing 8.5 million row headers, 8.5 million B-Tree index leaves, and millions of string pointers. In SQLite, this results in a database file exceeding **2.4 GB**, making in-process distribution and fast memory mapping impractical.

### The Aggregated JSON Solution
In `open-pl-address`, address points are aggregated per street and postal code inside the `streets.buildings_map` column:
```json
{
  "20-002": ["1", "2", "3", "3A", "5", "5B", "7"],
  "20-071": ["12", "14", "16", "18/20", "22"]
}
```

#### Advantages:
1. **Database Size Reduced to < 150 MB**: Gzip-compressed distribution is only **~38 MB**, easily embeddable into desktop applications, Docker images, and microservices.
2. **Instant In-Memory Lookup**: Checking if building `"12"` exists on a street requires fetching only 1 row by `ulic_id`, parsing the compact JSON map, and performing an O(1) array/set search.
3. **Exact Postal Code Resolution**: The keys of `buildings_map` map directly to the official postal code assigned to that specific house number, eliminating ambiguity on long streets spanning multiple postal codes.

---

## 5. Zero-Downtime Atomic Hot-Swap

Address databases must be updated monthly to capture new building developments, renamed streets, and shifting municipal tax boundaries. However, production servers cannot afford downtime or dropped client requests.

`open-pl-address` implements an **Atomic Hot-Swap Lifecycle**:

```
[Background Polling Timer]
       │
       ▼
1. Fetch remote manifest.json
       │
       ▼
2. Compare remote sha256 with local db_metadata sha256
       │
       ├─► (Checksums Match) ──► No update needed. Sleep until next cycle.
       │
       ▼ (New Version Available)
3. Download pl_addresses.sqlite.gz to staging file:
   <dbPath>.swap.tmp.gz
       │
       ▼
4. Streaming decompression via zlib.createGunzip() to:
   <dbPath>.swap.tmp
       │
       ▼
5. Integrity Check:
   - Calculate SHA256 of decompressed file
   - Compare with manifest.json sha256
   - Throws error if mismatch (corrupt download rejected)
       │
       ▼
6. Health Probe Query:
   - Open temporary SQLite connection to <dbPath>.swap.tmp
   - Execute: SELECT count(*) FROM cities
   - Verify non-empty database structure
   - Close temporary probe connection
       │
       ▼
7. OS Atomic Rename:
   - Node.js / Bun : fs.renameSync('<dbPath>.swap.tmp', '<dbPath>')
   - C# / .NET     : File.Replace(tempPath, targetPath, backupPath)
       │
       ▼
8. Re-initialize Connection Pointer:
   - Close old read-only SQLite handle
   - Re-open connection pointing to updated file
   - Active user queries continue seamlessly
```

### Thread Safety Details

- **POSIX Systems (Linux / macOS)**: `rename(2)` is an atomic kernel operation. Existing file descriptors opened by other threads or processes remain valid and continue reading from unlinked inode blocks until closed. New queries instantly access the new database file.
- **Windows**: The file cannot be overwritten if open handles have exclusive locks. `open-pl-address` opens SQLite databases in `OPEN_READONLY` mode with `PRAGMA query_only = ON;`, allowing `File.Replace` (or staging rename) to complete safely.
- **Node.js Single-Threaded Event Loop**: The pointer swap occurs synchronously during an event loop tick (`this.db = newDatabaseSync(this.dbPath)`), preventing race conditions where incoming requests encounter an undefined database handle.
