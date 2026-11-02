using System;

namespace OpenPlAddress.Sdk.Models
{
    /// <summary>
    /// Standardized and verified Polish address model formatted for InsERT Gratyfikant nexo and ZUS Płatnik.
    /// </summary>
    public class NormalizedAddress
    {
        public string Wojewodztwo { get; set; } = string.Empty;
        public string Powiat { get; set; } = string.Empty;
        public string Gmina { get; set; } = string.Empty;

        /// <summary>
        /// 7-digit GUS TERYT TERC code (WOJ 2 + POW 2 + GMI 2 + RODZ 1), e.g. "0663011".
        /// Mandatory for ZUS Płatnik and tax declarations.
        /// </summary>
        public string TerytGminaCode { get; set; } = string.Empty;

        public string Miejscowosc { get; set; } = string.Empty;

        /// <summary>
        /// 7-digit GUS TERYT SIMC city/place identifier, e.g. "0954995".
        /// </summary>
        public string SimcId { get; set; } = string.Empty;

        public string? Ulica { get; set; }

        /// <summary>
        /// 5-digit GUS TERYT ULIC street identifier, e.g. "24123", or null for villages without streets.
        /// </summary>
        public string? UlicId { get; set; }

        /// <summary>
        /// Street type prefix: "ul.", "al.", "pl.", "os."
        /// </summary>
        public string? CechaUlicy { get; set; }

        public string NrDomu { get; set; } = string.Empty;
        public string? NrLokalu { get; set; }

        /// <summary>
        /// Standard Polish postal code format "XX-XXX", e.g. "20-002".
        /// </summary>
        public string KodPocztowy { get; set; } = string.Empty;

        public string Poczta { get; set; } = string.Empty;
    }
}
