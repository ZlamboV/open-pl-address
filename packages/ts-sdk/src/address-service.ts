import type {
  BuildingValidationResult,
  CitySearchResult,
  ISqliteDatabase,
  NormalizedAddress,
  PostalCodeSearchResult,
  RawAddressInput,
  StreetSearchResult,
  ValidationResult,
} from './types.ts';
import {
  isValidPostalCode,
  normalizeBuildingNumber,
  normalizePostalCode,
  normalizeText,
} from './normalizer.ts';

export class AddressService {
  private readonly db: ISqliteDatabase;

  constructor(db: ISqliteDatabase) {
    this.db = db;
  }

  /**
   * 1. Finds administrative location and streets by postal code (XX-XXX).
   */
  public findByPostalCode(postalCode: string): PostalCodeSearchResult | null {
    const normalizedPna = normalizePostalCode(postalCode);
    if (!normalizedPna) {
      return null;
    }

    const rows = this.db.prepare(`
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
      WHERE p.postal_code = ?
    `).all(normalizedPna) as any[];

    if (!rows || rows.length === 0) {
      return null;
    }

    const cityMap = new Map<string, {
      simcId: string;
      name: string;
      wojewodztwo: string;
      powiat: string;
      gmina: string;
      terytCode: string;
      streets: {
        id: number;
        ulicId: string | null;
        cecha: string;
        name: string;
      }[];
    }>();

    for (const r of rows) {
      let city = cityMap.get(r.simc_id);
      if (!city) {
        city = {
          simcId: r.simc_id,
          name: r.city_name,
          wojewodztwo: r.wojewodztwo,
          powiat: r.powiat,
          gmina: r.gmina,
          terytCode: r.teryt_code,
          streets: [],
        };
        cityMap.set(r.simc_id, city);
      }

      if (r.street_id && r.street_name) {
        city.streets.push({
          id: r.street_id,
          ulicId: r.ulic_id,
          cecha: r.cecha,
          name: r.street_name,
        });
      }
    }

    return {
      postalCode: normalizedPna,
      cities: Array.from(cityMap.values()),
    };
  }

  /**
   * 2. Instant city search by name, supporting typos, diacritics removal & Cyrillic transliteration.
   */
  public searchCity(query: string, limit = 10): CitySearchResult[] {
    const normalized = normalizeText(query);
    if (!normalized) return [];

    // First try FTS5 prefix search
    let rows: any[] = [];
    try {
      rows = this.db.prepare(`
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
        WHERE cities_fts MATCH ?
        LIMIT ?
      `).all(`${normalized}*`, limit) as any[];
    } catch {
      rows = [];
    }

    // Fallback to LIKE if FTS produced few or no results
    if (rows.length < limit) {
      const existingSimcs = new Set(rows.map((r) => r.simc_id));
      const remainingLimit = limit - rows.length;
      const likeRows = this.db.prepare(`
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
        WHERE c.name_normalized LIKE ?
        LIMIT ?
      `).all(`${normalized}%`, remainingLimit) as any[];

      for (const r of likeRows) {
        if (!existingSimcs.has(r.simc_id)) {
          rows.push(r);
          existingSimcs.add(r.simc_id);
        }
      }
    }

    return rows.map((r) => ({
      simcId: r.simc_id,
      terytCode: r.teryt_code,
      name: r.name,
      wojewodztwo: r.wojewodztwo,
      powiat: r.powiat,
      gmina: r.gmina,
      postalCodes: this.safeParseJsonArray(r.postal_codes),
    }));
  }

