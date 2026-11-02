using System;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using OpenPlAddress.Sdk.Models;

namespace OpenPlAddress.Sdk.Storage
{
    public class DatabaseManager : IDisposable
    {
        private readonly PolishAddressSdkOptions _options;
        private readonly HttpClient _httpClient;
        private Timer? _updateTimer;
        private bool _isUpdating;

        public DatabaseManager(PolishAddressSdkOptions options, HttpClient? httpClient = null)
        {
            _options = options ?? throw new ArgumentNullException(nameof(options));
            _httpClient = httpClient ?? new HttpClient();
        }

        public async Task<string> EnsureDatabaseReadyAsync(CancellationToken cancellationToken = default)
        {
            var dbPath = Path.GetFullPath(_options.DbPath);

            if (!File.Exists(dbPath))
            {
                if (_options.AutoDownloadOnMissing && !string.IsNullOrEmpty(_options.UpdateUrl))
                {
                    await DownloadAndDecompressDatabaseAsync(dbPath, cancellationToken);
                }
                else
                {
                    throw new FileNotFoundException(
                        $"Database file not found at: '{dbPath}'. Please specify an UpdateUrl or provide a pre-compiled pl_addresses.sqlite.",
                        dbPath);
                }
            }

            if (!string.IsNullOrEmpty(_options.UpdateUrl) && _options.AutoUpdateDays > 0)
            {
                StartPeriodicUpdateCheck();
            }

            return dbPath;
        }

        public async Task<bool> CheckForUpdateAsync(CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrEmpty(_options.UpdateUrl) || _isUpdating)
                return false;

            _isUpdating = true;
            try
            {
                var manifestUrl = $"{_options.UpdateUrl!.TrimEnd('/')}/manifest.json";
                var manifestResponse = await _httpClient.GetStringAsync(manifestUrl);
                var manifest = JsonSerializer.Deserialize<ManifestInfo>(manifestResponse, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (manifest == null || string.IsNullOrEmpty(manifest.Sha256))
                    return false;

                var dbPath = Path.GetFullPath(_options.DbPath);
                if (File.Exists(dbPath))
                {
                    var currentSha = CalculateSha256(dbPath);
                    if (string.Equals(currentSha, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                    {
                        return false; // Database is already current
                    }
                }

                // Download to temporary path
                var tempGzPath = $"{dbPath}.swap.gz";
                var tempDbPath = $"{dbPath}.swap.tmp";
                var gzDownloadUrl = $"{_options.UpdateUrl!.TrimEnd('/')}/{manifest.CompressedFile}";

                using (var responseStream = await _httpClient.GetStreamAsync(gzDownloadUrl))
                using (var fs = File.Create(tempGzPath))
                {
                    await responseStream.CopyToAsync(fs, 81920, cancellationToken);
                }

                // Decompress
                using (var fsIn = File.OpenRead(tempGzPath))
                using (var gzip = new GZipStream(fsIn, CompressionMode.Decompress))
                using (var fsOut = File.Create(tempDbPath))
                {
                    await gzip.CopyToAsync(fsOut, 81920, cancellationToken);
                }
                File.Delete(tempGzPath);

                // Verify integrity
                var downloadedSha = CalculateSha256(tempDbPath);
                if (!string.Equals(downloadedSha, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    File.Delete(tempDbPath);
                    throw new InvalidDataException($"Integrity check failed: Expected {manifest.Sha256}, got {downloadedSha}");
                }

                // Hot swap atomically
                AtomicFileReplace(tempDbPath, dbPath);
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[open-pl-address] Background update failed: {ex.Message}");
                return false;
            }
            finally
            {
                _isUpdating = false;
            }
        }

        private async Task DownloadAndDecompressDatabaseAsync(string targetPath, CancellationToken cancellationToken)
        {
            var dir = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var manifestUrl = $"{_options.UpdateUrl!.TrimEnd('/')}/manifest.json";
            ManifestInfo? manifest = null;
            try
            {
                var manifestJson = await _httpClient.GetStringAsync(manifestUrl);
                manifest = JsonSerializer.Deserialize<ManifestInfo>(manifestJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch {}

            var gzFilename = manifest?.CompressedFile ?? "pl_addresses.sqlite.gz";
            var downloadUrl = $"{_options.UpdateUrl!.TrimEnd('/')}/{gzFilename}";

            var tempGz = $"{targetPath}.download.gz";
            var tempDb = $"{targetPath}.download";

            using (var responseStream = await _httpClient.GetStreamAsync(downloadUrl))
            using (var fs = File.Create(tempGz))
            {
                await responseStream.CopyToAsync(fs, 81920, cancellationToken);
            }

            using (var fsIn = File.OpenRead(tempGz))
            using (var gzip = new GZipStream(fsIn, CompressionMode.Decompress))
            using (var fsOut = File.Create(tempDb))
            {
                await gzip.CopyToAsync(fsOut, 81920, cancellationToken);
            }
            File.Delete(tempGz);

            if (manifest?.Sha256 != null)
            {
                var sha = CalculateSha256(tempDb);
                if (!string.Equals(sha, manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                {
                    File.Delete(tempDb);
                    throw new InvalidDataException("Downloaded database failed checksum validation.");
                }
            }

            AtomicFileReplace(tempDb, targetPath);
        }

        private static void AtomicFileReplace(string sourcePath, string targetPath)
        {
            if (File.Exists(targetPath))
            {
                var backup = $"{targetPath}.bak";
                File.Replace(sourcePath, targetPath, backup, true);
                if (File.Exists(backup))
                {
                    try { File.Delete(backup); } catch {}
                }
            }
            else
            {
                File.Move(sourcePath, targetPath);
            }
        }

        public static string CalculateSha256(string filePath)
        {
            using var sha256 = SHA256.Create();
            using var stream = File.OpenRead(filePath);
            var hash = sha256.ComputeHash(stream);
            var sb = new System.Text.StringBuilder(hash.Length * 2);
            foreach (var b in hash) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }

        private void StartPeriodicUpdateCheck()
        {
            var interval = TimeSpan.FromDays(_options.AutoUpdateDays);
            _updateTimer = new Timer(async _ =>
            {
                await CheckForUpdateAsync();
            }, null, interval, interval);
        }

        public void Dispose()
        {
            _updateTimer?.Dispose();
        }
    }
}
