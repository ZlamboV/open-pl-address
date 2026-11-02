# GitHub Copilot Instructions for `open-pl-address`

Guidelines for GitHub Copilot Chat and inline code generation across the `open-pl-address` monorepo.

> **Master Architecture Reference**: See `/AGENTS.md` for complete database schemas, identifier specifications, and architectural invariants.

---

## 1. Project Identity & Architecture

`open-pl-address` is an open-source embedded database SDK suite (similar to MaxMind GeoIP) for Polish address validation, auto-complete, Cyrillic transliteration, and automatic **Urząd Skarbowy (Tax Office)** determination.

### Core Stack
- **Database**: SQLite with FTS5 virtual tables (`cities_fts`, `streets_fts`). In-process queries execute in < 1 ms without network calls.
- **Node.js / TypeScript (`packages/ts-sdk`)**: Zero-dependency embedded SDK using Node.js 22 built-in `node:sqlite` (`DatabaseSync`). Modern ESM with type safety and atomic zero-downtime hot-swap.
- **.NET / C# (`packages/csharp-sdk`)**: .NET Standard 2.0 & .NET 8 class library via `Microsoft.Data.Sqlite`, designed for InsERT Gratyfikant nexo Sfera and ZUS Płatnik ERP systems.
- **MCP Server (`packages/mcp-server`)**: Model Context Protocol stdio server providing 5 tools (`search_polish_city`, `autocomplete_polish_street`, `validate_polish_address`, `resolve_urzad_skarbowy`, `find_by_postal_code`).
- **Database CalVer**: `YYYY.MM.0`, released on the 5th of each month at 03:00 UTC via GitHub Actions.

---

## 2. Domain & Legal Invariants

1. **State Identifiers**:
   - `TERC`: 7-digit administrative gmina code (`0663011`). Mandatory for ZUS Płatnik.
   - `SIMC`: 7-digit locality/city identifier (`0954995`).
   - `ULIC`: 5-digit street identifier (`24123`).
   - `MF US Code`: 4-digit Ministry of Finance Tax Office code (`0610`).
   - `Building Numbers`: Alphanumeric (`12A`, `15/17`). Numeric parsing uses `extractBuildingNumericPart`.
2. **Tax Law Invariant (Zameldowanie vs. Miejsce Zamieszkania)**:
   - `zameldowanie` (administrative registration) does NOT determine tax residency.
   - PIT-11, PIT-4R, and PIT-37 declarations require `miejsce zamieszkania` (actual residence on Dec 31).
3. **4-Tier Tax Office Waterfall**:
   - Priority 1: Street + building range / parity (`EVEN`, `ODD`).
   - Priority 2: Whole street within city.
   - Priority 3: City SIMC code.
   - Priority 4: Gmina TERC code.

---

## 3. Language & Coding Guidelines

### TypeScript / Node.js
- Keep runtime dependencies strictly at 0 in `packages/ts-sdk`. Rely on `node:sqlite`, `node:fs`, `node:crypto`, `node:zlib`, `node:readline`.
- Follow strict typing: avoid `any` unless absolutely interfacing with raw C-bindings in SQLite statements.
- Unit tests run with Node.js built-in runner: `npm test`.

### C# / .NET
- Maintain dual compatibility: `.NET Standard 2.0` (for legacy .NET Framework 4.7.2+ Sfera Gratyfikant nexo integrations) and `.NET 8`.
- Use `Microsoft.Data.Sqlite` with parameterized queries.
- Ensure thread safety during database hot-swaps using reader/writer synchronization.

### MCP Protocol
- MCP stdio communication uses `stdout` strictly for JSON-RPC 2.0 messages.
- Any logging or debug output MUST be directed to `stderr` (`console.error`).

### Conventional Commits
- All commit messages MUST include the `[AI-Assisted]` suffix:
  `feat(sdk): add support for apartment validation [AI-Assisted]`
