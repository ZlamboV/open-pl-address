---
name: polish-address-verification
description: Universal offline verification of Polish addresses (TERYT + PRG), Cyrillic-to-Polish transliteration, and official Urząd Skarbowy (Tax Office) resolution for ZUS Płatnik and InsERT Gratyfikant nexo.
---

# Polish Address Verification & Tax Office Resolution Skill

This skill guides AI agents on accurately validating Polish addresses, handling Cyrillic inputs from Ukrainian/Russian speakers, extracting GUS TERYT codes, and resolving the correct **Urząd Skarbowy (Tax Office)** without external paid APIs or hallucinations.

---

## 1. When to Use This Skill
- Validating or normalizing Polish addresses for ERP systems (**InsERT Gratyfikant nexo**, **Subiekt nexo**, **Comarch Optima**, **Symfonia**).
- Preparing employee data for social security declarations (**ZUS Płatnik**, ZUA, ZZA, KEDU).
- Determining tax office codes for annual Polish tax returns (**PIT-11**, **PIT-4R**, **PIT-37**).
- Processing user addresses in web applications or Telegram/Viber bots where users write in Polish, Ukrainian, or Russian.

---

## 2. Key Polish Address Domain Rules

### Administrative Division Hierarchy (TERYT)
| Level | Identifier | Format | Example |
| :--- | :--- | :--- | :--- |
| **Województwo** | WOJ | 2 digits | `06` (Lubelskie) |
| **Powiat** | POW | 2 digits | `63` (m. Lublin) |
| **Gmina** | GMI + RODZ | 3 digits | `011` (Gmina miejska) |
| **TERC (Full)** | WOJ+POW+GMI+RODZ | **7 digits** | `0663011` (Mandatory for ZUS) |
| **Miejscowość** | SIMC | **7 digits** | `0954995` (Lublin) |
| **Ulica** | ULIC | **5 digits** | `24123` (ul. Wieniawska) |

### House Numbers & Villages
- **With streets**: Address requires `miejscowosc`, `ulica`, `nrDomu`.
- **Villages without streets**: `ulica` MUST be empty or null. The village name acts as both locality and address line, e.g. `Biskupice 4A`.
- **Sub-premises**: Suffixes (`12A`, `15/17`, `4B`) are common; integer extraction is required for parity calculations.

### Tax Office Resolution (Legal Waterfall)
> [!IMPORTANT]
> **Zameldowanie is NOT Tax Residence!**
> In Polish law, `zameldowanie` (registered address) does not dictate tax jurisdiction. Tax jurisdiction is solely governed by **miejsce zamieszkania** (actual residence on Dec 31 / tax event).

In cities with multiple tax offices (Warsaw, Poznań, Kraków, Wrocław, Łódź, Lublin), determine the Tax Office using the 4-tier waterfall:
1. **Priority 1**: Street name + building number (odd/even parity or numerical range).
2. **Priority 2**: Entire street name within the city.
3. **Priority 3**: City SIMC code.
4. **Priority 4**: Gmina 7-digit TERC code.

---

## 3. How to Use the Embedded Tools

### Via MCP (Model Context Protocol)
If MCP tools are available in the conversation, invoke them directly:
```typescript
// 1. Find city by Cyrillic or Polish name
search_polish_city({ query: "Люблін" })

// 2. Autocomplete street
autocomplete_polish_street({ simcId: "0954995", query: "Wieniaw" })

// 3. Complete validation with Tax Office resolution
validate_polish_address({
  city: "Lublin",
  street: "Wieniawska",
  buildingNumber: "12",
  apartment: "4"
})

// 4. Standalone Tax Office lookup
resolve_urzad_skarbowy({
  terytCode: "0663011",
  simcId: "0954995",
  ulicId: "24123",
  buildingNumber: "12"
})
```

### Via TypeScript SDK
```typescript
import { PolishAddressSDK } from 'open-pl-address';

const sdk = new PolishAddressSDK();
await sdk.initialize();

const result = sdk.validateAndFormatForExport({
  miejscowosc: 'Lublin',
  ulica: 'Wieniawska',
  nrDomu: '12',
  nrLokalu: '4'
});

console.log(result.normalized.terytGminaCode); // "0663011"
console.log(result.taxOffice.usCode);          // "0610"
```

### Via C# / .NET SDK
```csharp
using OpenPlAddress.Sdk;

var sdk = new PolishAddressSdk();
await sdk.InitializeAsync();

var result = sdk.ValidateAndFormatForExport(new RawAddressInput {
    Miejscowosc = "Lublin",
    Ulica = "Wieniawska",
    NrDomu = "12",
    NrLokalu = "4"
});

string terytCode = result.Normalized.TerytGminaCode; // "0663011"
string usCode = result.TaxOffice.UsCode;             // "0610"
```

---

## 4. Common Edge Cases & Solutions
- **Cyrillic Inputs**: Users typing "Варшава" or "вул. Коперника" are automatically matched to "Warszawa" and "ul. Mikołaja Kopernika" via phonetic transliteration.
- **Street prefixes**: In Poland, streets have types (cecha): `ul.` (ulica), `al.` (aleja), `pl.` (plac), `os.` (osiedle). Searches strip prefixes automatically.
- **Streets crossing tax borders**: When a street is split (e.g. Kasztelańska in Poznań or Lipowa in Lublin), building number is mandatory to distinguish the tax office.
