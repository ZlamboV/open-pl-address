using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using OpenPlAddress.Sdk.Models;
using OpenPlAddress.Sdk.Utils;

namespace OpenPlAddress.Sdk.Storage
{
    public class SqliteAddressRepository : IDisposable
    {
        private readonly SqliteConnection _connection;

        public SqliteAddressRepository(string dbPath)
        {
            var connectionString = new SqliteConnectionStringBuilder
            {
                DataSource = dbPath,
                Mode = SqliteOpenMode.ReadOnly
            }.ToString();

            _connection = new SqliteConnection(connectionString);
            _connection.Open();
        }

        public SqliteAddressRepository(SqliteConnection existingConnection)
        {
            _connection = existingConnection ?? throw new ArgumentNullException(nameof(existingConnection));
            if (_connection.State != System.Data.ConnectionState.Open)
            {
                _connection.Open();
            }
        }

        public PostalCodeResult? FindByPostalCode(string postalCode)
        {
            var normalizedPna = TextNormalizer.NormalizePostalCode(postalCode);
            if (string.IsNullOrEmpty(normalizedPna)) return null;

            const string sql = @"
                SELECT 
                    p.simc_id,
                    p.street_id,
                    c.name as city_name,
                    c.postal_codes as city_postal_codes,
                    t.teryt_code,
                    t.wojewodztwo,
                    t.powiat,
                    t.gmina,
                    s.ulic_id,
                    s.cecha,
                    s.name as street_name
                FROM postal_code_index p
                JOIN cities c ON c.simc_id = p.simc_id
                JOIN terc t ON t.teryt_code = c.teryt_code
                LEFT JOIN streets s ON s.id = p.street_id
                WHERE p.postal_code = $postalCode";

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("$postalCode", normalizedPna);

            using var reader = cmd.ExecuteReader();
            var cityMap = new Dictionary<string, PostalCodeCity>();

            while (reader.Read())
            {
                var simcId = reader.GetString(0);
                if (!cityMap.TryGetValue(simcId, out var city))
                {
                    city = new PostalCodeCity
                    {
                        SimcId = simcId,
                        Name = reader.GetString(2),
                        TerytCode = reader.GetString(4),
                        Wojewodztwo = reader.GetString(5),
                        Powiat = reader.GetString(6),
                        Gmina = reader.GetString(7),
                        Streets = new List<PostalCodeCityStreet>()
                    };
                    cityMap[simcId] = city;
                }

                if (!reader.IsDBNull(1) && !reader.IsDBNull(10))
                {
                    city.Streets.Add(new PostalCodeCityStreet
                    {
                        Id = reader.GetInt64(1),
                        UlicId = reader.IsDBNull(8) ? null : reader.GetString(8),
                        Cecha = reader.IsDBNull(9) ? "" : reader.GetString(9),
                        Name = reader.GetString(10)
                    });
                }
            }

            if (cityMap.Count == 0) return null;

            return new PostalCodeResult
            {
                PostalCode = normalizedPna!,
                Cities = cityMap.Values.ToList()
            };
        }

