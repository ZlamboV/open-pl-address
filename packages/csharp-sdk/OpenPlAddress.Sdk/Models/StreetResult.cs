using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    public class StreetResult
    {
        public long Id { get; set; }
        public string SimcId { get; set; } = string.Empty;
        public string? UlicId { get; set; }
        public string Cecha { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public List<string> PostalCodes { get; set; } = new List<string>();
    }
}
