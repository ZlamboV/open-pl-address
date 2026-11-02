# C# / .NET SDK Reference

The `OpenPlAddress.Sdk` NuGet package provides an embedded, high-performance Polish address validation and tax office resolution library for the .NET ecosystem.

---

## 1. Target Frameworks & Installation

```bash
dotnet add package OpenPlAddress.Sdk
```

### Dual-Targeting Strategy
`OpenPlAddress.Sdk` multi-targets:
1. **`.NET Standard 2.0`**: Compatible with **.NET Framework 4.6.1+**, **.NET Core 2.0+**, and legacy Windows desktop integrations such as **InsERT Gratyfikant nexo** and **Subiekt nexo** (via Sfera API).
2. **`.NET 8.0`**: Optimized for modern, high-throughput cloud microservices, ASP.NET Core APIs, and Linux container environments.

### Core Dependencies
- `Microsoft.Data.Sqlite` (8.0.10+) — Official Microsoft SQLite provider.
- `System.Text.Json` (8.0.5+) — High-performance JSON serializer for `buildings_map` parsing.

---

## 2. Configuration Options (`PolishAddressSdkOptions`)

```csharp
namespace OpenPlAddress.Sdk
{
    public class PolishAddressSdkOptions
    {
        /// <summary>
        /// Absolute or relative path to the SQLite database file.
        /// Defaults to OPEN_PL_ADDRESS_DB_PATH environment variable or './data/pl_addresses.sqlite'.
        /// </summary>
        public string DatabasePath { get; set; } = "./data/pl_addresses.sqlite";

        /// <summary>
        /// Base URL for remote manifest and CalVer releases.
        /// Defaults to 'https://github.com/ZlamboV/open-pl-address/releases/latest/download'.
        /// </summary>
        public string UpdateUrl { get; set; } = "https://github.com/ZlamboV/open-pl-address/releases/latest/download";

        /// <summary>
        /// Background update polling interval in days. Set to 0 to disable automatic checks.
        /// Defaults to 7 days.
        /// </summary>
        public int AutoUpdateDays { get; set; } = 7;

        /// <summary>
        /// If true, downloads and decompresses the database archive if missing upon initialization.
        /// Defaults to true.
        /// </summary>
        public bool AutoDownloadOnMissing { get; set; } = true;
    }
}
```

---

## 3. Public Interface (`IPolishAddressSdk`)

```csharp
namespace OpenPlAddress.Sdk
{
    public interface IPolishAddressSdk : IDisposable
    {
        Task InitializeAsync();
        PostalCodeResult? FindByPostalCode(string postalCode);
        IReadOnlyList<CityResult> SearchCity(string query, int limit = 10);
        IReadOnlyList<StreetResult> SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15);
        BuildingValidationResult ValidateBuilding(string simcId, string? ulicId, string buildingNumber);
        TaxOffice? ResolveTaxOffice(TaxOfficeResolutionInput input);
        ValidationResult ValidateAndFormatForExport(RawAddressInput input);
        Task<bool> CheckForUpdateAsync();
    }
}
```

---

## 4. Method Reference & Descriptions

### 4.1 `InitializeAsync(): Task`
Initializes the SDK asynchronously:
- Verifies database file existence or downloads `pl_addresses.sqlite.gz` from `UpdateUrl`.
- Validates SHA256 integrity and decompresses using `System.IO.Compression.GZipStream`.
- Configures SQLite connection with `Mode=ReadOnly`, `Cache=Shared`, and WAL journal pragmas.
- Starts background polling worker if `AutoUpdateDays > 0`.

---

### 4.2 `FindByPostalCode(string postalCode): PostalCodeResult?`
Queries the inverted postal index for all cities and streets linked to a given `XX-XXX` code.

```csharp
var postalInfo = sdk.FindByPostalCode("20-029");
if (postalInfo != null)
{
    Console.WriteLine($"Postal Code: {postalInfo.PostalCode}");
    foreach (var city in postalInfo.Cities)
    {
        Console.WriteLine($"City: {city.Name} (TERC: {city.TerytCode})");
    }
}
```

---

### 4.3 `SearchCity(string query, int limit = 10): IReadOnlyList<CityResult>`
Performs full-text search with Polish diacritic stripping and Cyrillic transliteration.

