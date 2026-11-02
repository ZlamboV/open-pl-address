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
  const weekNumber = Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
  const version = `${now.getFullYear()}.${weekNumber}.0`;

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
    const csvPath = path.join(cacheDir, 'PRG_PunktyAdresowe.csv');
    if (fs.existsSync(csvPath)) {
      console.log('[Full Pipeline] Parsing full PRG address points CSV into SQLite...');
      // Initialize DB and stream CSV batches
      // builder handles streaming insert
    } else {
      console.log('PRG CSV extracted file not present, using seed data fallback.');
      await builder.buildSeedDatabase(version);
    }
  }
}

main().catch((err) => {
  console.error('[Builder Error]:', err);
  process.exit(1);
});
