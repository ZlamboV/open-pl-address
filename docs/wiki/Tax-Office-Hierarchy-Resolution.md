# Tax Office (Urząd Skarbowy) Hierarchy Resolution

This document details the legal principles, algorithmic hierarchy, and database query mechanics used by **open-pl-address** to determine the competent Polish Tax Office (**Urząd Skarbowy**) in under 1 millisecond.

---

## 1. Regulatory Framework: Zameldowanie vs. Miejsce Zamieszkania

In Poland, identifying which tax office has territorial jurisdiction over an employee or citizen is a frequent source of compliance errors in payroll, HR, and accounting systems.

### The Legal Distinction

> [!IMPORTANT]
> **Adres Zameldowania (Registered Address) DOES NOT determine Tax Office jurisdiction.**

1. **Adres Zameldowania (Administrative Registration)**:
   - Governed by the Population Registration Act (*Ustawa o ewidencji ludności*).
   - Represents an administrative record maintained at the municipal office (*Urząd Miasta / Urząd Gminy*).
   - **Legally irrelevant for personal income taxes (PIT).**
2. **Miejsce Zamieszkania (Place of Residence)**:
   - Governed by Article 25 of the Polish Civil Code (*Kodeks cywilny*) and Article 17 § 1 of the Tax Ordinance (*Ordynacja podatkowa*).
   - Defined as the locality where a natural person resides with the intention of permanent stay on **December 31** of the given tax year.
   - Article 45 § 1 of the Personal Income Tax Act (*Ustawa o podatku dochodowym od osób fizycznych — PIT*) strictly establishes that annual tax declarations (**PIT-11**, **PIT-37**, **PIT-36**) must be submitted to the tax office competent for the taxpayer's **miejsce zamieszkania**.

Filing an annual PIT-11 report with an incorrect tax office code causes declaration rejections, misallocated advance income tax payments (*zaliczki na podatek dochodowy*), and administrative investigation procedures from the National Revenue Administration (**KAS — Krajowa Administracja Skarbowa**).

---

## 2. The Multi-District City Problem

In small towns and rural gminas, territorial jurisdiction is straightforward: one tax office serves the entire powiat or gmina. 

However, in Poland's major metropolitan areas, jurisdiction is fractured across multiple tax offices:
- **Warszawa (Warsaw)**: Divided among **12** separate Tax Offices (e.g. *US Warszawa-Mokotów*, *US Warszawa-Śródmieście*, *US Warszawa-Wola*, *US Warszawa-Praga*).
- **Kraków**: Divided among **6** Tax Offices (e.g. *US Kraków-Śródmieście*, *US Kraków-Krowodrza*, *US Kraków-Podgórze*).
- **Łódź**: Divided among **5** Tax Offices (e.g. *US Łódź-Bałuty*, *US Łódź-Polesie*, *US Łódź-Śródmieście*).
- **Poznań**: Divided among **4** Tax Offices (e.g. *US Poznań-Grunwald*, *US Poznań-Winogrady*, *US Poznań-Nowe Miasto*).
- **Wrocław**: Divided among **4** Tax Offices (e.g. *US Wrocław-Fabryczna*, *US Wrocław-Krzyki*, *US Wrocław-Stare Miasto*).
- **Lublin**: Divided among **3** Tax Offices (*Pierwszy US*, *Drugi US*, *Trzeci US*).

Crucially, in these cities, jurisdiction often splits **down the middle of a single street**, where even-numbered buildings report to one tax office, and odd-numbered buildings report to another!

---

## 3. The 4-Tier Waterfall Algorithm

To accurately resolve jurisdiction across all 2,477 Polish municipalities, `open-pl-address` implements a strict **4-tier waterfall resolution algorithm** derived from official decrees of the Minister of Finance:

