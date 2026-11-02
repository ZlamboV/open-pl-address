using System.Collections.Generic;

namespace OpenPlAddress.Sdk.Models
{
    public class ManifestCounts
    {
        public int Terc { get; set; }
        public int Cities { get; set; }
        public int Streets { get; set; }
        public int PostalCodes { get; set; }
    }

    public class ManifestInfo
    {
        public string Version { get; set; } = string.Empty;
        public string BuiltAt { get; set; } = string.Empty;
        public string DatabaseFile { get; set; } = string.Empty;
        public string CompressedFile { get; set; } = string.Empty;
        public string Sha256 { get; set; } = string.Empty;
        public string Sha256Compressed { get; set; } = string.Empty;
        public long UncompressedSizeBytes { get; set; }
        public long CompressedSizeBytes { get; set; }
        public ManifestCounts Counts { get; set; } = new ManifestCounts();
    }
}
