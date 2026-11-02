/**
 * Domain types and Data Transfer Objects (DTOs) for open-pl-address SDK.
 */

export interface ISqliteStatement {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export interface ISqliteDatabase {
  prepare(sql: string): ISqliteStatement;
  exec(sql: string): void;
  close(): void;
}

export interface SDKConfig {
  /** Local path to the .sqlite database file. Defaults to './data/pl_addresses.sqlite' */
  dbPath?: string;
  /** Remote URL for manifest.json and pl_addresses.sqlite.gz (e.g. GitHub Releases) */
  updateUrl?: string;
  /** Background update check interval in days. Defaults to 7 */
  autoUpdateDays?: number;
  /** Whether to automatically download DB on init if missing. Defaults to true */
  autoDownloadOnMissing?: boolean;
  /** Custom SQLite database instance or adapter */
  databaseAdapter?: ISqliteDatabase;
}

export interface TercInfo {
  terytCode: string; // 7-digit code: WOJ(2)+POW(2)+GMI(2)+RODZ(1)
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  rodzajGminy: string;
}

export interface CitySearchResult {
  simcId: string; // 7-digit SIMC identifier
  terytCode: string; // 7-digit TERC code
  name: string; // Official city name (e.g. "Lublin", "Łódź")
  wojewodztwo: string; // e.g. "LUBELSKIE"
  powiat: string; // e.g. "m. Lublin"
  gmina: string; // e.g. "Lublin"
  postalCodes: string[]; // e.g. ["20-001", "20-002"]
}

export interface StreetSearchResult {
  id: number;
  simcId: string;
  ulicId: string | null; // 5-digit ULIC identifier, null for villages
  cecha: string; // "ul.", "al.", "pl.", "os."
  name: string; // Official street name (e.g. "Wieniawska")
  postalCodes: string[]; // Postal codes serving this street
}

export interface BuildingValidationResult {
  exists: boolean;
  postalCode: string | null; // Exact postal code for this specific building
  allPostalCodesForStreet: string[];
  availableNumbers: string[]; // Sample or available building numbers on this street
}

export interface RawAddressInput {
  kodPocztowy?: string; // Format "XX-XXX" or "XXXXX"
  miejscowosc?: string; // City name (e.g. "Lublin", "Люблін", "Lodz")
  simcId?: string; // Optional known SIMC ID
  ulica?: string; // Street name (e.g. "Wieniawska", "Венявська")
  ulicId?: string; // Optional known ULIC ID
  nrDomu: string; // Building number (e.g. "12", "12A", "84/92")
  nrLokalu?: string; // Apartment / premises number (e.g. "4")
}

export interface NormalizedAddress {
  wojewodztwo: string;
  powiat: string;
  gmina: string;
  terytGminaCode: string; // 7-digit GUS code for ZUS Płatnik
  miejscowosc: string;
  simcId: string; // 7-digit SIMC identifier
  ulica: string | null;
  ulicId: string | null; // 5-digit ULIC identifier
  cechaUlicy: string | null;
  nrDomu: string;
  nrLokalu: string | null;
  kodPocztowy: string; // Format XX-XXX
  poczta: string; // Post office town name
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  normalized: NormalizedAddress | null;
}

export interface PostalCodeSearchResult {
  postalCode: string;
  cities: {
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
  }[];
}

export interface DatabaseManifest {
  version: string;
  builtAt: string;
  databaseFile: string;
  compressedFile: string;
  sha256: string;
  sha256Compressed: string;
  uncompressedSizeBytes: number;
  compressedSizeBytes: number;
  counts: {
    terc: number;
    cities: number;
    streets: number;
    postalCodes: number;
  };
}
