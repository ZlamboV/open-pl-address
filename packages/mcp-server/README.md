# `open-pl-address-mcp`

High-performance **Model Context Protocol (MCP)** server providing AI assistants (**Cursor**, **Claude Code / Desktop**, **GitHub Copilot**, **Google Antigravity**, **Windsurf**) with zero-latency (< 1 ms), hallucination-free Polish address lookup, validation, and official **Urząd Skarbowy (Tax Office)** determination.

---

## Why MCP for Polish Addresses?

Large Language Models (LLMs) frequently hallucinate Polish address details:
- Conflating registered address (*zameldowanie*) with tax residence (*miejsce zamieszkania*).
- Generating obsolete or invalid 7-digit TERC and 5-digit ULIC codes.
- Guessing incorrect tax offices for cities split across multiple jurisdictions (e.g. Warsaw, Poznań, Kraków, Wrocław, Lublin).
- Misidentifying diacritics when users type Ukrainian or Russian Cyrillic phonetics.

This MCP server connects your AI assistant directly to the **official embedded TERYT + PRG + MF CRD SQLite database** in-process via stdio.

---

## Quick Setup

### 1. Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "polish-address": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "/path/to/open-pl-address/packages/mcp-server/src/index.ts"
      ],
      "env": {
        "OPEN_PL_ADDRESS_DB_PATH": "/path/to/open-pl-address/data/pl_addresses.sqlite"
      }
    }
  }
}
```

Or when installed from NPM:

```json
{
  "mcpServers": {
    "polish-address": {
      "command": "npx",
      "args": ["-y", "open-pl-address-mcp"]
    }
  }
}
```

### 2. Cursor (`.cursor/mcp.json` or Settings > Features > MCP)

```json
{
  "mcpServers": {
    "polish-address": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "./packages/mcp-server/src/index.ts"
      ]
    }
  }
}
```

### 3. Antigravity (`~/.gemini/antigravity/mcp.json`)

```json
{
  "mcpServers": {
    "polish-address": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "./packages/mcp-server/src/index.ts"
      ]
    }
  }
}
```

---

## Exposed MCP Tools

### 1. `search_polish_city`
Finds cities and settlements by Polish name or Cyrillic phonetic transliteration.
- **Parameters:**
  - `query` *(string, required)*: e.g. `"Warszawa"`, `"Варшава"`, `"Kraków"`, `"Люблін"`, `"Lodz"`
  - `limit` *(number, optional)*: Default `10`
- **Returns:** Official city name, 7-digit SIMC identifier, 7-digit TERC code, powiat, voivodeship, postal codes.

### 2. `autocomplete_polish_street`
Autocompletes street names within a specific city.
- **Parameters:**
  - `simcId` *(string, required)*: 7-digit SIMC identifier (e.g. `"0954995"` for Lublin)
  - `query` *(string, required)*: Street prefix in Latin or Cyrillic (e.g. `"Wieniaw"`, `"Липова"`)
  - `limit` *(number, optional)*: Default `10`
- **Returns:** Official street name, 5-digit ULIC ID, cecha (`ul.`, `al.`, `pl.`), and postal codes.

### 3. `validate_polish_address`
Validates address down to building number, apartment, and verifies official export readiness.
- **Parameters:**
  - `city` *(string, required)*: City name
  - `street` *(string, optional)*: Street name (optional for villages)
  - `buildingNumber` *(string, required)*: House number (e.g. `"12"`, `"14B"`)
  - `apartment` *(string, optional)*: Flat / premises number
  - `postalCode` *(string, optional)*: Postal code (`XX-XXX`)
- **Returns:** Complete normalized object with GUS TERC code, SIMC, ULIC, verified house number, and resolved `taxOffice`.

### 4. `resolve_urzad_skarbowy`
Resolves the official Polish Tax Office using legal territorial jurisdiction hierarchy (Priority 1 to 4).
- **Parameters:**
  - `terytCode` *(string, required)*: 7-digit TERC code of the gmina
  - `simcId` *(string, required)*: 7-digit SIMC code of the city
  - `ulicId` *(string, optional)*: 5-digit ULIC code of the street
  - `buildingNumber` *(string, optional)*: House number (needed for streets split across multiple tax offices)
- **Returns:** 4-digit MF CRD code, official Tax Office name, address, and match priority.

### 5. `find_by_postal_code`
Looks up administrative division, city, and streets by Polish postal code.
- **Parameters:**
  - `postalCode` *(string, required)*: Format `XX-XXX` or `XXXXX` (e.g. `"20-071"`)
- **Returns:** Matching localities, TERC codes, and associated street names.

---

## Testing

```bash
node --experimental-strip-types --test packages/mcp-server/tests/mcp-server.test.ts
```

## License
MIT License. Part of the `open-pl-address` ecosystem.
