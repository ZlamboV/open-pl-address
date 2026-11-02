using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    public class BuildingValidationResult
    {
        public bool Exists { get; set; }
        public string? PostalCode { get; set; }
        public List<string> AllPostalCodesForStreet { get; set; } = new List<string>();
        public List<string> AvailableNumbers { get; set; } = new List<string>();
    }
}
