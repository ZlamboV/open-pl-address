# open-pl-address — Master AI Agent Context & Architectural Anchor

> **Single Source of Truth** for AI coding agents (Cursor, Claude, Copilot, Antigravity, OpenAI Codex) interacting with `open-pl-address`.

---

## 1. Project Mission & Identity

`open-pl-address` is an open-source, offline, embedded database and multi-language SDK suite providing universal verification, autocomplete, diacritics/Cyrillic transliteration, and official **Urząd Skarbowy (Tax Office)** territorial jurisdiction determination for Polish addresses.

Designed specifically for Polish ERP, HR, payroll, accounting, and reporting systems:
- **ZUS Płatnik** (KEDU XML declarations, compulsory 7-digit TERC gmina codes).
- **InsERT Gratyfikant nexo & Subiekt nexo** (Sfera API address card integration).
- **Ministry of Finance Tax Returns** (PIT-11, PIT-4R, PIT-37, CIT-8).
- **Telegram & Messaging Bots** (fault-tolerant address entry in Polish, Ukrainian, and Russian).

Repository: `https://github.com/ZlamboV/open-pl-address`  
NPM Packages: `open-pl-address@1.0.0` (Client SDK), `open-pl-address-mcp@1.0.0` (MCP Server)  
NuGet Package: `OpenPlAddress.Sdk@1.0.0` (.NET Client SDK)

---

## 2. Monorepo File Map

```
open-pl-address/
├── .cursorrules                       # Cursor IDE rules & behavior config
├── CLAUDE.md                          # Claude Code CLI & Desktop instruction anchor
├── AGENTS.md                          # Master context anchor (this file)
├── .github/
│   ├── copilot-instructions.md        # GitHub Copilot coding instructions
│   └── workflows/
│       ├── ci.yml                     # TypeScript & C# CI test runner
│       ├── publish-npm.yml            # Automatic NPM publisher for SDK & MCP
│       ├── publish-nuget.yml          # Automatic NuGet publisher for .NET SDK
│       └── update-db.yml              # Monthly automated DB builder (5th of month 03:00 UTC)
├── builder/                           # Offline database compiler
│   ├── src/
│   │   ├── index.ts                   # CLI entry point (--seed vs --full)
│   │   ├── db_builder.ts              # SQLite creation, bulk indexing, FTS5 compilation
│   │   ├── downloaders/
│   │   │   └── prg_teryt_fetcher.ts   # Live downloader for GUS TERYT & GUGiK PRG
│   │   ├── parsers/
│   │   │   ├── prg_stream.ts          # High-performance streaming parser for 8.5M+ points
│   │   │   └── tax_office_parser.ts   # Ministry of Finance CRD XSD parser
│   │   ├── normalizer.ts              # Diacritic removal & phonetic Cyrillic mapper
│   │   └── seed_data.ts               # Offline fallback seed dataset (major Polish cities)
│   ├── package.json                   # Builder dependencies (better-sqlite3 for build-time)
│   └── tsconfig.json
├── packages/
│   ├── ts-sdk/                        # TypeScript / Node.js Embedded Client SDK
│   │   ├── src/
│   │   │   ├── index.ts               # Public exports
│   │   │   ├── sdk.ts                 # PolishAddressSDK main facade
│   │   │   ├── address-service.ts     # In-process search, autocomplete, tax resolution
│   │   │   ├── db-manager.ts          # SQLite lifecycle, auto-download, atomic hot-swap
│   │   │   ├── db-adapter.ts          # Unified adapter for node:sqlite & better-sqlite3
│   │   │   ├── normalizer.ts          # Text normalizer & phonetic transliteration
│   │   │   └── types.ts               # Strict TypeScript interfaces & DTOs
│   │   ├── tests/                     # Node.js built-in test suite
│   │   ├── package.json               # Zero runtime dependencies!
│   │   └── tsconfig.json              # Strict ESM NodeNext configuration
│   ├── csharp-sdk/                    # .NET Embedded Client SDK
│   │   ├── OpenPlAddress.Sdk/
│   │   │   ├── IPolishAddressSdk.cs   # Public interface
│   │   │   ├── PolishAddressSdk.cs    # Facade implementation
│   │   │   ├── Models/                # Strongly-typed models (RawAddressInput, TaxOffice, etc.)
│   │   │   ├── Storage/
│   │   │   │   ├── DatabaseManager.cs # Async SQLite lifecycle & atomic hot-swap
│   │   │   │   └── SqliteAddressRepository.cs # Parameterized Microsoft.Data.Sqlite repository
│   │   │   ├── Utils/                 # Diacritics & Cyrillic phonetic transliteration
│   │   │   └── OpenPlAddress.Sdk.csproj # Dual-target: netstandard2.0 & net8.0
│   │   ├── OpenPlAddress.Sdk.Tests/   # xUnit unit test project
│   │   └── OpenPlAddress.sln          # Visual Studio / dotnet solution
│   └── mcp-server/                    # Model Context Protocol stdio server
│       ├── src/
│       │   ├── index.ts               # Executable binary entry point
│       │   ├── server.ts              # JSON-RPC 2.0 stdio server implementation
│       │   └── tools.ts               # 5 Polish address tools definitions & handlers
│       ├── tests/                     # MCP protocol & tool unit tests
│       ├── package.json               # Binary: open-pl-address-mcp
│       └── tsconfig.json
├── schema/                            # Database definitions & migrations
│   ├── README.md                      # Comprehensive schema documentation
│   └── migrations/
│       └── 001_initial_schema.sql     # DDL for SQLite tables, FTS5, and indices
├── docs/                              # Project documentation
│   ├── recipes/                       # Real-world integration recipes (Telegram, Sfera, ZUS)
│   └── wiki/                          # 12-page comprehensive GitHub Wiki knowledge base
├── data/                              # Local database distribution files
│   ├── pl_addresses.sqlite            # Raw SQLite database
│   ├── pl_addresses.sqlite.gz         # Gzip-compressed distribution archive
│   └── manifest.json                  # Release metadata (version, SHA256, record counts)
└── examples/                          # Interactive demos & CLI utility
    ├── cli.ts                         # Terminal REPL address tester
    └── interactive_demo.ts            # Full feature showcase
```

