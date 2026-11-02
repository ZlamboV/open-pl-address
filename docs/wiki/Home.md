# open-pl-address Knowledge Base

Welcome to the official documentation and technical wiki for **open-pl-address** — the offline, embedded Polish address database, validation engine, and multi-language SDK suite.

---

## 1. Mission & Philosophy

Every business software operating in Poland — whether an ERP system, payroll module, e-commerce checkout, logistics platform, or CRM — must validate Polish physical addresses and determine administrative codes. In particular, Polish tax returns (**PIT-11**, **PIT-4R**, **PIT-37**) and social insurance declarations (**ZUS ZUA**, **ZUS ZZA** in KEDU XML) require exact territorial identifiers:
- **TERC** (7-digit gmina code from GUS TERYT)
- **SIMC** (7-digit locality code)
- **ULIC** (5-digit street code)
- **MF US Code** (4-digit tax office code from Ministerstwo Finansów)

Historically, engineering teams faced an unpleasant trade-off:
1. **Google Maps Geocoding API**: Costs $5.00 per 1,000 queries, suffers 150–500 ms HTTP network latency, fails to provide official TERC/SIMC/ULIC codes, cannot resolve Polish tax office jurisdictions, and sends sensitive employee addresses to third-party cloud servers.
2. **GUS BIR1 / TERYT SOAP API**: Free but cumbersome, requires contracts and CAPTCHAs, exhibits high latency (200–1000 ms), lacks house number validation (TERYT has no house numbers), and experiences regular downtime.

### The MaxMind GeoIP Paradigm for Polish Addresses

`open-pl-address` brings the **MaxMind GeoIP** architectural model to Polish address intelligence:
- **In-Process SQLite Engine**: Evaluates queries against local B-Trees and FTS5 virtual tables in `< 1 ms`.
- **100% Offline & Air-Gapped**: Runs inside your Node.js or .NET process memory. Zero network requests, zero data leaks, zero external API costs.
- **Official State Registries Combined**: Merges GUS TERYT (administrative hierarchy), GUGiK PRG (~8.5 million official house number points), and Ministerstwo Finansów CRD (tax offices) into a single, compact database (<150 MB).
- **Phonetic & Cyrillic Resilience**: Automatically resolves misspellings, diacritic-free inputs, and Ukrainian/Russian keyboard entries (e.g., `Люблін` -> `Lublin`, `вул. Липова` -> `ul. Lipowa`).
- **Zero Runtime Dependencies**: The client TypeScript SDK has **0 external runtime dependencies**, utilizing Node 22 native `node:sqlite`.
- **Zero-Downtime Atomic Hot-Swap**: Automatically downloads monthly CalVer updates and replaces the SQLite file on the fly without interrupting running services.

---

## 2. Comparative Benchmark

| Feature | `open-pl-address` | Google Maps Geocoding API | GUS TERYT / BIR1 SOAP API |
| :--- | :--- | :--- | :--- |
| **Query Latency** | **< 1 ms** (In-process SQLite) | 150 – 500 ms (HTTP / TLS roundtrip) | 200 – 1000 ms (SOAP XML payload) |
| **Pricing / Cost** | **100% Free & Open Source (MIT)** | $5.00 per 1,000 requests ($5,000/1M) | Free (Requires commercial contract) |
| **Offline / Air-Gapped** | **Yes** (Embedded local file or memory) | No (Cloud API only) | No (External government servers) |
| **GUS TERYT Codes (TERC/SIMC/ULIC)** | **Yes** (Native canonical 7- and 5-digit codes) | No (Commercial geocoding format) | Yes (Requires multiple XML queries) |
| **House Number Validation** | **Yes** (~8.5M GUGiK PRG address points) | Approximate / Rooftop interpolation | No (TERYT does not track house numbers) |
| **Urząd Skarbowy (Tax Office) Detection** | **Yes** (4-tier MF CRD waterfall algorithm) | No | No |
| **ZUS Płatnik & Gratyfikant Compatibility** | **100% Native** (`NormalizedAddress` output) | No (Requires custom engineering) | Partial (Requires heavy manual glue code) |
| **Cyrillic Transliteration (UA / RU)** | **Yes** (56 phonetic rules + 63 city mappings) | Partial (Heuristic fallback) | No (Strict Polish spelling only) |
| **Runtime Dependencies** | **0** (Uses built-in `node:sqlite`) | Heavy HTTP client SDKs | SOAP client / XML parser dependencies |
| **Data Freshness** | **Monthly CalVer** (Automated on 5th at 03:00 UTC) | Continuous | Periodic |

---

## 3. Quickstart Guides

### 3.1 Node.js / Bun (TypeScript)

Install the client SDK:

```bash
npm install open-pl-address
```

Validate an address and determine its competent tax office in under a millisecond:

