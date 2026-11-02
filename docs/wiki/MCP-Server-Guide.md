# Model Context Protocol (MCP) Server Guide

The `open-pl-address-mcp` package implements Anthropic's **Model Context Protocol (MCP)**, allowing AI coding assistants and LLMs to validate Polish addresses, autocomplete streets, and resolve competent tax offices with zero hallucination.

---

## 1. Overview & Architecture

The MCP server runs as a local subprocess communicating via standard input/output (**stdio**) using the **JSON-RPC 2.0** protocol:

```
┌─────────────────────────────────────────────────────────────┐
│                 AI Client Environment                       │
│    (Cursor IDE / Claude Desktop / GitHub Copilot CLI)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ JSON-RPC 2.0 over stdio
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  open-pl-address-mcp                        │
│                 (packages/mcp-server)                       │
│                                                             │
│   stdout : Strictly reserved for JSON-RPC responses         │
│   stderr : Operational logging and diagnostics              │
└──────────────────────────────┬──────────────────────────────┘
                               │ In-process calls (< 1ms)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Embedded PolishAddressSDK                    │
│            (Local SQLite: TERYT + PRG + MF)                 │
└─────────────────────────────────────────────────────────────┘
```

> **Protocol Rule**: All JSON-RPC responses are written strictly to `stdout`. Any debugging, initialization logs, or telemetry are written to `stderr` to avoid corrupting the client's JSON parser.

---

## 2. All 5 MCP Tool Specifications

The MCP server exposes 5 specialized tools defined in `packages/mcp-server/src/tools.ts`:

### 2.1 `search_polish_city`
Fast lookup of Polish cities, towns, and villages with diacritic stripping and Cyrillic transliteration.

- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "City name in Polish, English, or Cyrillic (e.g. 'Warszawa', 'Люблін', 'Krakow')"
      },
      "limit": {
        "type": "number",
        "description": "Max results to return (default: 10)"
      }
    },
    "required": ["query"]
  }
  ```

---

### 2.2 `autocomplete_polish_street`
Autocompletes street names within a designated city SIMC code.

- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "simcId": {
        "type": "string",
        "description": "7-digit SIMC identifier of the city (obtained from search_polish_city)"
      },
      "query": {
        "type": "string",
        "description": "Street name or prefix (e.g. 'Wieniawska', 'Липова', 'Marsz')"
      },
      "limit": {
        "type": "number",
        "description": "Max results to return (default: 10)"
      }
    },
    "required": ["simcId", "query"]
  }
  ```

---

### 2.3 `validate_polish_address`
Validates full physical address against official PRG building points, resolving TERC, SIMC, ULIC, and competent Urząd Skarbowy.

- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "city": {
        "type": "string",
        "description": "City or village name"
      },
      "street": {
        "type": "string",
        "description": "Street name (leave empty for villages without streets)"
      },
      "buildingNumber": {
        "type": "string",
        "description": "House/building number (e.g. '12', '12A', '15/17')"
      },
      "apartment": {
        "type": "string",
        "description": "Apartment or flat number (optional)"
      },
      "postalCode": {
        "type": "string",
        "description": "Postal code in XX-XXX format (optional)"
      }
    },
    "required": ["city", "buildingNumber"]
  }
  ```

---

### 2.4 `resolve_urzad_skarbowy`
Resolves official 4-digit MF CRD tax office code and office name using the 4-tier waterfall.

- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "terytCode": {
        "type": "string",
        "description": "7-digit TERC code of the gmina"
      },
      "simcId": {
        "type": "string",
        "description": "7-digit SIMC code of the city"
      },
      "ulicId": {
        "type": "string",
        "description": "5-digit ULIC code of the street (optional for villages)"
      },
      "buildingNumber": {
        "type": "string",
        "description": "Building number to evaluate parity and numerical range (optional)"
      }
    },
    "required": ["terytCode", "simcId"]
  }
  ```

---

### 2.5 `find_by_postal_code`
Reverse lookup of administrative division and streets served by a postal code.

- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "postalCode": {
        "type": "string",
        "description": "Postal code in XX-XXX format (e.g. '20-029')"
      }
    },
    "required": ["postalCode"]
  }
  ```

---

## 3. Setup Guides for AI Assistants

### 3.1 Cursor IDE Setup

Add the MCP server configuration to `.cursor/mcp.json` in your workspace or user directory:

```json
{
  "mcpServers": {
    "open-pl-address": {
      "command": "npx",
      "args": ["-y", "open-pl-address-mcp"],
      "env": {
        "OPEN_PL_ADDRESS_DB_PATH": "./data/pl_addresses.sqlite"
      }
    }
  }
}
```

Or reference a local build of the monorepo:

```json
{
  "mcpServers": {
    "open-pl-address-local": {
      "command": "node",
      "args": ["/absolute/path/to/open-pl-address/packages/mcp-server/dist/index.js"],
      "env": {
        "OPEN_PL_ADDRESS_DB_PATH": "/absolute/path/to/open-pl-address/data/pl_addresses.sqlite"
      }
    }
  }
}
```

---

### 3.2 Claude Desktop Setup

On macOS, open `~/Library/Application Support/Claude/claude_desktop_config.json`:
On Windows, open `%APPDATA%\Claude\claude_desktop_config.json`:

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

Restart Claude Desktop. The hammer/tools icon will display the 5 available Polish address tools.

---

### 3.3 GitHub Copilot / VS Code MCP Configuration

In VS Code with the GitHub Copilot Chat extension supporting MCP (`settings.json` or `.vscode/mcp.json`):

```json
{
  "github.copilot.mcpServers": {
    "polishAddress": {
      "command": "npx",
      "args": ["-y", "open-pl-address-mcp"]
    }
  }
}
```

---

## 4. Testing the Server Interactively

You can test the MCP server manually via terminal stdio:

```bash
# Start server
npx open-pl-address-mcp
```

Send an initialization JSON-RPC request via standard input:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}
```

The server responds immediately:

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"open-pl-address-mcp","version":"1.0.0"}}}
```

Query a city via `tools/call`:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_polish_city","arguments":{"query":"Люблін","limit":1}}}
```

Output:

```json
{"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"[{\"simcId\":\"0954995\",\"terytCode\":\"0663011\",\"name\":\"Lublin\",\"wojewodztwo\":\"LUBELSKIE\",\"powiat\":\"m. Lublin\",\"gmina\":\"Lublin\",\"postalCodes\":[\"20-001\",\"20-002\"]}]"}]}}
```
