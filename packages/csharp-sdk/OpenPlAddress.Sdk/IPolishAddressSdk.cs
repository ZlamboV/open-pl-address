using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using OpenPlAddress.Sdk.Models;

namespace OpenPlAddress.Sdk
{
    public interface IPolishAddressSdk : IDisposable
    {
        Task InitializeAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// 1. Finds administrative location and streets by postal code (XX-XXX).
        /// </summary>
        PostalCodeResult? FindByPostalCode(string postalCode);

        /// <summary>
        /// 2. Instant city search by name, supporting typos, diacritics removal & Cyrillic transliteration.
        /// </summary>
        List<CityResult> SearchCity(string query, int limit = 10);

        /// <summary>
        /// 3. Street autocomplete within a city (for Telegram bot buttons and UI inputs).
        /// </summary>
        List<StreetResult> SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15);

        /// <summary>
        /// 4. Validates building number and returns exact postal code.
        /// </summary>
        BuildingValidationResult ValidateBuilding(string simcId, string? ulicId, string buildingNumber);

        /// <summary>
        /// 5. Resolves official Urząd Skarbowy (Tax Office) in &lt; 1 ms by hierarchy of specificity.
        /// </summary>
        TaxOffice? ResolveTaxOffice(TaxOfficeResolutionInput input);

        /// <summary>
        /// 5b. Resolves official Urząd Skarbowy (Tax Office) in &lt; 1 ms with individual parameters.
        /// </summary>
        TaxOffice? ResolveTaxOffice(string terytCode, string? simcId = null, string? ulicId = null, string? buildingNumber = null);

        /// <summary>
        /// 6. Validates and normalizes raw address input for Gratyfikant nexo and ZUS Płatnik.
        /// </summary>
        ValidationResult ValidateAndFormatForExport(RawAddressInput input);

        /// <summary>
        /// Manually triggers a remote update check and performs hot-swap if a new version is available.
        /// </summary>
        Task<bool> CheckForUpdateAsync(CancellationToken cancellationToken = default);
    }
}