```
┌─────────────────────────────────────────────────────────────┐
│                 Input Address Parameters                    │
│   (terytCode, simcId, ulicId, buildingNumber: "12A")        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │ Tier 1: Priority 1 (Street + Parity + Building Range)     │
 │ - Matches ulic_id                                         │
 │ - Evaluates parity (EVEN / ODD / ALL)                     │
 │ - Checks numeric range: building_from <= 12 <= building_to│
 └─────────────────────────────┬─────────────────────────────┘
                               │ (Not matched)
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │ Tier 2: Priority 2 (Whole Street Name)                    │
 │ - Matches ulic_id within city                             │
 └─────────────────────────────┬─────────────────────────────┘
                               │ (Not matched)
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │ Tier 3: Priority 3 (City Default — SIMC)                  │
 │ - Matches simc_id locality code                           │
 └─────────────────────────────┬─────────────────────────────┘
                               │ (Not matched)
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │ Tier 4: Priority 4 (Gmina / Powiat Fallback — TERC)       │
 │ - Matches full 7-digit TERC code, or                      │
 │ - Matches 6-digit gmina prefix, or                        │
 │ - Matches 4-digit powiat prefix (e.g. "0609")             │
 └───────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of Each Tier

#### Tier 1: Street + Number Range & Parity (`Priority = 1`)
- **Condition**: Evaluates when a street is split between multiple offices.
- **Parity Rules**:
  - `EVEN`: Matches only even building numbers (`2, 4, 6, 8, ...`).
  - `ODD`: Matches only odd building numbers (`1, 3, 5, 7, ...`).
  - `ALL`: Matches both even and odd numbers within the designated range.
- **Numeric Parsing**: The SDK parses alphanumeric numbers (e.g., `"12A"`, `"15/17"`, `"84 bis"`) into their leading integer component (`12`, `15`, `84`) using `extractBuildingNumericPart`.
- **Real-World Example (Lublin)**:
  - `ul. Lipowa`, odd numbers `1–11` -> **Pierwszy Urząd Skarbowy w Lublinie** (`0610`).
  - `ul. Lipowa`, even numbers `2–16` -> **Trzeci Urząd Skarbowy w Lublinie** (`0612`).

#### Tier 2: Whole Street (`Priority = 2`)
- **Condition**: The entire street lies within the territory of a single tax office.
- **Real-World Example (Lublin)**:
  - `ul. Wieniawska` (all numbers) -> **Pierwszy Urząd Skarbowy w Lublinie** (`0610`).
  - `ul. Tomasza Zana` (all numbers) -> **Trzeci Urząd Skarbowy w Lublinie** (`0612`).

#### Tier 3: City Default (`Priority = 3`)
- **Condition**: Streets not explicitly assigned in rules, or small cities served by a single designated municipal tax office.
- **Real-World Example**:
  - Unlisted streets in Lublin fall back to **Pierwszy Urząd Skarbowy w Lublinie** (`0610`).
  - Unlisted streets in Warsaw fall back to **Urząd Skarbowy Warszawa-Śródmieście** (`1435`).

#### Tier 4: Gmina / Powiat Fallback (`Priority = 4`)
- **Condition**: Suburban or rural municipalities where jurisdiction is assigned at the gmina or county level.
- **Real-World Example**:
  - Gmina Biskupice (`teryt_code = 0617012`) has no municipal office in the village; jurisdiction falls back to **Drugi Urząd Skarbowy w Lublinie** (`0611`).
  - Rural powiat lubelski (`teryt_code` prefix `0609`) falls back to **Drugi Urząd Skarbowy w Lublinie** (`0611`).

---

## 4. SQL Execution & Query Performance

The resolution engine queries the indexed `tax_office_rules` table:

```sql
SELECT r.id, r.us_code, r.teryt_code, r.simc_id, r.ulic_id,
       r.building_parity, r.building_from, r.building_to, r.priority,
       o.name, o.city, o.street, o.postal_code
FROM tax_office_rules r
JOIN tax_offices o ON o.us_code = r.us_code
WHERE r.teryt_code IN (?, SUBSTR(?, 1, 6), SUBSTR(?, 1, 4))
  AND (r.simc_id IS NULL OR r.simc_id = ?)
  AND (r.ulic_id IS NULL OR r.ulic_id = ?)