        public List<CityResult> SearchCity(string query, int limit = 10)
        {
            var normalized = TextNormalizer.NormalizeText(query);
            if (string.IsNullOrWhiteSpace(normalized)) return new List<CityResult>();

            var results = new List<CityResult>();
            var seenSimcs = new HashSet<string>();

            // 1. Try FTS5
            try
            {
                const string ftsSql = @"
                    SELECT 
                        c.simc_id,
                        c.teryt_code,
                        c.name,
                        c.postal_codes,
                        t.wojewodztwo,
                        t.powiat,
                        t.gmina
                    FROM cities_fts f
                    JOIN cities c ON c.simc_id = f.simc_id
                    JOIN terc t ON t.teryt_code = c.teryt_code
                    WHERE cities_fts MATCH $matchQuery
                    LIMIT $limit";

                using var ftsCmd = _connection.CreateCommand();
                ftsCmd.CommandText = ftsSql;
                ftsCmd.Parameters.AddWithValue("$matchQuery", $"{normalized}*");
                ftsCmd.Parameters.AddWithValue("$limit", limit);

                using var reader = ftsCmd.ExecuteReader();
                while (reader.Read())
                {
                    var simc = reader.GetString(0);
                    if (seenSimcs.Add(simc))
                    {
                        results.Add(new CityResult
                        {
                            SimcId = simc,
                            TerytCode = reader.GetString(1),
                            Name = reader.GetString(2),
                            PostalCodes = SafeParseStringArray(reader.GetString(3)),
                            Wojewodztwo = reader.GetString(4),
                            Powiat = reader.GetString(5),
                            Gmina = reader.GetString(6)
                        });
                    }
                }
            }
            catch {}

            // 2. LIKE fallback
            if (results.Count < limit)
            {
                var remaining = limit - results.Count;
                const string likeSql = @"
                    SELECT 
                        c.simc_id,
                        c.teryt_code,
                        c.name,
                        c.postal_codes,
                        t.wojewodztwo,
                        t.powiat,
                        t.gmina
                    FROM cities c
                    JOIN terc t ON t.teryt_code = c.teryt_code
                    WHERE c.name_normalized LIKE $likeQuery
                    LIMIT $limit";

                using var likeCmd = _connection.CreateCommand();
                likeCmd.CommandText = likeSql;
                likeCmd.Parameters.AddWithValue("$likeQuery", $"{normalized}%");
                likeCmd.Parameters.AddWithValue("$limit", remaining);

                using var reader = likeCmd.ExecuteReader();
                while (reader.Read())
                {
                    var simc = reader.GetString(0);
                    if (seenSimcs.Add(simc))
                    {
                        results.Add(new CityResult
                        {
                            SimcId = simc,
                            TerytCode = reader.GetString(1),
                            Name = reader.GetString(2),
                            PostalCodes = SafeParseStringArray(reader.GetString(3)),
                            Wojewodztwo = reader.GetString(4),
                            Powiat = reader.GetString(5),
                            Gmina = reader.GetString(6)
                        });
                    }
                }
            }

            return results;
        }

        public List<StreetResult> SearchStreet(string simcId, string query, string? postalCode = null, int limit = 15)
        {
            var normalized = TextNormalizer.NormalizeText(query);
            var normalizedPna = !string.IsNullOrEmpty(postalCode) ? TextNormalizer.NormalizePostalCode(postalCode) : null;

            var results = new List<StreetResult>();
            var seenIds = new HashSet<long>();

            // 1. Try FTS5
            if (!string.IsNullOrWhiteSpace(normalized))
            {
                try
                {
                    const string ftsSql = @"
                        SELECT 
                            s.id,
                            s.simc_id,
                            s.ulic_id,
                            s.cecha,
                            s.name,
                            s.buildings_map
                        FROM streets_fts f
                        JOIN streets s ON s.id = f.street_id
                        WHERE f.simc_id = $simcId AND streets_fts MATCH $matchQuery
                        LIMIT $limit";

                    using var ftsCmd = _connection.CreateCommand();
                    ftsCmd.CommandText = ftsSql;
                    ftsCmd.Parameters.AddWithValue("$simcId", simcId);
                    ftsCmd.Parameters.AddWithValue("$matchQuery", $"{normalized}*");
                    ftsCmd.Parameters.AddWithValue("$limit", limit);

                    using var reader = ftsCmd.ExecuteReader();
                    while (reader.Read())
                    {
                        var id = reader.GetInt64(0);
                        if (seenIds.Add(id))
                        {
                            var bMap = SafeParseBuildingsMap(reader.GetString(5));
                            var codes = bMap.Keys.ToList();
                            if (normalizedPna != null && codes.Count > 0 && !codes.Contains(normalizedPna))
                            {
                                continue;
                            }

                            results.Add(new StreetResult
                            {
                                Id = id,
                                SimcId = reader.GetString(1),
                                UlicId = reader.IsDBNull(2) ? null : reader.GetString(2),
                                Cecha = reader.GetString(3),
                                Name = reader.GetString(4),
                                PostalCodes = codes
                            });
                        }
                    }
                }
                catch {}
            }

            // 2. LIKE fallback
            if (results.Count < limit)
            {
                var remaining = limit - results.Count;
                var pattern = !string.IsNullOrWhiteSpace(normalized) ? $"{normalized}%" : "%";

                const string likeSql = @"
                    SELECT 
                        s.id,
                        s.simc_id,
                        s.ulic_id,
                        s.cecha,
                        s.name,
                        s.buildings_map
                    FROM streets s
                    WHERE s.simc_id = $simcId AND s.name_normalized LIKE $pattern
                    LIMIT $limit";

                using var likeCmd = _connection.CreateCommand();
                likeCmd.CommandText = likeSql;
                likeCmd.Parameters.AddWithValue("$simcId", simcId);
                likeCmd.Parameters.AddWithValue("$pattern", pattern);
                likeCmd.Parameters.AddWithValue("$limit", remaining);

                using var reader = likeCmd.ExecuteReader();
                while (reader.Read())
                {
                    var id = reader.GetInt64(0);
                    if (seenIds.Add(id))
                    {
                        var bMap = SafeParseBuildingsMap(reader.GetString(5));
                        var codes = bMap.Keys.ToList();
                        if (normalizedPna != null && codes.Count > 0 && !codes.Contains(normalizedPna))
                        {
                            continue;
                        }

                        results.Add(new StreetResult
                        {
                            Id = id,
                            SimcId = reader.GetString(1),
                            UlicId = reader.IsDBNull(2) ? null : reader.GetString(2),
                            Cecha = reader.GetString(3),
                            Name = reader.GetString(4),
                            PostalCodes = codes
                        });
                    }
                }
            }

            return results;
        }

