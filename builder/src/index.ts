#!/usr/bin/env node
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { AddressDatabaseBuilder } from './db_builder.ts';
import { downloadFile, OFFICIAL_DATA_SOURCES } from './downloaders/prg_teryt_fetcher.ts';
import { parsePrgCsvStream } from './parsers/prg_stream.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively unpacks all .zip archives in targetDir until only leaf files remain.
 * Intermediate .zip archives are removed after extraction to conserve disk space and prevent re-processing.
 *
 * @param targetDir Directory containing downloaded archives
 * @param maxPasses Maximum number of recursive extraction passes (default: 5)
 */
export function extractArchivesRecursively(targetDir: string, maxPasses = 5): void {
  let pass = 0;
  while (pass < maxPasses) {
    pass++;
    const zipFiles: string[] = [];

    function findZips(dir: string): void {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findZips(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
          zipFiles.push(full);
        }
      }
    }

    findZips(targetDir);

    if (zipFiles.length === 0) break;

    console.log(`[Full Pipeline] Extracting ${zipFiles.length} archive(s) (pass ${pass})...`);
    for (const zipFile of zipFiles) {
      const destDir = path.dirname(zipFile);
      try {
        execSync(`unzip -q -o "${zipFile}" -d "${destDir}"`, { stdio: 'inherit' });
        // Remove nested archive after successful unpack to save disk space and avoid reprocessing
        fs.unlinkSync(zipFile);
      } catch (err: any) {
        console.warn(`[Warning] Failed to unpack archive ${zipFile}: ${err.message}`);
        try {
          fs.renameSync(zipFile, `${zipFile}.corrupted`);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * Discovers all PRG address data files (.csv and .txt), filtering out metadata/documentation.
 * Sniffs the header (first 4KB) of each candidate file to verify presence of PRG address columns.
 *
 * @param dir Directory to search for PRG address files
 * @returns Array of absolute paths to valid address data files
 */
export function findAddressFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAddressFiles(full));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        // Ignore common non-data documentation files
        if (
          lower.startsWith('readme') ||
          lower.startsWith('opis') ||
          lower.startsWith('licen') ||
          lower.startsWith('metadan') ||
          lower.startsWith('wykaz') ||
          lower.startsWith('struktura')
        ) {
          continue;
        }

        // Quick header validation (sniff first 4KB to confirm presence of PRG address columns)
        try {
          const fd = fs.openSync(full, 'r');
          const buffer = Buffer.alloc(4096);
          const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
          fs.closeSync(fd);
          const headerLine = buffer.toString('utf-8', 0, bytesRead).split(/\r?\n/)[0].toUpperCase();
          const hasSimcOrCity =
            headerLine.includes('SIMC') ||
            headerLine.includes('MIEJSC') ||
            headerLine.includes('SYM');
          const hasBuildingOrPna =
            headerLine.includes('NUMER') ||
            headerLine.includes('NR') ||
            headerLine.includes('PNA') ||
            headerLine.includes('KOD');

          if (hasSimcOrCity && hasBuildingOrPna) {
            results.push(full);
          }
        } catch {
          // If read fails, fallback to filename check
          results.push(full);
        }
      }
    }
  }
  return results;
}

