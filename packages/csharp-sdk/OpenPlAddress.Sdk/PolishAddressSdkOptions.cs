using System;

namespace OpenPlAddress.Sdk
{
    public class PolishAddressSdkOptions
    {
        /// <summary>
        /// Local path to the pl_addresses.sqlite database file.
        /// </summary>
        public string DbPath { get; set; } = "./data/pl_addresses.sqlite";

        /// <summary>
        /// Remote base URL hosting manifest.json and pl_addresses.sqlite.gz.
        /// </summary>
        public string? UpdateUrl { get; set; }

        /// <summary>
        /// Update check interval in days. Default is 7.
        /// </summary>
        public int AutoUpdateDays { get; set; } = 7;

        /// <summary>
        /// Whether to automatically download the database on initialization if missing locally.
        /// </summary>
        public bool AutoDownloadOnMissing { get; set; } = true;
    }
}
