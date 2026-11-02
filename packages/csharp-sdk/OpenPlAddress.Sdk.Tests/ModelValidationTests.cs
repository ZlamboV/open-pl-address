using System.IO;
using OpenPlAddress.Sdk.Models;
using Xunit;

namespace OpenPlAddress.Sdk.Tests
{
    public class ModelValidationTests
    {
        [Fact]
        public void Models_CanBeInstantiatedAndSerialized()
        {
            var raw = new RawAddressInput
            {
                Miejscowosc = "Lublin",
                Ulica = "Wieniawska",
                NrDomu = "12",
                NrLokalu = "4",
                KodPocztowy = "20-029"
            };

            Assert.Equal("Lublin", raw.Miejscowosc);
            Assert.Equal("12", raw.NrDomu);

            var taxOffice = new TaxOffice
            {
                UsCode = "0610",
                Name = "Pierwszy Urząd Skarbowy w Lublinie",
                City = "Lublin",
                Street = "ul. Sądowa 5",
                PostalCode = "20-027"
            };

            var normalized = new NormalizedAddress
            {
                Wojewodztwo = "LUBELSKIE",
                Powiat = "m. Lublin",
                Gmina = "Lublin",
                TerytGminaCode = "0663011",
                Miejscowosc = "Lublin",
                SimcId = "0954995",
                Ulica = "Wieniawska",
                UlicId = "24123",
                CechaUlicy = "ul.",
                NrDomu = "12",
                NrLokalu = "4",
                KodPocztowy = "20-029",
                Poczta = "Lublin",
                TaxOffice = taxOffice
            };

            Assert.Equal("0663011", normalized.TerytGminaCode);
            Assert.Equal("0954995", normalized.SimcId);
            Assert.Equal("24123", normalized.UlicId);
            Assert.NotNull(normalized.TaxOffice);
            Assert.Equal("0610", normalized.TaxOffice.UsCode);

            var result = new ValidationResult
            {
                IsValid = true,
                Normalized = normalized,
                TaxOffice = taxOffice
            };

            Assert.True(result.IsValid);
            Assert.NotNull(result.Normalized);
            Assert.NotNull(result.TaxOffice);
            Assert.Equal("0610", result.TaxOffice.UsCode);
        }

        [Fact]
        public void TaxOfficeResolutionInput_CanBeInstantiated()
        {
            var input = new TaxOfficeResolutionInput
            {
                TerytCode = "0663011",
                SimcId = "0954995",
                UlicId = "24123",
                BuildingNumber = "12"
            };

            Assert.Equal("0663011", input.TerytCode);
            Assert.Equal("0954995", input.SimcId);
            Assert.Equal("24123", input.UlicId);
            Assert.Equal("12", input.BuildingNumber);
        }
    }
}
