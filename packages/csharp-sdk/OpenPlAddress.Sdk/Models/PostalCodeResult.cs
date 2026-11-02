using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    public class PostalCodeCityStreet
    {
        public long Id { get; set; }
        public string? UlicId { get; set; }
        public string Cecha { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
    }

    public class PostalCodeCity
    {
        public string SimcId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Wojewodztwo { get; set; } = string.Empty;
        public string Powiat { get; set; } = string.Empty;
        public string Gmina { get; set; } = string.Empty;
        public string TerytCode { get; set; } = string.Empty;
        public List<PostalCodeCityStreet> Streets { get; set; } = new List<PostalCodeCityStreet>();
    }

    public class PostalCodeResult
    {
        public string PostalCode { get; set; } = string.Empty;
        public List<PostalCodeCity> Cities { get; set; } = new List<PostalCodeCity>();
    }
}