  /**
   * 3. Street autocomplete within a city (for Telegram bot buttons and UI inputs).
   */
  public searchStreet(simcId: string, query: string, postalCode?: string, limit = 15): StreetSearchResult[] {
    const normalized = normalizeText(query);
    const normalizedPna = postalCode ? normalizePostalCode(postalCode) : null;

    let rows: any[] = [];

    if (normalized.length > 0) {
      try {
        rows = this.db.prepare(`
          SELECT 
            s.id,
            s.simc_id,
            s.ulic_id,
            s.cecha,
            s.name,
            s.buildings_map
          FROM streets_fts f
          JOIN streets s ON s.id = f.street_id
          WHERE f.simc_id = ? AND streets_fts MATCH ?
          LIMIT ?
        `).all(simcId, `${normalized}*`, limit) as any[];
      } catch {
        rows = [];
      }
    }

    if (rows.length < limit) {
      const existingIds = new Set(rows.map((r) => r.id));
      const remainingLimit = limit - rows.length;
      const sqlPattern = normalized.length > 0 ? `${normalized}%` : '%';

      const likeRows = this.db.prepare(`
        SELECT 
          s.id,
          s.simc_id,
          s.ulic_id,
          s.cecha,
          s.name,
          s.buildings_map
        FROM streets s
        WHERE s.simc_id = ? AND s.name_normalized LIKE ?
        LIMIT ?
      `).all(simcId, sqlPattern, remainingLimit) as any[];

      for (const r of likeRows) {
        if (!existingIds.has(r.id)) {
          rows.push(r);
          existingIds.add(r.id);
        }
      }
    }

    // Map and filter by postalCode if specified
    const results: StreetSearchResult[] = [];
    for (const r of rows) {
      const bMap = this.safeParseJsonObject(r.buildings_map);
      const codes = Object.keys(bMap);

      if (normalizedPna && codes.length > 0 && !codes.includes(normalizedPna)) {
        continue;
      }

      results.push({
        id: r.id,
        simcId: r.simc_id,
        ulicId: r.ulic_id,
        cecha: r.cecha,
        name: r.name,
        postalCodes: codes,
      });
    }

    return results;
  }

  /**
   * 4. Validates building number and returns exact postal code.
   */
  public validateBuilding(simcId: string, ulicId: string | null, buildingNumber: string): BuildingValidationResult {
    const normalizedBld = normalizeBuildingNumber(buildingNumber);

    let row: any = null;
    if (ulicId) {
      row = this.db.prepare(`
        SELECT buildings_map FROM streets WHERE simc_id = ? AND ulic_id = ? LIMIT 1
      `).get(simcId, ulicId);
    } else {
      row = this.db.prepare(`
        SELECT buildings_map FROM streets WHERE simc_id = ? AND ulic_id IS NULL LIMIT 1
      `).get(simcId);
    }

    if (!row || !row.buildings_map) {
      return {
        exists: false,
        postalCode: null,
        allPostalCodesForStreet: [],
        availableNumbers: [],
      };
    }

    const bMap: Record<string, string[]> = this.safeParseJsonObject(row.buildings_map);
    const allCodes = Object.keys(bMap);
    const availableNumbers: string[] = [];

    let matchedPostalCode: string | null = null;

    for (const [pna, nums] of Object.entries(bMap)) {
      for (const n of nums) {
        availableNumbers.push(n);
        if (n.toUpperCase() === normalizedBld) {
          matchedPostalCode = pna;
        }
      }
    }

    return {
      exists: matchedPostalCode !== null,
      postalCode: matchedPostalCode,
      allPostalCodesForStreet: allCodes,
      availableNumbers: availableNumbers.slice(0, 30),
    };
  }

