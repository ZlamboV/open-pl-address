# OpenPlAddress.Sdk (.NET / C#)

Embedded Polish Address Database SDK for .NET Standard 2.0 and .NET 8+.
Optimized for **InsERT Gratyfikant nexo (Sfera)**, **ZUS Płatnik**, and high-performance accounting/ERP integrations.

## Features
- **Local Embedded SQLite (<1 ms latency)**: High speed in-process queries via `Microsoft.Data.Sqlite`.
- **Zero-Config & Auto-Sync**: Background check for monthly database updates (`manifest.json`) and safe atomic hot-swap.
- **Diacritics & Cyrillic Resilience**: Removes Polish diacritics and handles phonetic Cyrillic transliteration.
- **Official Identifiers**: Exports 7-digit TERC gmina codes, 7-digit SIMC identifiers, and 5-digit ULIC identifiers.

---

## Installation

Add NuGet reference:
```xml
<PackageReference Include="OpenPlAddress.Sdk" Version="1.0.0" />
```

Or via CLI:
```bash
dotnet add package OpenPlAddress.Sdk
```

---

## Usage Example

### 1. Initialization and Dependency Injection

```csharp
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

var sdk = new PolishAddressSdk(new PolishAddressSdkOptions
{
    DbPath = @"C:\ProgramData\OpenPlAddress\pl_addresses.sqlite",
    // Optional remote GitHub releases URL for monthly updates:
    // UpdateUrl = "https://github.com/your-org/open-pl-address/releases/latest/download",
    AutoUpdateDays = 7
});

await sdk.InitializeAsync();
```

### 2. Search and Autocomplete

```csharp
// Instant search by name (supports Cyrillic & diacritics removal)
var cities = sdk.SearchCity("Люблін");
var city = cities.FirstOrDefault();
Console.WriteLine($"{city.Name} (TERYT: {city.TerytCode}, SIMC: {city.SimcId})");

// Autocomplete streets in city
var streets = sdk.SearchStreet(city.SimcId, "wieniaw");
var street = streets.FirstOrDefault();
Console.WriteLine($"{street.Cecha} {street.Name} (ULIC: {street.UlicId})");

// Validate house number & get exact postal code
var bld = sdk.ValidateBuilding(city.SimcId, street.UlicId, "12");
Console.WriteLine($"Building exists: {bld.Exists}, Postal Code: {bld.PostalCode}");
```

### 3. Integration with InsERT Gratyfikant nexo (Sfera)

```csharp
var validation = sdk.ValidateAndFormatForExport(new RawAddressInput
{
    Miejscowosc = "Lublin",
    Ulica = "Wieniawska",
    NrDomu = "12",
    NrLokalu = "4",
    KodPocztowy = "20-029"
});

if (validation.IsValid && validation.Normalized != null)
{
    var addr = validation.Normalized;
    
    // Fill InsERT Gratyfikant nexo / Subiekt nexo Sfera entity:
    // podmiot.AdresPodstawowy.Szczegoly.Ulica = addr.Ulica;
    // podmiot.AdresPodstawowy.Szczegoly.NrDomu = addr.NrDomu;
    // podmiot.AdresPodstawowy.Szczegoly.NrLokalu = addr.NrLokalu;
    // podmiot.AdresPodstawowy.Szczegoly.KodPocztowy = addr.KodPocztowy;
    // podmiot.AdresPodstawowy.Szczegoly.Miejscowosc = addr.Miejscowosc;
    // podmiot.AdresPodstawowy.Szczegoly.Gmina = addr.Gmina;
    // podmiot.AdresPodstawowy.Szczegoly.Powiat = addr.Powiat;
    // podmiot.AdresPodstawowy.Szczegoly.Wojewodztwo = addr.Wojewodztwo;
    // podmiot.AdresPodstawowy.Szczegoly.KodGminyGUS = addr.TerytGminaCode; // 7-digit code for ZUS Platnik

    // Urząd Skarbowy for employee tax file & PIT-11 / PIT-37 declarations:
    if (addr.TaxOffice != null)
    {
        Console.WriteLine($"Urząd Skarbowy: [{addr.TaxOffice.UsCode}] {addr.TaxOffice.Name}");
        // pracownik.UrzadSkarbowy = addr.TaxOffice.UsCode; // e.g. "0610"
    }
}
else
{
    foreach (var error in validation.Errors)
    {
        Console.WriteLine($"Validation Error: {error}");
    }
}
```

### 4. Direct Urząd Skarbowy (Tax Office) Resolution (&lt; 1 ms)

```csharp
var taxOffice = sdk.ResolveTaxOffice(new TaxOfficeResolutionInput
{
    TerytCode = "0663011",
    SimcId = "0954995",
    UlicId = "11181", // ul. Lipowa
    BuildingNumber = "3" // Priority 1: Odd -> Pierwszy US (0610), Even -> Trzeci US (0612)
});

Console.WriteLine($"US Code: {taxOffice?.UsCode}, Name: {taxOffice?.Name}");
```

---

## API Summary

- `FindByPostalCode(string postalCode)`: Returns voivodeship, powiat, gmina, teryt codes, and served streets.
- `SearchCity(string query, int limit = 10)`: Instant search by city name.
- `SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15)`: Autocomplete streets.
- `ValidateBuilding(string simcId, string? ulicId, string buildingNumber)`: Check building presence.
- `ValidateAndFormatForExport(RawAddressInput input)`: Full normalization and validation for ERP/ZUS.
- `CheckForUpdateAsync()`: Checks remote `manifest.json` and performs atomic hot-swap.
