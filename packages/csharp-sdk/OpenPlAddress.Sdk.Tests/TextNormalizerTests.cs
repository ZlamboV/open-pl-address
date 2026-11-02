using OpenPlAddress.Sdk.Utils;
using Xunit;

namespace OpenPlAddress.Sdk.Tests
{
    public class TextNormalizerTests
    {
        [Fact]
        public void StripPolishDiacritics_ConvertsPolishLettersToAscii()
        {
            Assert.Equal("Lodz", TextNormalizer.StripPolishDiacritics("Łódź"));
            Assert.Equal("Krakowskie Przedmiescie", TextNormalizer.StripPolishDiacritics("Krakowskie Przedmieście"));
            Assert.Equal("Swietokrzyska", TextNormalizer.StripPolishDiacritics("Świętokrzyska"));
        }

        [Fact]
        public void TransliterateCyrillic_HandlesUkrainianAndRussianInput()
        {
            Assert.Equal("lublin", TextNormalizer.TransliterateCyrillic("Люблін"));
            Assert.Equal("warszawa", TextNormalizer.TransliterateCyrillic("Варшава"));
            Assert.Equal("wieniawska", TextNormalizer.TransliterateCyrillic("вул. Венявська"));
            Assert.Equal("lipowa", TextNormalizer.TransliterateCyrillic("вулиця Липова"));
        }

        [Fact]
        public void NormalizeText_CanonicalizesProperly()
        {
            Assert.Equal("lodz", TextNormalizer.NormalizeText("  ŁÓDŹ  "));
            Assert.Equal("krakowskie przedmiescie", TextNormalizer.NormalizeText("ul. Krakowskie Przedmieście"));
            Assert.Equal("lublin", TextNormalizer.NormalizeText("Люблін"));
        }

        [Fact]
        public void NormalizePostalCode_FormatsCorrectly()
        {
            Assert.Equal("20-002", TextNormalizer.NormalizePostalCode("20002"));
            Assert.Equal("20-002", TextNormalizer.NormalizePostalCode("20 002"));
            Assert.Equal("20-002", TextNormalizer.NormalizePostalCode("20-002"));
            Assert.Null(TextNormalizer.NormalizePostalCode("invalid"));
        }

        [Fact]
        public void NormalizeBuildingNumber_StripsApartmentsAndFormats()
        {
            Assert.Equal("12A", TextNormalizer.NormalizeBuildingNumber(" 12 a "));
            Assert.Equal("14", TextNormalizer.NormalizeBuildingNumber("14 / 2"));
            Assert.Equal("16", TextNormalizer.NormalizeBuildingNumber("16 m. 4"));
        }
    }
}
