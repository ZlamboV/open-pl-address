namespace OpenPlAddress.Sdk.Models
{
    /// <summary>
    /// Official Polish Tax Office (Urząd Skarbowy) model.
    /// Used for employee tax mapping, InsERT Gratyfikant nexo and PIT-11 / PIT-37 declarations.
    /// </summary>
    public class TaxOffice
    {
        /// <summary>
        /// 4-digit code assigned by Ministerstwo Finansów (e.g. "0610").
        /// </summary>
        public string UsCode { get; set; } = string.Empty;

        /// <summary>
        /// Official name of the Tax Office (e.g. "Pierwszy Urząd Skarbowy w Lublinie").
        /// </summary>
        public string Name { get; set; } = string.Empty;

        public string? City { get; set; }
        public string? Street { get; set; }
        public string? PostalCode { get; set; }
    }
}