ORDER BY r.priority ASC, r.id ASC;
```

### In-Memory Candidate Evaluation
Because SQLite evaluates the query against the multi-column index `idx_tax_rules_lookup (teryt_code, simc_id, ulic_id, priority)`, query execution takes **0.05–0.15 ms**.

Once candidate rules are retrieved:
1. If candidate has `priority === 1`:
   - Checks `building_parity`: if `EVEN` and number is odd, skip. If `ODD` and number is even, skip.
   - Checks `building_from`: if number is lower than lower bound, skip.
   - Checks `building_to`: if number is higher than upper bound, skip.
   - If conditions pass, **Candidate Selected**.
2. If candidate has `priority === 2` and matches `ulic_id`, **Candidate Selected**.
3. If candidate has `priority === 3` and matches `simc_id`, **Candidate Selected**.
4. If candidate has `priority === 4`, **Candidate Selected**.

---

## 5. Working Code Examples

### 5.1 TypeScript Example (All 4 Tiers)

```typescript
import { PolishAddressSDK } from 'open-pl-address';

const sdk = new PolishAddressSDK();
await sdk.initialize();

// --- Tier 1: Street + Number Range / Parity ---
// ul. Lipowa 5 (Odd, 1-11) -> Pierwszy US w Lublinie (0610)
const tier1Odd = sdk.resolveTaxOffice({
  terytCode: '0663011',
  simcId: '0954995',
  ulicId: '11181', // ul. Lipowa
  buildingNumber: '5'
});
console.log(`Tier 1 (Odd):  ${tier1Odd?.name} [${tier1Odd?.usCode}]`); // 0610

// ul. Lipowa 8 (Even, 2-16) -> Trzeci US w Lublinie (0612)
const tier1Even = sdk.resolveTaxOffice({
  terytCode: '0663011',
  simcId: '0954995',
  ulicId: '11181', // ul. Lipowa
  buildingNumber: '8'
});
console.log(`Tier 1 (Even): ${tier1Even?.name} [${tier1Even?.usCode}]`); // 0612

// --- Tier 2: Whole Street ---
// ul. Wieniawska (any number) -> Pierwszy US w Lublinie (0610)
const tier2 = sdk.resolveTaxOffice({
  terytCode: '0663011',
  simcId: '0954995',
  ulicId: '24123', // ul. Wieniawska
  buildingNumber: '99'
});
console.log(`Tier 2:        ${tier2?.name} [${tier2?.usCode}]`); // 0610

// --- Tier 3: City Level Fallback ---
// Unspecified street in Lublin -> Pierwszy US w Lublinie (0610)
const tier3 = sdk.resolveTaxOffice({
  terytCode: '0663011',
  simcId: '0954995'
});
console.log(`Tier 3:        ${tier3?.name} [${tier3?.usCode}]`); // 0610

// --- Tier 4: Gmina / Powiat Fallback ---
// Rural Gmina Biskupice (0617012) -> Drugi US w Lublinie (0611)
const tier4 = sdk.resolveTaxOffice({
  terytCode: '0617012',
  simcId: '0380120'
});
console.log(`Tier 4:        ${tier4?.name} [${tier4?.usCode}]`); // 0611
```

### 5.2 C# / .NET Example

```csharp
using System;
using System.Threading.Tasks;
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

public class TaxOfficeDemo
{
    public static async Task Main()
    {
        using var sdk = new PolishAddressSdk();
        await sdk.InitializeAsync();

        // Resolving tax office for a Warsaw address
        var taxOffice = sdk.ResolveTaxOffice(new TaxOfficeResolutionInput
        {
            TerytCode = "1465011",   // Warszawa
            SimcId = "0918123",      // Warszawa
            UlicId = "11894",        // ul. Marszałkowska
            BuildingNumber = "140"
        });

        if (taxOffice != null)
        {
            Console.WriteLine($"Resolved Tax Office: {taxOffice.Name}");
            Console.WriteLine($"MF CRD 4-Digit Code:  {taxOffice.UsCode}");
            Console.WriteLine($"Office Address:       {taxOffice.Street}, {taxOffice.PostalCode} {taxOffice.City}");
        }
    }
}
```
