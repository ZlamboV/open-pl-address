# CLAUDE.md — Claude Agent Instructions for `open-pl-address`

Welcome, Claude. This document contains project-specific instructions, architectural invariants, and command workflows for the `open-pl-address` monorepo.

> **Master Architecture Reference**: Consult `/AGENTS.md` for full database schemas, state identifier specifications, and CalVer release rules.

---

## 1. Key Build, Test & Lint Commands

Execute commands from the monorepo root:

```bash
# Run all unit tests (TypeScript SDK + MCP Server)
npm test

# Run TypeScript SDK tests only
npm run test:ts

# Run MCP server tests only
npm run test:mcp

# Rebuild demo seed database (Lublin, Warszawa, Kraków, etc.)
npm run build:seed

# Launch interactive terminal CLI demo
npm run cli

# Launch full interactive demo
npm run demo

# Build TypeScript SDK artifacts
cd packages/ts-sdk && npm run build

# Run C# SDK tests (requires .NET 8 SDK)
dotnet test packages/csharp-sdk/OpenPlAddress.sln
```

---

## 2. Architectural Guardrails (Non-Negotiable)

1. **MaxMind GeoIP Model**:
   - `open-pl-address` is an embedded in-process database (< 1 ms latency).
   - NEVER suggest or introduce external geocoding HTTP APIs (Google Maps, GUS SOAP).
2. **Zero Runtime Dependencies for `packages/ts-sdk`**:
   - The TypeScript client SDK must have **zero runtime dependencies**.
   - Built on Node.js 22+ native modules: `node:sqlite` (`DatabaseSync`), `node:fs`, `node:crypto`, `node:zlib`, `node:stream`.
3. **No Synthetic Identifiers**:
   - Do NOT hallucinate TERC, SIMC, ULIC, or Tax Office codes from memory.
   - Always query the embedded SQLite database or call the SDK.
4. **Tax Residency Legal Invariant**:
   - `zameldowanie` (registration) != `miejsce zamieszkania` (tax residence).
   - In Polish law, tax residence for PIT-11 declarations is determined exclusively by the actual address of residence on December 31.
   - Tax offices in multi-office cities are resolved strictly via the 4-tier waterfall (Priority 1: street+building parity/range -> Priority 2: street -> Priority 3: city SIMC -> Priority 4: gmina TERC).
5. **CalVer & Release Cadence**:
   - Database CalVer format: `YYYY.MM.0` (e.g. `2026.11.0`).
   - Releases trigger monthly on the **5th at 03:00 UTC** via `.github/workflows/update-db.yml`.
6. **Commit Format**:
   - All commits must follow Conventional Commits syntax and terminate with `[AI-Assisted]`:
     `git commit -m "feat(sdk): add support for apartment validation [AI-Assisted]"`

---

## 3. Monorepo Organization

- `builder/`: Streaming pipeline compiling GUS TERYT XML + GUGiK PRG CSV into SQLite.
- `packages/ts-sdk/`: ESM TypeScript client SDK (`open-pl-address`).
- `packages/csharp-sdk/`: C# .NET Standard 2.0 & .NET 8 library (`OpenPlAddress.Sdk`).
- `packages/mcp-server/`: Model Context Protocol stdio server (`open-pl-address-mcp`).
- `schema/`: SQLite schema DDL (`001_initial_schema.sql`) and documentation.
- `docs/recipes/`: Real-world recipes for ZUS Płatnik, InsERT Gratyfikant nexo, and Telegram bots.
- `data/`: Compiled SQLite database (`pl_addresses.sqlite`, `.gz`, and `manifest.json`).

---

## 4. Code Style & Quality Standards

- **TypeScript**: Strict typing (`"strict": true`, NodeNext ESM). No implicit `any`. Use descriptive domain terms (`terytCode`, `simcId`, `ulicId`, `usCode`, `buildingParity`).
- **Error Handling**: Graceful degradation. Provide clean `errors`, `warnings`, and `suggestions` arrays in validation outputs rather than throwing unhandled exceptions.
- **Testing**: Every bugfix or new feature must be accompanied by a test in `packages/ts-sdk/tests/` or `packages/mcp-server/tests/`.
