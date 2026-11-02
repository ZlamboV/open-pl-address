namespace OpenPlAddress.Sdk.Models
{
    /// <summary>
    /// Parameters for determining Urząd Skarbowy (Tax Office) by address specificity hierarchy.
    /// </summary>
    public class TaxOfficeResolutionInput
    {
        /// <summary>
        /// 7-digit GUS TERC code (e.g. "0663011").
        /// </summary>
        public string TerytCode { get; set; } = string.Empty;

        /// <summary>
        /// Optional 7-digit SIMC identifier (e.g. "0954995").
        /// </summary>
        public string? SimcId { get; set; }

        /// <summary>
        /// Optional 5-digit ULIC identifier (e.g. "24123").
        /// </summary>
        public string? UlicId { get; set; }

        /// <summary>
        /// Optional building number (e.g. "12", "12A", "15/17").
        /// </summary>
        public string? BuildingNumber { get; set; }
    }
}
