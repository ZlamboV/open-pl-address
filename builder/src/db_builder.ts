import { DatabaseSync } from 'node:sqlite';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { normalizeText } from './normalizer.ts';
import {
  SEED_TERC,
  SEED_CITIES,
  SEED_STREETS,
  SEED_TAX_OFFICES,
  SEED_TAX_OFFICE_RULES,
} from './seed_data.ts';

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
    taxOffices: number;
    taxOfficeRules: number;
  };
}

export interface BuildOptions {
  outputPath: string;
  schemaPath: string;
  isSeedOnly?: boolean;
  version?: string;
}

/**
 * Calculates SHA256 hex digest of a file.
 */
export async function calculateSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

/**
 * Gzips a source file to target .gz with maximum compression.
 */
export async function gzipFile(sourcePath: string, targetPath: string): Promise<void> {
  const source = fs.createReadStream(sourcePath);
  const target = fs.createWriteStream(targetPath);
  const gzip = zlib.createGzip({ level: 9 });
  await pipeline(source, gzip, target);
}

/**
 * Builds the SQLite database.
 */
export class AddressDatabaseBuilder {
  private db: DatabaseSync | null = null;
  private readonly outputPath: string;
  private readonly schemaPath: string;

  constructor(options: BuildOptions) {
    this.outputPath = options.outputPath;
    this.schemaPath = options.schemaPath;
  }

  public async buildSeedDatabase(version: string = '1.0.0-seed'): Promise<DatabaseManifest> {
    const dir = path.dirname(this.outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.outputPath)) {
      fs.unlinkSync(this.outputPath);
    }

    console.log(`[Builder] Initializing SQLite database at: ${this.outputPath}`);
    this.db = new DatabaseSync(this.outputPath);

    // Apply schema
    const schemaSql = fs.readFileSync(this.schemaPath, 'utf-8');
    this.db.exec(schemaSql);

    console.log('[Builder] Populating database with seed data...');
    this.populateSeedData(version);

    // Run optimize & vacuum
    this.db.exec('PRAGMA optimize;');
    this.db.close();
    this.db = null;

    console.log('[Builder] Database compiled successfully.');

    // Compression and manifest generation
    const compressedPath = `${this.outputPath}.gz`;
    console.log(`[Builder] Compressing to ${compressedPath}...`);
    await gzipFile(this.outputPath, compressedPath);

    const sha256 = await calculateSha256(this.outputPath);
    const sha256Compressed = await calculateSha256(compressedPath);

    const uncompressedStat = fs.statSync(this.outputPath);
    const compressedStat = fs.statSync(compressedPath);

    const manifest: DatabaseManifest = {
      version,
      builtAt: new Date().toISOString(),
      databaseFile: path.basename(this.outputPath),
      compressedFile: path.basename(compressedPath),
      sha256,
      sha256Compressed,
      uncompressedSizeBytes: uncompressedStat.size,
      compressedSizeBytes: compressedStat.size,
      counts: {
        terc: SEED_TERC.length,
        cities: SEED_CITIES.length,
        streets: SEED_STREETS.length,
        postalCodes: this.countPostalCodes(),
        taxOffices: SEED_TAX_OFFICES.length,
        taxOfficeRules: SEED_TAX_OFFICE_RULES.length,
      },
    };

    const manifestPath = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[Builder] Manifest written to ${manifestPath}`);

    return manifest;
  }

  private countPostalCodes(): number {
    const allCodes = new Set<string>();
    for (const c of SEED_CITIES) {
      for (const p of c.postalCodes) allCodes.add(p);
    }
    for (const s of SEED_STREETS) {
      for (const p of Object.keys(s.buildingsMap)) allCodes.add(p);
    }
    return allCodes.size;
  }

  private populateSeedData(version: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec('BEGIN TRANSACTION;');

    try {
      // 1. TERC
      const stmtTerc = this.db.prepare(`
        INSERT INTO terc (teryt_code, wojewodztwo, powiat, gmina, rodzaj_gminy)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const t of SEED_TERC) {
        stmtTerc.run(t.terytCode, t.wojewodztwo, t.powiat, t.gmina, t.rodzajGminy);
      }

      // 2. CITIES
      const stmtCity = this.db.prepare(`
        INSERT INTO cities (simc_id, teryt_code, name, name_normalized, postal_codes)
        VALUES (?, ?, ?, ?, ?)
      `);
      const stmtCityFts = this.db.prepare(`
        INSERT INTO cities_fts (simc_id, name_normalized, name)
        VALUES (?, ?, ?)
      `);

      for (const c of SEED_CITIES) {
        const norm = normalizeText(c.name);
        const postalJson = JSON.stringify(c.postalCodes);
        stmtCity.run(c.simcId, c.terytCode, c.name, norm, postalJson);
        stmtCityFts.run(c.simcId, norm, c.name);
      }

      // 3. STREETS
      const stmtStreet = this.db.prepare(`
        INSERT INTO streets (simc_id, ulic_id, cecha, name, name_normalized, buildings_map)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const stmtStreetFts = this.db.prepare(`
        INSERT INTO streets_fts (street_id, simc_id, name_normalized, name)
        VALUES (?, ?, ?, ?)
      `);
      const stmtPostal = this.db.prepare(`
        INSERT OR IGNORE INTO postal_code_index (postal_code, simc_id, street_id)
        VALUES (?, ?, ?)
      `);

      for (const s of SEED_STREETS) {
        const norm = normalizeText(s.name);
        const buildingsJson = JSON.stringify(s.buildingsMap);

        const info = stmtStreet.run(s.simcId, s.ulicId, s.cecha, s.name, norm, buildingsJson);
        const streetId = Number(info.lastInsertRowid);

        stmtStreetFts.run(streetId, s.simcId, norm, s.name);

        // Add street postal codes to index
        for (const code of Object.keys(s.buildingsMap)) {
          stmtPostal.run(code, s.simcId, streetId);
        }
      }

      // 4. Also register city-level postal codes without specific street
      for (const c of SEED_CITIES) {
        for (const code of c.postalCodes) {
          stmtPostal.run(code, c.simcId, null);
        }
      }

      // 5. Tax Offices (Urzędy Skarbowe)
      const stmtTaxOffice = this.db.prepare(`
        INSERT INTO tax_offices (us_code, name, city, street, postal_code)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const to of SEED_TAX_OFFICES) {
        stmtTaxOffice.run(to.usCode, to.name, to.city, to.street, to.postalCode);
      }

      // 6. Tax Office Rules
      const stmtTaxRule = this.db.prepare(`
        INSERT INTO tax_office_rules (
          us_code, teryt_code, simc_id, ulic_id,
          building_parity, building_from, building_to, priority
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const r of SEED_TAX_OFFICE_RULES) {
        stmtTaxRule.run(
          r.usCode,
          r.terytCode,
          r.simcId,
          r.ulicId,
          r.buildingParity,
          r.buildingFrom,
          r.buildingTo,
          r.priority
        );
      }

      // 7. Metadata
      const stmtMeta = this.db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)');
      stmtMeta.run('version', version);
      stmtMeta.run('built_at', new Date().toISOString());
      stmtMeta.run('dataset', 'TERYT+PRG+MF_US');

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }
}
