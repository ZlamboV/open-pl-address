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
                Poczta = "Lublin"
            };

            Assert.Equal("0663011", normalized.TerytGminaCode);
            Assert.Equal("0954995", normalized.SimcId);
            Assert.Equal("24123", normalized.UlicId);

            var result = new ValidationResult
            {
                IsValid = true,
                Normalized = normalized
            };

            Assert.True(result.IsValid);
            Assert.NotNull(result.Normalized);
        }
    }
}