```csharp
var cities = sdk.SearchCity("Краков", 5);
foreach (var city in cities)
{
    Console.WriteLine($"{city.Name} (SIMC: {city.SimcId}, Powiat: {city.Powiat}, Woj: {city.Wojewodztwo})");
}
```

---

### 4.4 `SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15): IReadOnlyList<StreetResult>`
Autocompletes street names within a specified city.

```csharp
var streets = sdk.SearchStreet("0954995", "wieniaw");
foreach (var street in streets)
{
    Console.WriteLine($"{street.Cecha} {street.Name} (ULIC: {street.UlicId})");
}
```

---

### 4.5 `ValidateBuilding(string simcId, string? ulicId, string buildingNumber): BuildingValidationResult`
Checks if a house number exists in official PRG address points for the street or streetless village.

```csharp
var validation = sdk.ValidateBuilding("0954995", "24123", "12");
Console.WriteLine($"Exists: {validation.Exists}");
Console.WriteLine($"Assigned Postal Code: {validation.PostalCode}");
```

---

### 4.6 `ResolveTaxOffice(TaxOfficeResolutionInput input): TaxOffice?`
Executes the 4-tier waterfall algorithm to identify the competent Urząd Skarbowy.

```csharp
var taxOffice = sdk.ResolveTaxOffice(new TaxOfficeResolutionInput
{
    TerytCode = "0663011",
    SimcId = "0954995",
    UlicId = "11181",
    BuildingNumber = "5"
});

Console.WriteLine($"Tax Office: {taxOffice?.Name} (Code: {taxOffice?.UsCode})");
```

---

### 4.7 `ValidateAndFormatForExport(RawAddressInput input): ValidationResult`
Validates full address and produces a canonical `NormalizedAddress` ready for ZUS Płatnik and InsERT Gratyfikant nexo.

```csharp
var result = sdk.ValidateAndFormatForExport(new RawAddressInput
{
    Miejscowosc = "Lublin",
    Ulica = "Wieniawska",
    NrDomu = "12",
    NrLokalu = "4"
});

if (result.IsValid && result.Normalized != null)
{
    var norm = result.Normalized;
    Console.WriteLine($"ZUS TERC: {norm.TerytGminaCode}");
    Console.WriteLine($"Tax Office: {result.TaxOffice?.Name} ({result.TaxOffice?.UsCode})");
}
```

---

## 5. Dependency Injection Setup in ASP.NET Core

To register `IPolishAddressSdk` inside an ASP.NET Core `IServiceCollection`:

```csharp
using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using OpenPlAddress.Sdk;

public static class PolishAddressServiceExtensions
{
    public static IServiceCollection AddPolishAddressSdk(
        this IServiceCollection services,
        Action<PolishAddressSdkOptions>? configure = null)
    {
        var options = new PolishAddressSdkOptions();
        configure?.Invoke(options);

        // Register as Singleton since the SQLite database is thread-safe and read-only
        services.AddSingleton<IPolishAddressSdk>(sp =>
        {
            var sdk = new PolishAddressSdk(options);
            sdk.InitializeAsync().GetAwaiter().GetResult();
            return sdk;
        });

        return services;
    }
}
```

In `Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register PolishAddressSDK
builder.Services.AddPolishAddressSdk(options =>
{
    options.DatabasePath = builder.Configuration["AddressDatabase:Path"] ?? "./data/pl_addresses.sqlite";
    options.AutoUpdateDays = 7;
});

builder.Services.AddControllers();
var app = builder.Build();

app.MapControllers();
app.Run();
```

### Controller Usage

```csharp
using Microsoft.AspNetCore.Mvc;
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

[ApiController]
[Route("api/[controller]")]
public class AddressController : ControllerBase
{
    private readonly IPolishAddressSdk _addressSdk;

    public AddressController(IPolishAddressSdk addressSdk)
    {
        _addressSdk = addressSdk;
    }

    [HttpPost("validate")]
    public ActionResult<ValidationResult> Validate([FromBody] RawAddressInput input)
    {
        var result = _addressSdk.ValidateAndFormatForExport(input);
        if (!result.IsValid)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpGet("cities")]
    public ActionResult<IReadOnlyList<CityResult>> SearchCities([FromQuery] string query, [FromQuery] int limit = 10)
    {
        return Ok(_addressSdk.SearchCity(query, limit));
    }
}
```