  /**
   * 5. Validates and normalizes raw address input for Gratyfikant nexo and ZUS Płatnik.
   */
  public validateAndFormatForExport(input: RawAddressInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    const normBuilding = normalizeBuildingNumber(input.nrDomu);
    if (!normBuilding) {
      errors.push('Numer budynku jest wymagany.');
    }

    // 1. Resolve City
    let city: any = null;
    if (input.simcId) {
      city = this.db.prepare(`
        SELECT c.*, t.wojewodztwo, t.powiat, t.gmina
        FROM cities c
        JOIN terc t ON t.teryt_code = c.teryt_code
        WHERE c.simc_id = ?
      `).get(input.simcId);
    }

    if (!city && input.miejscowosc) {
      const cityMatches = this.searchCity(input.miejscowosc, 5);
      if (cityMatches.length > 0) {
        const exact = cityMatches.find(
          (c) => normalizeText(c.name) === normalizeText(input.miejscowosc!)
        );
        const selected = exact ?? cityMatches[0];
        city = this.db.prepare(`
          SELECT c.*, t.wojewodztwo, t.powiat, t.gmina
          FROM cities c
          JOIN terc t ON t.teryt_code = c.teryt_code
          WHERE c.simc_id = ?
        `).get(selected.simcId);
      }
    }

    if (!city) {
      errors.push(`Nie znaleziono miejscowości: "${input.miejscowosc ?? input.simcId ?? ''}".`);
      return {
        isValid: false,
        errors,
        suggestions,
        normalized: null,
      };
    }

    // 2. Resolve Street
    let street: any = null;
    const cityHasStreets = (this.db.prepare(`
      SELECT count(*) as count FROM streets WHERE simc_id = ? AND ulic_id IS NOT NULL
    `).get(city.simc_id) as any).count > 0;

    if (cityHasStreets) {
      if (input.ulicId) {
        street = this.db.prepare(`
          SELECT * FROM streets WHERE simc_id = ? AND ulic_id = ?
        `).get(city.simc_id, input.ulicId);
      } else if (input.ulica) {
        const streetMatches = this.searchStreet(city.simc_id, input.ulica, input.kodPocztowy, 5);
        if (streetMatches.length > 0) {
          const exact = streetMatches.find(
            (s) => normalizeText(s.name) === normalizeText(input.ulica!)
          );
          const chosen = exact ?? streetMatches[0];
          street = this.db.prepare('SELECT * FROM streets WHERE id = ?').get(chosen.id);
        }
      }

      if (!street) {
        errors.push(`Miejscowość "${city.name}" posiada ulice, ale nie znaleziono ulicy "${input.ulica ?? ''}".`);
        const possibleStreets = this.searchStreet(city.simc_id, input.ulica ?? '', undefined, 3);
        for (const s of possibleStreets) {
          suggestions.push(`${s.cecha} ${s.name}`);
        }
      }
    } else {
      // Village without streets
      street = this.db.prepare(`
        SELECT * FROM streets WHERE simc_id = ? AND ulic_id IS NULL
      `).get(city.simc_id);
    }

    // 3. Resolve Building and Postal Code
    let finalPostalCode = normalizePostalCode(input.kodPocztowy);
    let buildingValid = false;

    if (normBuilding && (street || !cityHasStreets)) {
      const bldCheck = this.validateBuilding(city.simc_id, street?.ulic_id ?? null, normBuilding);
      if (bldCheck.exists) {
        buildingValid = true;
        if (bldCheck.postalCode) {
          finalPostalCode = bldCheck.postalCode;
        }
      } else {
        if (input.allowManualBuilding) {
          // Permitted unlisted building (new development / manual override)
          warnings.push(
            `Numer budynku "${normBuilding}" nie figuruje w rejestrze PRG (może to być nowo wybudowany budynek). Adres zaakceptowano w trybie ręcznym.`
          );
          if (!finalPostalCode && bldCheck.allPostalCodesForStreet.length > 0) {
            finalPostalCode = bldCheck.allPostalCodesForStreet[0];
          }
        } else {
          errors.push(`Numer budynku "${normBuilding}" nie istnieje pod adresem "${street?.name ?? city.name}".`);
          if (bldCheck.availableNumbers.length > 0) {
            suggestions.push(`Dostępne numery: ${bldCheck.availableNumbers.slice(0, 10).join(', ')}`);
          }
        }
      }
    }

    if (!finalPostalCode) {
      const cityCodes = this.safeParseJsonArray(city.postal_codes);
      if (cityCodes.length > 0) {
        finalPostalCode = cityCodes[0];
      } else {
        errors.push('Brak kodu pocztowego dla podanego adresu.');
      }
    }

    const isValid = errors.length === 0;

    const normalizedAddress: NormalizedAddress | null = city
      ? {
          wojewodztwo: city.wojewodztwo,
          powiat: city.powiat,
          gmina: city.gmina,
          terytGminaCode: city.teryt_code,
          miejscowosc: city.name,
          simcId: city.simc_id,
          ulica: street && street.ulic_id ? street.name : null,
          ulicId: street && street.ulic_id ? street.ulic_id : null,
          cechaUlicy: street && street.ulic_id ? (street.cecha || 'ul.') : null,
          nrDomu: normBuilding,
          nrLokalu: input.nrLokalu ? input.nrLokalu.trim() : null,
          kodPocztowy: finalPostalCode ?? '',
          poczta: city.name,
        }
      : null;

    return {
      isValid,
      errors,
      warnings,
      suggestions,
      normalized: normalizedAddress,
    };
  }

  private safeParseJsonArray(jsonStr: string): string[] {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  }

  private safeParseJsonObject(jsonStr: string): Record<string, string[]> {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  }
}