        public BuildingValidationResult ValidateBuilding(string simcId, string? ulicId, string buildingNumber)
        {
            var normBld = TextNormalizer.NormalizeBuildingNumber(buildingNumber);

            string? buildingsMapJson = null;

            if (!string.IsNullOrEmpty(ulicId))
            {
                using var cmd = _connection.CreateCommand();
                cmd.CommandText = "SELECT buildings_map FROM streets WHERE simc_id = $simc AND ulic_id = $ulic LIMIT 1";
                cmd.Parameters.AddWithValue("$simc", simcId);
                cmd.Parameters.AddWithValue("$ulic", ulicId);
                var scalar = cmd.ExecuteScalar();
                if (scalar != null && scalar != DBNull.Value)
                    buildingsMapJson = scalar.ToString();
            }
            else
            {
                using var cmd = _connection.CreateCommand();
                cmd.CommandText = "SELECT buildings_map FROM streets WHERE simc_id = $simc AND ulic_id IS NULL LIMIT 1";
                cmd.Parameters.AddWithValue("$simc", simcId);
                var scalar = cmd.ExecuteScalar();
                if (scalar != null && scalar != DBNull.Value)
                    buildingsMapJson = scalar.ToString();
            }

            if (string.IsNullOrEmpty(buildingsMapJson))
            {
                return new BuildingValidationResult { Exists = false };
            }

            var bMap = SafeParseBuildingsMap(buildingsMapJson!);
            var allCodes = bMap.Keys.ToList();
            var availableNumbers = new List<string>();
            string? matchedPna = null;

            foreach (var kvp in bMap)
            {
                foreach (var num in kvp.Value)
                {
                    availableNumbers.Add(num);
                    if (num.Equals(normBld, StringComparison.OrdinalIgnoreCase))
                    {
                        matchedPna = kvp.Key;
                    }
                }
            }

            return new BuildingValidationResult
            {
                Exists = matchedPna != null,
                PostalCode = matchedPna,
                AllPostalCodesForStreet = allCodes,
                AvailableNumbers = availableNumbers.Take(30).ToList()
            };
        }

