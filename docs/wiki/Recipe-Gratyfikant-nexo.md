# Recipe: InsERT Gratyfikant nexo Sfera Integration (C#)

**InsERT Gratyfikant nexo** is one of Poland's most widely deployed ERP systems for human resources, payroll, and civil contracts. Through its **Sfera API** (`InsERT.Moria.Sfera`), developers can automate employee onboarding, contract generation, and tax filing.

To create valid employee files for Polish social security and PIT tax cards, Gratyfikant nexo strictly requires:
1. Canonical Polish address components (`Ulica`, `NrDomu`, `NrLokalu`, `Miejscowosc`, `KodPocztowy`).
2. Official GUS administrative division (`Gmina` / 7-digit TERC code).
3. The specific competent **Urząd Skarbowy (Tax Office)** linked to the employee's place of residence.

This recipe demonstrates how to combine `OpenPlAddress.Sdk` with InsERT Sfera in C#.

---

## 1. Prerequisites & Sfera References

Add the `OpenPlAddress.Sdk` NuGet package:

```bash
dotnet add package OpenPlAddress.Sdk
```

Ensure your project references the official InsERT nexo Sfera assemblies (typically located in `C:\Program Files\InsERT\nexo\`):
- `InsERT.Moria.Sfera.dll`
- `InsERT.Moria.ModelDanych.dll`
- `InsERT.Moria.Pracownicy.dll`
- `InsERT.Mox.Product.dll`

Because `OpenPlAddress.Sdk` multi-targets `.NET Standard 2.0`, it runs natively inside .NET Framework 4.7.2+ and .NET 8 Sfera plugins.

---

## 2. Complete C# Implementation

```csharp
using System;
using System.Linq;
using System.Threading.Tasks;
using InsERT.Moria.ModelDanych;
using InsERT.Moria.Pracownicy;
using InsERT.Moria.Instytucje;
using InsERT.Moria.Sfera;
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

namespace GratyfikantIntegration
{
    public class GratyfikantEmployeeService
    {
        private readonly IPolishAddressSdk _addressSdk;
        private readonly Uchwyt _sfera;

        public GratyfikantEmployeeService(IPolishAddressSdk addressSdk, Uchwyt sfera)
        {
            _addressSdk = addressSdk ?? throw new ArgumentNullException(nameof(addressSdk));
            _sfera = sfera ?? throw new ArgumentNullException(nameof(sfera));
        }

        /// <summary>
        /// Validates employee address and saves or updates an employee in Gratyfikant nexo
        /// with verified address data and exact competent Urząd Skarbowy.
        /// </summary>
        public async Task CreateOrUpdateEmployeeAsync(
            string pesel,
            string imie,
            string nazwisko,
            RawAddressInput rawAddress)
        {
            // 1. Validate address in-process (< 1 ms latency)
            var validation = _addressSdk.ValidateAndFormatForExport(rawAddress);

            if (!validation.IsValid || validation.Normalized == null)
            {
                var errors = string.Join("; ", validation.Errors);
                throw new InvalidOperationException($"Invalid employee address: {errors}");
            }

            var norm = validation.Normalized;
            var taxOffice = validation.TaxOffice;

            // 2. Open Gratyfikant Managers via Sfera
            var pracownicyManager = _sfera.PodajObiektTypu<IPracownicy>();
            var instytucjeManager = _sfera.PodajObiektTypu<IInstytucje>();

            // Find existing employee or create new
            using var pracownikBiz = pracownicyManager.Znajdz(p => p.Osoba.PESEL == pesel)
                                      ?? pracownicyManager.Utworz();

            var pracownik = pracownikBiz.Dane;
            pracownik.Osoba.ImiePierwsze = imie;
            pracownik.Osoba.Nazwisko = nazwisko;
            pracownik.Osoba.PESEL = pesel;

            // 3. Map Canonical Address to Pracownik.Osoba.AdresZamieszkania
            // NOTE: In Polish tax law, AdresZamieszkania (place of residence) is what determines PIT-11!
            var adres = pracownik.Osoba.AdresZamieszkania;
            adres.Linia1 = string.IsNullOrEmpty(norm.Ulica)
                ? norm.Miejscowosc
                : $"{norm.CechaUlicy} {norm.Ulica}";

            adres.NrDomu = norm.NrDomu;
            adres.NrLokalu = norm.NrLokalu ?? string.Empty;
            adres.KodPocztowy = norm.KodPocztowy;
            adres.Miejscowosc = norm.Miejscowosc;
            adres.Gmina = norm.Gmina;
            adres.Powiat = norm.Powiat;
            adres.Wojewodztwo = norm.Wojewodztwo;
            adres.Panstwo = "Polska";

            // 4. Resolve and Assign Competent Urząd Skarbowy
            if (taxOffice != null)
            {
                // Find existing Urząd Skarbowy in nexo dictionary by 4-digit MF CRD code or name
                var urzadSkarbowy = instytucjeManager.Dane
                    .OfType<UrzadSkarbowy>()
                    .FirstOrDefault(u => u.KodMF == taxOffice.UsCode || u.Nazwa.Contains(taxOffice.Name));

                if (urzadSkarbowy != null)
                {
                    pracownik.DanePodatkowe.UrzadSkarbowy = urzadSkarbowy;
                }
                else
                {
                    Console.WriteLine($"[WARN] Tax office {taxOffice.UsCode} ({taxOffice.Name}) not found in nexo dictionary. Please verify Sfera dictionaries.");
                }
            }

            // 5. Commit changes to InsERT nexo database
            if (pracownikBiz.Zapisz())
            {
                Console.WriteLine($"[SUCCESS] Saved employee {imie} {nazwisko} with verified address & US {taxOffice?.UsCode}.");
            }
            else
            {
                var failureErrors = string.Join("; ", pracownikBiz.WypiszBledy());
                throw new Exception($"Failed to save employee to Gratyfikant nexo: {failureErrors}");
            }
        }
    }
}
```

---

## 3. Best Practices for InsERT nexo Integrations

1. **Always Populate `AdresZamieszkania`, Never Only `AdresZameldowania`**:
   Gratyfikant nexo calculates PIT-11 and PIT-4R tax forms based on `AdresZamieszkania`. If left blank, tax returns default to company headquarters, resulting in audit fines.
2. **Handle Villages Without Streets Correctly**:
   When `norm.Ulica` is null or empty, assign `norm.Miejscowosc` directly to `adres.Linia1`. Sfera requires a non-empty `Linia1`.
3. **Automate Monthly CalVer Synchronization**:
   Instantiate `PolishAddressSdk` with `AutoUpdateDays = 7`. When the Polish Ministry of Finance publishes modifications to tax office boundaries, the SDK updates the database automatically via zero-downtime hot-swap.
