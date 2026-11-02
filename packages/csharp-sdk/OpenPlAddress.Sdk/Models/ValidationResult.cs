using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    /// <summary>
    /// Result of address validation and export formatting.
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
        public List<string> Suggestions { get; set; } = new List<string>();
        public NormalizedAddress? Normalized { get; set; }
    }
}