        public ValidationResult ValidateAndFormatForExport(RawAddressInput input)
        {
            var errors = new List<string>();
            var suggestions = new List<string>();

            var normBuilding = TextNormalizer.NormalizeBuildingNumber(input.NrDomu);
            if (string.IsNullOrEmpty(normBuilding))
            {
                errors.Add("Numer budynku jest wymagany.");
            }

            // 1. Resolve City
            CityResult? city = null;
            if (!string.IsNullOrEmpty(input.SimcId))
            {
                city = GetCityBySimc(input.SimcId!);
            }

            if (city == null && !string.IsNullOrEmpty(input.Miejscowosc))
            {
                var matches = SearchCity(input.Miejscowosc!, 5);
                if (matches.Count > 0)
                {
                    var exact = matches.FirstOrDefault(c => 
                        TextNormalizer.NormalizeText(c.Name) == TextNormalizer.NormalizeText(input.Miejscowosc!));
                    city = exact ?? matches[0];
                }
            }

            if (city == null)
            {
                errors.Add($"Nie znaleziono miejscowości: \"{input.Miejscowosc ?? input.SimcId ?? ""}\".");
                return new ValidationResult
                {
                    IsValid = false,
                    Errors = errors,
                    Suggestions = suggestions,
                    Normalized = null
                };
            }

            // 2. Resolve Street
            StreetResult? street = null;
            var cityHasStreets = HasStreets(city.SimcId);

            if (cityHasStreets)
            {
                if (!string.IsNullOrEmpty(input.UlicId))
                {
                    street = GetStreetByUlic(city.SimcId, input.UlicId!);
                }
                else if (!string.IsNullOrEmpty(input.Ulica))
                {
                    var matches = SearchStreet(city.SimcId, input.Ulica!, input.KodPocztowy, 5);
                    if (matches.Count > 0)
                    {
                        var exact = matches.FirstOrDefault(s =>
                            TextNormalizer.NormalizeText(s.Name) == TextNormalizer.NormalizeText(input.Ulica!));
                        street = exact ?? matches[0];
                    }
                }

                if (street == null)
                {
                    errors.Add($"Miejscowość \"{city.Name}\" posiada ulice, ale nie znaleziono ulicy \"{input.Ulica ?? ""}\".");
                    var streetSuggestions = SearchStreet(city.SimcId, input.Ulica ?? "", null, 3);
                    foreach (var s in streetSuggestions)
                    {
                        suggestions.Add($"{s.Cecha} {s.Name}");
                    }
                }
            }
            else
            {
                // Village without streets
                street = GetVillageDummyStreet(city.SimcId);
            }

            // 3. Resolve Building and Postal Code
            var finalPostalCode = TextNormalizer.NormalizePostalCode(input.KodPocztowy);

            if (!string.IsNullOrEmpty(normBuilding) && (street != null || !cityHasStreets))
            {
                var bldCheck = ValidateBuilding(city.SimcId, street?.UlicId, normBuilding);
                if (bldCheck.Exists)
                {
                    if (!string.IsNullOrEmpty(bldCheck.PostalCode))
                    {
                        finalPostalCode = bldCheck.PostalCode;
                    }
                }
                else
                {
                    errors.Add($"Numer budynku \"{normBuilding}\" nie istnieje pod adresem \"{street?.Name ?? city.Name}\".");
                    if (bldCheck.AvailableNumbers.Count > 0)
                    {
                        suggestions.Add($"Dostępne numery: {string.Join(", ", bldCheck.AvailableNumbers.Take(10))}");
                    }
                }
            }

            if (string.IsNullOrEmpty(finalPostalCode))
            {
                if (city.PostalCodes.Count > 0)
                {
                    finalPostalCode = city.PostalCodes[0];
                }
                else
                {
                    errors.Add("Brak kodu pocztowego dla podanego adresu.");
                }
            }

            var isValid = errors.Count == 0;

            var taxOffice = city != null
                ? ResolveTaxOffice(new TaxOfficeResolutionInput
                {
                    TerytCode = city.TerytCode,
                    SimcId = city.SimcId,
                    UlicId = street?.UlicId,
                    BuildingNumber = normBuilding
                })
                : null;

            var normalized = new NormalizedAddress
            {
                Wojewodztwo = city.Wojewodztwo,
                Powiat = city.Powiat,
                Gmina = city.Gmina,
                TerytGminaCode = city.TerytCode,
                Miejscowosc = city.Name,
                SimcId = city.SimcId,
                Ulica = street != null && !string.IsNullOrEmpty(street.UlicId) ? street.Name : null,
                UlicId = street != null && !string.IsNullOrEmpty(street.UlicId) ? street.UlicId : null,
                CechaUlicy = street != null && !string.IsNullOrEmpty(street.UlicId) ? (!string.IsNullOrEmpty(street.Cecha) ? street.Cecha : "ul.") : null,
                NrDomu = normBuilding,
                NrLokalu = !string.IsNullOrWhiteSpace(input.NrLokalu) ? input.NrLokalu.Trim() : null,
                KodPocztowy = finalPostalCode ?? string.Empty,
                Poczta = city.Name,
                TaxOffice = taxOffice
            };

            return new ValidationResult
            {
                IsValid = isValid,
                Errors = errors,
                Suggestions = suggestions,
                Normalized = normalized,
                TaxOffice = taxOffice
            };
        }

