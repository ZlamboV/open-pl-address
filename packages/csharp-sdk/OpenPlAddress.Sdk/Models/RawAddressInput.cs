using System;

namespace OpenPlAddress.Sdk.Models
{
    /// <summary>
    /// Raw unnormalized address input from user, web form, or external system.
    /// </summary>
    public class RawAddressInput
    {
        public string? KodPocztowy { get; set; }
        public string? Miejscowosc { get; set; }
        public string? SimcId { get; set; }
        public string? Ulica { get; set; }
        public string? UlicId { get; set; }
        public string NrDomu { get; set; } = string.Empty;
        public string? NrLokalu { get; set; }
    }
}