---

## 3. MaxMind GeoIP Architectural Paradigm

`open-pl-address` replaces fragile, expensive, high-latency external web APIs (Google Maps Geocoding API at $5/1,000 queries; GUS SOAP API at 300–900 ms latency) with an **In-Process Embedded SQLite Architecture**:

1. **Sub-Millisecond Query Latency (< 1 ms)**: All queries run in-memory or against local filesystem B-Trees. No HTTP roundtrips, TLS negotiations, or DNS lookups.
2. **Zero Network Lag & 100% Offline / Air-Gapped**: Host applications operate without internet access. Sensitive employee addresses (payroll, HR, PIT) never leave the host perimeter.
3. **FTS5 Virtual Tables**: SQLite's native `unicode61` full-text search index (`cities_fts`, `streets_fts`) provides prefix matching and autocomplete (`MATCH 'query*'`).
4. **Compact Storage (< 150 MB for Poland)**: Instead of 8.5M+ separate rows, house numbers are aggregated per street into a JSON column `buildings_map`:
   ```json
   {
     "20-002": ["1", "2", "3", "3A", "5", "5/7"],
     "20-003": ["10", "12", "14"]
   }
   ```
5. **Zero Heavy External Dependencies**: The client TypeScript SDK has **0 runtime dependencies**, relying solely on Node.js 22+ built-in `node:sqlite`.

---

## 4. Polish State Registries & Identifiers Specification

Every AI agent must adhere strictly to official Polish administrative standards:

| Identifier | Name & Authority | Length & Structure | Example | System Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **TERC** | Krajowy Rejestr Urzędowy Podziału Terytorialnego Kraju (GUS TERYT) | **7 digits**: `WOJ`(2) + `POW`(2) + `GMI`(2) + `RODZ`(1) | `0663011` (m. Lublin) | **Mandatory** for ZUS Płatnik (`terytGminaCode`) |
| **SIMC** | System Identyfikatorów i Nazw Miejscowości (GUS TERYT) | **7 digits**: Unique numeric locality code | `0954995` (Lublin) | Identifies cities and villages without streets |
| **ULIC** | Rejestr Ulic (GUS TERYT) | **5 digits**: Unique street code within gmina | `24123` (ul. Wieniawska) | Nullable for villages without streets |
| **MF US Code** | Centralny Rejestr Danych (Ministerstwo Finansów) | **4 digits**: Numerical tax office code | `0610` (Pierwszy US w Lublinie) | **Mandatory** for PIT-11, PIT-4R, PIT-37 |
| **PNA** | Pocztowy Numer Adresowy (Poczta Polska) | **6 characters**: `XX-XXX` format | `20-071` | Validated via `postal_code_index` |
| **PRG** | Państwowy Rejestr Granic (GUGiK) | 8.5M+ official geolocated address points | Building number (e.g. `12A`, `15/17`) | Validates building existence |

### Villages Without Streets (Miejscowości bezulicowe)
In rural Poland, houses have no street name. In these cases:
- `ulica` MUST be `null` or empty string.
- `miejscowosc` contains the village name.
- Building numbers (e.g. `Biskupice 4A`) are indexed directly under the city's SIMC.

---

## 5. Tax Office (Urząd Skarbowy) 4-Level Resolution Hierarchy

### Legal Rule: Zameldowanie vs. Miejsce Zamieszkania
> [!CRUCIAL]
> **`Adres zameldowania` (registered address) DOES NOT dictate tax jurisdiction.**
> Under the Polish Tax Ordinance (*Ordynacja podatkowa*) and Personal Income Tax Act (*Ustawa o PIT*), tax residence is strictly determined by **`miejsce zamieszkania`** (actual place of residence on December 31 of the tax year). PIT-11 declarations generated by HR/payroll systems must point to the Urząd Skarbowy of actual residence.

