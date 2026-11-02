# Recipe 2: InsERT Gratyfikant nexo Sfera Integration (C# / .NET)

**InsERT Gratyfikant nexo** is one of the leading payroll and HR ERP systems in Poland. Through its **Sfera API** (`InsERT.Moria.Sfera`), developers can automate employee onboarding, contract generation, and tax filing.

To create valid employee files for Polish social security and PIT tax cards, Gratyfikant nexo strictly requires:
1. Canonical Polish address components (`Ulica`, `NrDomu`, `NrLokalu`, `Miejscowosc`, `KodPocztowy`).
2. Official GUS administrative division (`Gmina` / 7-digit TERC code).
3. The specific competent **Urząd Skarbowy (Tax Office)** linked to the employee's place of residence.

This recipe demonstrates how to combine `OpenPlAddress.Sdk` with InsERT Sfera in C#.

---

## 1. Setup & Dependencies

Install the SDK via NuGet:

```bash
dotnet add package OpenPlAddress.Sdk
```

Ensure your project references InsERT nexo Sfera assemblies (typically available in `C:\Program Files\InsERT\nexo\`):
- `InsERT.Moria.Sfera.dll`
- `InsERT.Mox.Product.dll`

---

## 2. Integration Implementation

```csharp
using System;
using System.Linq;
using System.Threading.Tasks;
using InsERT.Moria.ModelDanych;
using InsERT.Moria.Pracownicy;
using InsERT.Moria.Sfera;
using OpenPlAddress.Sdk;
using OpenPlAddress.Sdk.Models;

namespace GratyfikantAddressSync
{
    public class GratyfikantEmployeeService
    {
        private readonly IPolishAddressSdk _addressSdk;
        private readonly Uchwyt _sfera;

        public GratyfikantEmployeeService(IPolishAddressSdk addressSdk, Uchwyt sfera)
        {
            _addressSdk = addressSdk;
            _sfera = sfera;
        }

        /// <summary>
        /// Validates employee address and creates/updates employee in Gratyfikant nexo with exact Tax Office.
        /// </summary>
        public async Task CreateOrUpdateEmployeeWithVerifiedAddressAsync(
            string pesel,
            string imie,
            string nazwisko,
            RawAddressInput rawAddress)
        {
            // 1. Verify address via OpenPlAddress Embedded SDK (< 1 ms)
            var validation = _addressSdk.ValidateAndFormatForExport(rawAddress);

            if (!validation.IsValid)
            {
                throw new InvalidOperationException(
                    $"Address validation failed: {string.Join(", ", validation.Errors)}");
            }

            var norm = validation.Normalized!;
            var taxOffice = validation.TaxOffice;

            // 2. Access Gratyfikant nexo Managers
            var pracownicyManager = _sfera.PodajObiektTypu<IPracownicy>();
            var instytucjeManager = _sfera.PodajObiektTypu<InsERT.Moria.Instytucje.IInstytucje>();

            using var pracownikBiz = pracownicyManager.Znajdz(p => p.Osoba.PESEL == pesel) 
                                      ?? pracownicyManager.Utworz();

            var pracownik = pracownikBiz.Dane;
            pracownik.Osoba.ImiePierwsze = imie;
            pracownik.Osoba.Nazwisko = nazwisko;
            pracownik.Osoba.PESEL = pesel;

            // 3. Map Canonical Address to Pracownik.Osoba.AdresZamieszkania
            // NOTE: In Polish tax law, Adres Zamieszkania (place of residence) is what determines PIT-11!
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

            // 4. Resolve and Link Competent Urząd Skarbowy (4-digit MF code)
            if (taxOffice != null)
            {
                // Find existing Urząd Skarbowy in nexo database by MF code or official name
                var urzadSkarbowy = instytucjeManager.Dane
                    .OfType<UrzadSkarbowy>()
                    .FirstOrDefault(u => u.KodMF == taxOffice.UsCode || u.Nazwa.Contains(taxOffice.Name));

                if (urzadSkarbowy != null)
                {
                    pracownik.DanePodatkowe.UrzadSkarbowy = urzadSkarbowy;
                }
                else
                {
                    Console.WriteLine(
                        $"[WARN] Tax Office {taxOffice.UsCode} ({taxOffice.Name}) not found in nexo dictionary. Please verify dictionary entries.");
                }
            }

            // 5. Commit to InsERT database
            if (pracownikBiz.Zapisz())
            {
                Console.WriteLine($"[SUCCESS] Employee {imie} {nazwisko} saved with verified address & US {taxOffice?.UsCode}.");
            }
            else
            {
                var errors = string.Join("; ", pracownikBiz.WypiszBledy());
                throw new Exception($"Failed to save employee to Gratyfikant nexo: {errors}");
            }
        }
    }
}
```

---

## 3. Best Practices for InsERT nexo Integrations
1. **Always use `AdresZamieszkania` instead of `AdresZameldowania`**:
   `AdresZamieszkania` is the legal source for PIT-11 and PIT-4R tax calculations.
2. **Handle Villages Without Streets**:
   In Polish villages (e.g. `Biskupice`), the village name is placed in `Miejscowosc`, and `Ulica` remains blank (`null` or `string.Empty`).
3. **Automate Update Sync**:
   Configure `OpenPlAddress.Sdk` with `AutoUpdateDays = 7` so that any street boundary or tax office changes published in official CRD schemas are downloaded and hot-swapped automatically.
