import type {
  BuildingValidationResult,
  CitySearchResult,
  PostalCodeSearchResult,
  RawAddressInput,
  ResolveTaxOfficeParams,
  SDKConfig,
  StreetSearchResult,
  TaxOffice,
  ValidationResult,
} from './types.ts';
import { AddressDatabaseManager } from './db-manager.ts';
import { AddressService } from './address-service.ts';

export class PolishAddressSDK {
  private dbManager: AddressDatabaseManager;
  private addressService: AddressService | null = null;
  private isInitialized = false;

  constructor(config: SDKConfig = {}) {
    this.dbManager = new AddressDatabaseManager(config);
  }

  /**
   * Initializes database connection, performing auto-download if needed.
   */
  public async initialize(): Promise<this> {
    if (this.isInitialized && this.addressService) {
      return this;
    }
    const db = await this.dbManager.initialize();
    this.addressService = new AddressService(db);
    this.isInitialized = true;
    return this;
  }

  private ensureInitialized(): AddressService {
    if (!this.addressService) {
      // If initialized synchronously or needs auto-init
      const db = this.dbManager.getDatabase();
      this.addressService = new AddressService(db);
    }
    return this.addressService;
  }

  /**
   * 1. Finds administrative location and streets by postal code (XX-XXX).
   */
  public findByPostalCode(postalCode: string): PostalCodeSearchResult | null {
    return this.ensureInitialized().findByPostalCode(postalCode);
  }

  /**
   * 2. Instant city search by name, supporting typos, diacritics removal & Cyrillic transliteration.
   */
  public searchCity(query: string, limit = 10): CitySearchResult[] {
    return this.ensureInitialized().searchCity(query, limit);
  }

  /**
   * 3. Street autocomplete within a city (for Telegram bot buttons and UI inputs).
   */
  public searchStreet(simcId: string, query: string, postalCode?: string, limit = 15): StreetSearchResult[] {
    return this.ensureInitialized().searchStreet(simcId, query, postalCode, limit);
  }

  /**
   * 4. Validates building number and returns exact postal code.
   */
  public validateBuilding(simcId: string, ulicId: string | null, buildingNumber: string): BuildingValidationResult {
    return this.ensureInitialized().validateBuilding(simcId, ulicId, buildingNumber);
  }

  /**
   * 5. Resolves official Urząd Skarbowy (Tax Office) in < 1 ms by hierarchy of specificity.
   */
  public resolveTaxOffice(params: ResolveTaxOfficeParams): TaxOffice | null {
    return this.ensureInitialized().resolveTaxOffice(params);
  }

  /**
   * 6. Validates and normalizes raw address input for Gratyfikant nexo and ZUS Płatnik.
   */
  public validateAndFormatForExport(input: RawAddressInput): ValidationResult {
    return this.ensureInitialized().validateAndFormatForExport(input);
  }

  /**
   * Manually checks for remote updates and performs hot-swap if available.
   */
  public async checkForUpdate(): Promise<boolean> {
    const swapped = await this.dbManager.checkForUpdate();
    if (swapped) {
      const db = this.dbManager.getDatabase();
      this.addressService = new AddressService(db);
    }
    return swapped;
  }

  /**
   * Closes database connection and stops background timers.
   */
  public close(): void {
    this.dbManager.close();
    this.addressService = null;
    this.isInitialized = false;
  }
}
