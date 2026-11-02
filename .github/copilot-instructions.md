# GitHub Copilot Instructions for `open-pl-address`

## Project Identity & Architecture
`open-pl-address` is an open-source monorepo implementing an Embedded Database SDK (similar to MaxMind GeoIP) for Polish address validation, auto-complete, Cyrillic transliteration, and automatic **Urząd Skarbowy (Tax Office)** determination.

### Core Stack
- **Database**: SQLite with FTS5 virtual tables (`cities_fts`, `streets_fts`). In-process queries execute in < 1 ms without network requests.
- **Node.js / TypeScript (`packages/ts-sdk`)**: Zero-dependency embedded SDK using Node.js built-in `node:sqlite` (`DatabaseSync`). Modern ESM with type safety and Hot-swap zero-downtime updates.
- **.NET / C# (`packages/csharp-sdk`)**: .NET Standard 2.0 & .NET 8 class library via `Microsoft.Data.Sqlite`, designed for InsERT Gratyfikant nexo Sfera and ZUS Płatnik ERP systems.
- **MCP Server (`packages/mcp-server`)**: Model Context Protocol stdio server allowing Cursor, Claude, Antigravity, and Copilot to validate Polish addresses and resolve tax offices.

---

## Coding Guidelines

### 1. Address Domain Rules
- **7-digit TERC**: Województwo (2) + Powiat (2) + Gmina (2) + Rodzaj (1). Example: `0663011` for Lublin.
- **7-digit SIMC**: City/locality identifier. Example: `0954995` for Lublin.
- **5-digit ULIC**: Street identifier. Example: `24123` for ul. Wieniawska.
- **Tax Office CRD**: 4-digit code issued by Polish Ministry of Finance. Example: `0610` for Pierwszy US w Lublinie.
- **Building Numbers**: Numbers can be alphanumeric (e.g. `12A`, `15/17`). Numeric sorting and parity checks must extract the leading integer part (`extractBuildingNumericPart`).

### 2. Legal Precedence (Crucial for Accounting & Payroll)
- Do not mistake `zameldowanie` (administrative registration) for `miejsce zamieszkania` (tax residence). Polish PIT-11 and PIT-4R declarations require the actual place of residence as of December 31.
- In multi-tax office cities, resolve tax offices using the strict 4-priority waterfall:
  1. Street + building range / parity.
  2. Whole street name in city.
  3. City SIMC code.
  4. Gmina TERC code.

### 3. TypeScript / Node.js
- Keep runtime dependencies to 0. Rely on `node:sqlite`, `node:fs`, `node:crypto`, `node:zlib`, `node:readline`.
- Follow strict typing: avoid `any` unless absolutely interfacing with raw C-bindings in SQLite statements.
- Unit tests use the built-in Node.js test runner: `node --experimental-strip-types --test tests/**/*.test.ts`.

### 4. C# / .NET
- Maintain compatibility with both `.NET Standard 2.0` (for legacy .NET Framework 4.7.2+ Sfera Gratyfikant nexo integrations) and `.NET 8`.
- Use `Microsoft.Data.Sqlite` with parameterized queries.
- Ensure thread safety during database hot-swaps using read-write locks or reader reference counting.

### 5. MCP Protocol
- MCP stdio communication uses `stdout` strictly for JSON-RPC 2.0 messages.
- Any logging or debug output MUST be directed to `stderr` (`console.error`).
