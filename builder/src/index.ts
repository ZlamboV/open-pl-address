#!/usr/bin/env node
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AddressDatabaseBuilder } from './db_builder.ts';
import { downloadFile, OFFICIAL_DATA_SOURCES } from './downloaders/prg_teryt_fetcher.ts';
import { parsePrgCsvStream } from './parsers/prg_stream.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
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

    // In full mode with unpacked PRG CSV:
    console.log('[Full Pipeline] Extracting archive...');
    try {
      const { execSync } = await import('node:child_process');
      execSync(`unzip -q -o "${prgZipPath}" -d "${cacheDir}"`, { stdio: 'inherit' });
    } catch (unzipErr: any) {
      console.warn(`[Warning] unzip command failed (${unzipErr.message}).`);
    }

    function findCsvFiles(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findCsvFiles(full));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.csv')) {
          results.push(full);
        }
      }
      return results;
    }

    const csvFiles = findCsvFiles(cacheDir);
    if (csvFiles.length > 0) {
      console.log(`[Full Pipeline] Found ${csvFiles.length} CSV file(s) to process:`, csvFiles.map((f) => path.basename(f)));
      const manifest = await builder.buildFullDatabase(csvFiles, version);
      console.log('\n--- Full Build Complete ---');
      console.log(`Version:    ${manifest.version}`);
      console.log(`Size (raw): ${(manifest.uncompressedSizeBytes / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Size (gz):  ${(manifest.compressedSizeBytes / 1024 / 1024).toFixed(1)} MB`);
      console.log(`Records:    TERC=${manifest.counts.terc}, Cities=${manifest.counts.cities}, Streets=${manifest.counts.streets}, PostalCodes=${manifest.counts.postalCodes}`);
    } else {
      console.log('No PRG CSV files found in cache, using seed data fallback.');
      await builder.buildSeedDatabase(version);
    }
  }
}

main().catch((err) => {
  console.error('[Builder Error]:', err);
  process.exit(1);
});