```typescript
import { PolishAddressSDK } from 'open-pl-address';

// 1. Instantiate and initialize SDK
const sdk = new PolishAddressSDK({
  // Optional configuration (defaults to ./data/pl_addresses.sqlite)
  autoUpdateDays: 7
});

await sdk.initialize();

// 2. Search for a city with Cyrillic tolerance
const cities = sdk.searchCity('Люблін');
console.log(`Matched City: ${cities[0].name} (SIMC: ${cities[0].simcId}, Powiat: ${cities[0].powiat})`);

// 3. Autocomplete streets within that city
const streets = sdk.searchStreet(cities[0].simcId, 'Wieniaw');
console.log(`Street: ${streets[0].cecha} ${streets[0].name} (ULIC: ${streets[0].ulicId})`);

// 4. Validate exact building number and export for ZUS / ERP
const result = sdk.validateAndFormatForExport({
  miejscowosc: 'Lublin',
  ulica: 'Wieniawska',
  nrDomu: '12',
  nrLokalu: '4'
});

if (result.isValid && result.normalized) {
  console.log(`Normalized: ${result.normalized.cechaUlicy} ${result.normalized.ulica} ${result.normalized.nrDomu}`);
  console.log(`ZUS TERC Gmina: ${result.normalized.terytGminaCode}`); // 0663011
  console.log(`Postal Code: ${result.normalized.kodPocztowy}`);        // 20-029
  console.log(`Urząd Skarbowy: ${result.taxOffice?.name} (Code: ${result.taxOffice?.usCode})`); // 0610
}

// 5. Clean up resources on process exit
sdk.close();
```

### 3.2 .NET / C#

Install the NuGet package:

```bash
dotnet add package OpenPlAddress.Sdk
```

Dependency Injection & resolution in ASP.NET Core:

```csharp
using System;
using System.Threading.Tasks;
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

public class Program
{
    public static async Task Main(string[] args)
    {
        var options = new PolishAddressSdkOptions
        {
            DatabasePath = "./data/pl_addresses.sqlite",
            AutoUpdateDays = 7
        };

        using var sdk = new PolishAddressSdk(options);
        await sdk.InitializeAsync();

        var input = new RawAddressInput
        {
            Miejscowosc = "Warszawa",
            Ulica = "Marszałkowska",
            NrDomu = "140"
        };

        var result = sdk.ValidateAndFormatForExport(input);

        if (result.IsValid)
        {
            Console.WriteLine($"City: {result.Normalized.Miejscowosc} (SIMC: {result.Normalized.SimcId})");
            Console.WriteLine($"TERC: {result.Normalized.TerytGminaCode}");
            Console.WriteLine($"Tax Office: {result.TaxOffice?.Name} (Kod: {result.TaxOffice?.UsCode})");
        }
    }
}
```

### 3.3 Model Context Protocol (MCP Server)

For AI assistants like **Cursor IDE**, **Claude Desktop**, and **GitHub Copilot**:

```bash
npx -y open-pl-address-mcp
```

The MCP server exposes 5 dedicated tools:
1. `search_polish_city` — Instant city lookup with diacritic/Cyrillic support.
2. `autocomplete_polish_street` — Street autocomplete filtered by SIMC and optional postal code.
3. `validate_polish_address` — Complete address validation and tax office resolution.
4. `resolve_urzad_skarbowy` — 4-tier waterfall tax office determination.
5. `find_by_postal_code` — Reverse lookup of cities and streets from postal code.

---

## 4. Documentation Map

Explore the in-depth documentation sections:

- **Architecture & Registries**:
  - [Architecture Deep Dive](Architecture-Deep-Dive) — In-process SQLite engine, FTS5 virtual tables, JSON compression, and atomic hot-swap.
  - [Polish State Registries Spec](Polish-State-Registries-Spec) — Legal and technical structure of GUS TERYT (TERC/SIMC/ULIC), GUGiK PRG, and MF CRD.
  - [Tax Office Hierarchy Resolution](Tax-Office-Hierarchy-Resolution) — 4-tier waterfall resolution algorithm and legal rules (*zameldowanie* vs *miejsce zamieszkania*).
- **SDK & Protocol References**:
  - [TypeScript SDK Reference](TypeScript-SDK-Reference) — Complete API reference for Node.js and Bun developers.
  - [C# .NET SDK Reference](CSharp-DotNet-SDK-Reference) — Complete API reference for .NET Standard 2.0 and .NET 8 developers.
  - [MCP Server Guide](MCP-Server-Guide) — Integration instructions for Cursor, Claude Desktop, and Copilot.
- **Enterprise Integration Recipes**:
  - [Recipe: ZUS Płatnik & PIT-11](Recipe-ZUS-Platnik) — KEDU XML generation, mandatory 7-digit TERC codes, and tax return headers.
  - [Recipe: InsERT Gratyfikant nexo](Recipe-Gratyfikant-nexo) — C# Sfera API integration for employee address cards (`Pracownik.AdresZamieszkania`).
  - [Recipe: Telegram Bot (Cyrillic)](Recipe-Telegram-Bot) — Multi-step address collection wizard with phonetic transliteration.
- **Operations & Automation**:
  - [Builder Pipeline & Monthly Updates](Builder-Pipeline-and-Monthly-Updates) — Streaming data pipeline, Geoportal scraping, CalVer versioning, and CI/CD schedule.
