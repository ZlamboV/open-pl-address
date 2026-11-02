using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    public class CityResult
    {
        public string SimcId { get; set; } = string.Empty;
        public string TerytCode { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Wojewodztwo { get; set; } = string.Empty;
        public string Powiat { get; set; } = string.Empty;
        public string Gmina { get; set; } = string.Empty;
        public List<string> PostalCodes { get; set; } = new List<string>();
    }
}