export async function main() {
  const args = process.argv.slice(2);
  const isSeed = args.includes('--seed') || !args.includes('--full');
  const isFull = args.includes('--full');

  let outputDir = path.resolve(process.cwd(), 'data');
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputDir = path.resolve(process.cwd(), args[outputIndex + 1]);
  }

  const schemaPath = path.resolve(__dirname, '../../schema/migrations/001_initial_schema.sql');
  const targetDbPath = path.join(outputDir, 'pl_addresses.sqlite');

  console.log('=====================================================');
  console.log('   open-pl-address Database Builder (TERYT + PRG)   ');
  console.log('=====================================================');
  console.log(`Mode:       ${isFull ? 'FULL REBUILD (All Poland)' : 'SEED / DEMO (Lublin, Warszawa, Kraków, etc.)'}`);
  console.log(`Output DB:  ${targetDbPath}`);
  console.log(`Schema:     ${schemaPath}`);

  if (!fs.existsSync(schemaPath)) {
    console.error(`Error: Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  const builder = new AddressDatabaseBuilder({
    outputPath: targetDbPath,
    schemaPath,
    isSeedOnly: isSeed,
  });

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const version = `${now.getFullYear()}.${month}.0`;

  if (isSeed) {
    console.log(`\nBuilding Seed Database v${version}...`);
    const manifest = await builder.buildSeedDatabase(version);
    console.log('\n--- Build Complete ---');
    console.log(`Version:    ${manifest.version}`);
    console.log(`SHA256:     ${manifest.sha256}`);
    console.log(`Size (raw): ${(manifest.uncompressedSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Size (gz):  ${(manifest.compressedSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Records:    TERC=${manifest.counts.terc}, Cities=${manifest.counts.cities}, Streets=${manifest.counts.streets}, PostalCodes=${manifest.counts.postalCodes}, TaxOffices=${manifest.counts.taxOffices}, TaxRules=${manifest.counts.taxOfficeRules}`);
    return;
  }

  if (isFull) {
    console.log('\nStarting Full Download of GUGiK PRG and GUS TERYT...');
    const cacheDir = path.join(outputDir, '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const prgZipPath = path.join(cacheDir, OFFICIAL_DATA_SOURCES.GUGIK_PRG_ADRESY.targetFilename);

    console.log(`[Full Pipeline] Downloading PRG dataset from GUGiK: ${OFFICIAL_DATA_SOURCES.GUGIK_PRG_ADRESY.url}`);
    try {
      await downloadFile(OFFICIAL_DATA_SOURCES.GUGIK_PRG_ADRESY.url, prgZipPath, (downloaded, total) => {
        const pct = total > 0 ? ((downloaded / total) * 100).toFixed(1) : '?';
        process.stdout.write(`\rDownloading PRG: ${(downloaded / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
      });
      console.log('\nDownload complete.');
    } catch (err: any) {
      console.warn(`[Warning] Could not download live GUGiK PRG dataset (${err.message}). Falling back to seed dataset.`);
      await builder.buildSeedDatabase(version);
      return;
    }

    // In full mode with unpacked PRG archives:
    console.log('[Full Pipeline] Extracting archive and nested voivodeship packages...');
    const extractedDir = path.join(cacheDir, 'prg_extracted');
    if (!fs.existsSync(extractedDir)) {
      fs.mkdirSync(extractedDir, { recursive: true });
    }

    // Unpack top-level PRG archive into extractedDir
    try {
      execSync(`unzip -q -o "${prgZipPath}" -d "${extractedDir}"`, { stdio: 'inherit' });
    } catch (unzipErr: any) {
      console.warn(`[Warning] Top-level unzip failed (${unzipErr.message}).`);
    }

    // Recursively extract all nested voivodeship archives and remove intermediate zips
    extractArchivesRecursively(extractedDir);

    let dataFiles = findAddressFiles(extractedDir);
    if (dataFiles.length === 0) {
      dataFiles = findAddressFiles(cacheDir);
    }

    if (dataFiles.length > 0) {
      console.log(`[Full Pipeline] Found ${dataFiles.length} address file(s) to process:`, dataFiles.map((f) => path.basename(f)));
      const manifest = await builder.buildFullDatabase(dataFiles, version);
      console.log('\n--- Full Build Complete ---');
      console.log(`Version:    ${manifest.version}`);
      console.log(`Size (raw): ${(manifest.uncompressedSizeBytes / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Size (gz):  ${(manifest.compressedSizeBytes / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Records:    TERC=${manifest.counts.terc}, Cities=${manifest.counts.cities}, Streets=${manifest.counts.streets}, PostalCodes=${manifest.counts.postalCodes}`);
    } else {
      console.log('No valid PRG CSV/TXT files found in cache, using seed data fallback.');
      await builder.buildSeedDatabase(version);
    }
  }
}

const isDirectExecution =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === __filename || process.argv[1].endsWith('builder/src/index.ts')) &&
  !process.env.TEST_IMPORT_ONLY;

if (isDirectExecution) {
  main().catch((err) => {
    console.error('[Builder Error]:', err);
    process.exit(1);
  });
}