### Multi-District City Waterfall Algorithm
In multi-district Polish cities (Warszawa, Poznań, Kraków, Wrocław, Łódź, Lublin), jurisdiction is divided across multiple Tax Offices. The SDK resolves jurisdiction in `< 1 ms` using a strict **4-tier waterfall**:

1. **Priority 1 (Street + Building Range / Parity)**:
   - Evaluates street `ulic_id` + building number integer value against ranges (`building_from` to `building_to`) and parity (`EVEN`, `ODD`, `ALL`).
   - Example: In Poznań, ul. Głogowska even numbers belong to US Poznań-Grunwald, while odd numbers belong to US Poznań-Zachód.
2. **Priority 2 (Whole Street Name)**:
   - Street `ulic_id` entirely assigned to one tax office within the city.
3. **Priority 3 (City Level — SIMC)**:
   - City `simc_id` assigned to a single tax office.
4. **Priority 4 (Gmina / Powiat Level — TERC)**:
   - Fallback based on 7-digit TERC code or powiat prefix (first 4 digits).

---

## 6. Database CalVer & Automated Release Pipeline

1. **Calendar Versioning (CalVer)**:
   - Format: `YYYY.MM.0` (e.g., `2026.11.0`).
   - Defined in `data/manifest.json` and stamped into SQLite table `db_metadata`.
2. **Release Schedule**:
   - Automated via GitHub Actions: `.github/workflows/update-db.yml`.
   - Cron trigger: `0 3 5 * *` (Runs on the **5th of every month at 03:00 UTC**).
   - Rationale: Polish state agencies (GUS and GUGiK) refresh their open data registers during the 1st to 4th days of each month. Compiling on the 5th guarantees fresh data.
3. **Distribution Artifacts**:
   - Published directly to GitHub Releases (`https://github.com/ZlamboV/open-pl-address/releases/latest/download`):
     - `pl_addresses.sqlite.gz`: Gzip-compressed binary database.
     - `manifest.json`: Checksums (`sha256`, `sha256Compressed`), size, version, and record counts.

---

## 7. Client SDK Automatic SQLite Hot-Swap

Applications cannot be restarted in production just to update address databases. Both the TypeScript and C# SDKs feature zero-downtime atomic hot-swapping:

```
[Background Timer]
       │
       ▼
1. Fetch remote manifest.json
       │
       ▼
2. Compare remote sha256 with local file sha256
       │
  (New version?) ── No ──► [Wait for next cycle]
       │ Yes
       ▼
3. Download pl_addresses.sqlite.gz to temporary file (.swap.tmp.gz)
       │
       ▼
4. Decompress stream to .swap.tmp
       │
       ▼
5. Verify SHA256 checksum & test connection: SELECT count(*) FROM cities
       │
       ▼
6. Atomic OS Swap:
   - Node.js: fs.renameSync('.swap.tmp', dbPath)
   - C#: File.Move with safe handle replacement
       │
       ▼
7. Re-initialize active connection pointer (Zero dropped requests)
```

---

## 8. Strict Coding Standards & Conventions

### Zero Runtime Dependencies (TypeScript Client SDK)
- `packages/ts-sdk` MUST maintain **0 runtime dependencies**.
- Rely strictly on Node.js 22 built-ins: `node:sqlite`, `node:fs`, `node:path`, `node:crypto`, `node:zlib`, `node:stream`, `node:readline`.
- Do not add `axios`, `sqlite3`, `lodash`, or external HTTP/DB clients.

### TypeScript Standards
- `"strict": true` everywhere.
- Modern ESM (`"type": "module"`, `"moduleResolution": "NodeNext"`).
- Zero `any` policy (except raw C-bindings inside low-level SQLite driver bridges).
- Interfaces over abstract classes; immutable return types for queries.

### C# / .NET Standards
- Dual targeting: `netstandard2.0` (for InsERT Sfera Gratyfikant nexo .NET Framework 4.7.2+) and `net8.0`.
- All SQL queries parameterized to eliminate injection risks.
- Thread-safe storage repository using `Microsoft.Data.Sqlite`.

### SOLID Architecture
- **S**ingle Responsibility: Separate parsing, database management, text normalization, and business facades.
- **O**pen/Closed: Extensible adapters (`ISqliteDatabase`, `IDatabaseAdapter`).
- **L**iskov Substitution: Adapters swap transparently (`node:sqlite` vs `better-sqlite3`).
- **I**nterface Segregation: Distinct interfaces for search, validation, and export formatting.
- **D**ependency Inversion: High-level SDK depends on abstractions, not raw file handles.

### Git Commits & Integrity
- All commits MUST follow Conventional Commits syntax:
  `<type>(<scope>): <description> [AI-Assisted]`
- Permitted types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.
- Example: `feat(sdk): add phonetically tolerant street lookup [AI-Assisted]`