        /// <summary>
        /// Resolves Urząd Skarbowy (Tax Office) in &lt; 1 ms by hierarchy of specificity.
        /// </summary>
        public TaxOffice? ResolveTaxOffice(TaxOfficeResolutionInput input)
        {
            if (input == null || string.IsNullOrWhiteSpace(input.TerytCode)) return null;

            var teryt = input.TerytCode.Trim();
            var simc = !string.IsNullOrWhiteSpace(input.SimcId) ? input.SimcId!.Trim() : null;
            var ulic = !string.IsNullOrWhiteSpace(input.UlicId) ? input.UlicId!.Trim() : null;
            var bldNum = TextNormalizer.ExtractBuildingNumericPart(input.BuildingNumber);

            const string sql = @"
                SELECT 
                    r.id,
                    r.us_code,
                    r.teryt_code,
                    r.simc_id,
                    r.ulic_id,
                    r.building_parity,
                    r.building_from,
                    r.building_to,
                    r.priority,
                    t.name,
                    t.city,
                    t.street,
                    t.postal_code
                FROM tax_office_rules r
                JOIN tax_offices t ON t.us_code = r.us_code
                WHERE r.teryt_code IN ($teryt1, SUBSTR($teryt2, 1, 6), SUBSTR($teryt3, 1, 4))
                  AND (r.simc_id IS NULL OR r.simc_id = $simc)
                  AND (r.ulic_id IS NULL OR r.ulic_id = $ulic)
                ORDER BY r.priority ASC, r.id ASC";

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("$teryt1", teryt);
            cmd.Parameters.AddWithValue("$teryt2", teryt);
            cmd.Parameters.AddWithValue("$teryt3", teryt);
            cmd.Parameters.AddWithValue("$simc", (object?)simc ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$ulic", (object?)ulic ?? DBNull.Value);

            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                var priority = reader.GetInt32(8);
                var ruleSimc = reader.IsDBNull(3) ? null : reader.GetString(3);
                var ruleUlic = reader.IsDBNull(4) ? null : reader.GetString(4);
                var parity = reader.IsDBNull(5) ? "ALL" : reader.GetString(5);
                int? from = reader.IsDBNull(6) ? null : reader.GetInt32(6);
                int? to = reader.IsDBNull(7) ? null : reader.GetInt32(7);

                // Priority 1: street + building range/parity
                if (priority == 1)
                {
                    if (string.IsNullOrEmpty(ruleUlic) || ruleUlic != ulic) continue;
                    if (bldNum == null) continue;

                    if (parity.Equals("EVEN", StringComparison.OrdinalIgnoreCase) && bldNum.Value % 2 != 0) continue;
                    if (parity.Equals("ODD", StringComparison.OrdinalIgnoreCase) && bldNum.Value % 2 == 0) continue;

                    if (from.HasValue && bldNum.Value < from.Value) continue;
                    if (to.HasValue && bldNum.Value > to.Value) continue;

                    return new TaxOffice
                    {
                        UsCode = reader.GetString(1),
                        Name = reader.GetString(9),
                        City = reader.IsDBNull(10) ? null : reader.GetString(10),
                        Street = reader.IsDBNull(11) ? null : reader.GetString(11),
                        PostalCode = reader.IsDBNull(12) ? null : reader.GetString(12)
                    };
                }

                // Priority 2: whole street
                if (priority == 2)
                {
                    if (string.IsNullOrEmpty(ruleUlic) || ruleUlic != ulic) continue;
                    return new TaxOffice
                    {
                        UsCode = reader.GetString(1),
                        Name = reader.GetString(9),
                        City = reader.IsDBNull(10) ? null : reader.GetString(10),
                        Street = reader.IsDBNull(11) ? null : reader.GetString(11),
                        PostalCode = reader.IsDBNull(12) ? null : reader.GetString(12)
                    };
                }

                // Priority 3: city
                if (priority == 3)
                {
                    if (string.IsNullOrEmpty(ruleSimc) || ruleSimc != simc) continue;
                    return new TaxOffice
                    {
                        UsCode = reader.GetString(1),
                        Name = reader.GetString(9),
                        City = reader.IsDBNull(10) ? null : reader.GetString(10),
                        Street = reader.IsDBNull(11) ? null : reader.GetString(11),
                        PostalCode = reader.IsDBNull(12) ? null : reader.GetString(12)
                    };
                }

                // Priority 4: gmina / powiat
                if (priority == 4)
                {
                    return new TaxOffice
                    {
                        UsCode = reader.GetString(1),
                        Name = reader.GetString(9),
                        City = reader.IsDBNull(10) ? null : reader.GetString(10),
                        Street = reader.IsDBNull(11) ? null : reader.GetString(11),
                        PostalCode = reader.IsDBNull(12) ? null : reader.GetString(12)
                    };
                }
            }

            return null;
        }

