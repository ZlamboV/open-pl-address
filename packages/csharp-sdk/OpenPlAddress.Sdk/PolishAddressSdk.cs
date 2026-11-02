using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using OpenPlAddress.Sdk.Models;
using OpenPlAddress.Sdk.Storage;

namespace OpenPlAddress.Sdk
{
    public class PolishAddressSdk : IPolishAddressSdk
    {
        private readonly PolishAddressSdkOptions _options;
        private readonly DatabaseManager _dbManager;
        private SqliteAddressRepository? _repository;
        private bool _isInitialized;

        public PolishAddressSdk(PolishAddressSdkOptions? options = null)
        {
            _options = options ?? new PolishAddressSdkOptions();
            _dbManager = new DatabaseManager(_options);
        }

        public async Task InitializeAsync(CancellationToken cancellationToken = default)
        {
            if (_isInitialized && _repository != null) return;

            var readyDbPath = await _dbManager.EnsureDatabaseReadyAsync(cancellationToken);
            _repository = new SqliteAddressRepository(readyDbPath);
            _isInitialized = true;
        }

        private SqliteAddressRepository EnsureRepository()
        {
            if (_repository == null)
            {
                var readyDbPath = PathHelper.ResolveFullPath(_options.DbPath);
                _repository = new SqliteAddressRepository(readyDbPath);
                _isInitialized = true;
            }
            return _repository;
        }

        public PostalCodeResult? FindByPostalCode(string postalCode)
        {
            return EnsureRepository().FindByPostalCode(postalCode);
        }

        public List<CityResult> SearchCity(string query, int limit = 10)
        {
            return EnsureRepository().SearchCity(query, limit);
        }

        public List<StreetResult> SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15)
        {
            return EnsureRepository().SearchStreet(simcId, query, postalCode, limit);
        }

        public BuildingValidationResult ValidateBuilding(string simcId, string? ulicId, string buildingNumber)
        {
            return EnsureRepository().ValidateBuilding(simcId, ulicId, buildingNumber);
        }

        public ValidationResult ValidateAndFormatForExport(RawAddressInput input)
        {
            return EnsureRepository().ValidateAndFormatForExport(input);
        }

        public async Task<bool> CheckForUpdateAsync(CancellationToken cancellationToken = default)
        {
            var updated = await _dbManager.CheckForUpdateAsync(cancellationToken);
            if (updated)
            {
                // Reconnect repository to refreshed database file
                _repository?.Dispose();
                var readyDbPath = PathHelper.ResolveFullPath(_options.DbPath);
                _repository = new SqliteAddressRepository(readyDbPath);
            }
            return updated;
        }

        public void Dispose()
        {
            _repository?.Dispose();
            _dbManager.Dispose();
            _isInitialized = false;
        }
    }

    internal static class PathHelper
    {
        public static string ResolveFullPath(string path)
        {
            return System.IO.Path.GetFullPath(path);
        }
    }
}