        private CityResult? GetCityBySimc(string simcId)
        {
            const string sql = @"
                SELECT c.simc_id, c.teryt_code, c.name, c.postal_codes, t.wojewodztwo, t.powiat, t.gmina
                FROM cities c
                JOIN terc t ON t.teryt_code = c.teryt_code
                WHERE c.simc_id = $simc LIMIT 1";

            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("$simc", simcId);

            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                return new CityResult
                {
                    SimcId = reader.GetString(0),
                    TerytCode = reader.GetString(1),
                    Name = reader.GetString(2),
                    PostalCodes = SafeParseStringArray(reader.GetString(3)),
                    Wojewodztwo = reader.GetString(4),
                    Powiat = reader.GetString(5),
                    Gmina = reader.GetString(6)
                };
            }
            return null;
        }

        private StreetResult? GetStreetByUlic(string simcId, string ulicId)
        {
            const string sql = "SELECT id, simc_id, ulic_id, cecha, name, buildings_map FROM streets WHERE simc_id = $simc AND ulic_id = $ulic LIMIT 1";
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("$simc", simcId);
            cmd.Parameters.AddWithValue("$ulic", ulicId);

            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                return new StreetResult
                {
                    Id = reader.GetInt64(0),
                    SimcId = reader.GetString(1),
                    UlicId = reader.GetString(2),
                    Cecha = reader.GetString(3),
                    Name = reader.GetString(4),
                    PostalCodes = SafeParseBuildingsMap(reader.GetString(5)).Keys.ToList()
                };
            }
            return null;
        }

        private StreetResult? GetVillageDummyStreet(string simcId)
        {
            const string sql = "SELECT id, simc_id, ulic_id, cecha, name, buildings_map FROM streets WHERE simc_id = $simc AND ulic_id IS NULL LIMIT 1";
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue("$simc", simcId);

            using var reader = cmd.ExecuteReader();
            if (reader.Read())
            {
                return new StreetResult
                {
                    Id = reader.GetInt64(0),
                    SimcId = reader.GetString(1),
                    UlicId = null,
                    Cecha = "",
                    Name = reader.GetString(4),
                    PostalCodes = SafeParseBuildingsMap(reader.GetString(5)).Keys.ToList()
                };
            }
            return null;
        }

        private bool HasStreets(string simcId)
        {
            using var cmd = _connection.CreateCommand();
            cmd.CommandText = "SELECT count(*) FROM streets WHERE simc_id = $simc AND ulic_id IS NOT NULL";
            cmd.Parameters.AddWithValue("$simc", simcId);
            var val = Convert.ToInt64(cmd.ExecuteScalar());
            return val > 0;
        }

        private static List<string> SafeParseStringArray(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
            }
            catch
            {
                return new List<string>();
            }
        }

        private static Dictionary<string, List<string>> SafeParseBuildingsMap(string json)
        {
            try
            {
                return JsonSerializer.Deserialize<Dictionary<string, List<string>>>(json) ?? new Dictionary<string, List<string>>();
            }
            catch
            {
                return new Dictionary<string, List<string>>();
            }
        }

        public void Dispose()
        {
            _connection?.Dispose();
        }
    }
}
