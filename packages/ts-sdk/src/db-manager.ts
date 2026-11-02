import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as zlib from 'node:zlib';
import * as https from 'node:https';
import * as http from 'node:http';
import { pipeline } from 'node:stream/promises';
import type { DatabaseManifest, ISqliteDatabase, SDKConfig } from './types.ts';
import { createSqliteAdapter } from './db-adapter.ts';

function resolveDefaultDbPath(explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(process.cwd(), explicitPath);
  }
  if (process.env.OPEN_PL_ADDRESS_DB_PATH) {
    return path.resolve(process.cwd(), process.env.OPEN_PL_ADDRESS_DB_PATH);
  }
  const cwdPath = path.resolve(process.cwd(), './data/pl_addresses.sqlite');
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.resolve(dir, 'data/pl_addresses.sqlite');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwdPath;
}

export class AddressDatabaseManager {
  private config: Required<Pick<SDKConfig, 'dbPath' | 'autoUpdateDays' | 'autoDownloadOnMissing'>> & { updateUrl?: string };
  private activeDb: ISqliteDatabase | null = null;
  private updateTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;

  constructor(config: SDKConfig = {}) {
    this.config = {
      dbPath: resolveDefaultDbPath(config.dbPath),
      updateUrl: config.updateUrl ?? 'https://github.com/ZlamboV/open-pl-address/releases/latest/download',
      autoUpdateDays: config.autoUpdateDays ?? 7,
      autoDownloadOnMissing: config.autoDownloadOnMissing ?? true,
    };

    if (config.databaseAdapter) {
      this.activeDb = config.databaseAdapter;
    }
  }

  /**
   * Initializes the database connection, performing auto-download if missing.
   */
  public async initialize(): Promise<ISqliteDatabase> {
    if (this.activeDb) {
      return this.activeDb;
    }

    const exists = fs.existsSync(this.config.dbPath);

    if (!exists) {
      if (this.config.autoDownloadOnMissing && this.config.updateUrl) {
        console.log(`[open-pl-address] Database missing at ${this.config.dbPath}. Downloading from ${this.config.updateUrl}...`);
        await this.downloadAndExtractDatabase();
      } else {
        throw new Error(
          `Database file not found at: ${this.config.dbPath}. Please specify updateUrl or run builder to generate it.`
        );
      }
    }

    this.activeDb = createSqliteAdapter(this.config.dbPath, true);

    // Setup periodic background check if updateUrl is provided
    if (this.config.updateUrl && this.config.autoUpdateDays > 0) {
      this.startPeriodicUpdateCheck();
    }

    return this.activeDb;
  }

  /**
   * Returns current active SQLite connection.
   */
  public getDatabase(): ISqliteDatabase {
    if (!this.activeDb) {
      throw new Error('Database not initialized. Please call sdk.initialize() first.');
    }
    return this.activeDb;
  }

  /**
   * Checks for a newer database version and performs hot-swap if available.
   */
  public async checkForUpdate(): Promise<boolean> {
    if (!this.config.updateUrl || this.isUpdating) {
      return false;
    }

    this.isUpdating = true;
    try {
      const manifestUrl = `${this.config.updateUrl.replace(/\/$/, '')}/manifest.json`;
      const remoteManifest = await this.fetchJson<DatabaseManifest>(manifestUrl);
      if (!remoteManifest || !remoteManifest.sha256) {
        return false;
      }

      const currentSha256 = fs.existsSync(this.config.dbPath) ? await this.calculateSha256(this.config.dbPath) : null;

      if (currentSha256 && currentSha256 === remoteManifest.sha256) {
        return false; // Database is up to date
      }

      console.log(`[open-pl-address] New database version available (v${remoteManifest.version}). Starting hot-swap download...`);

      const tempDbPath = `${this.config.dbPath}.swap.tmp`;
      const tempGzPath = `${tempDbPath}.gz`;
      const downloadUrl = `${this.config.updateUrl.replace(/\/$/, '')}/${remoteManifest.compressedFile ?? 'pl_addresses.sqlite.gz'}`;

      await this.downloadRemoteFile(downloadUrl, tempGzPath);

      // Decompress
      const source = fs.createReadStream(tempGzPath);
      const target = fs.createWriteStream(tempDbPath);
      const gunzip = zlib.createGunzip();
      await pipeline(source, gunzip, target);
      fs.unlinkSync(tempGzPath);

      // Verify checksum
      const downloadedSha = await this.calculateSha256(tempDbPath);
      if (downloadedSha !== remoteManifest.sha256) {
        fs.unlinkSync(tempDbPath);
        throw new Error(`Integrity check failed: expected SHA256 ${remoteManifest.sha256}, got ${downloadedSha}`);
      }

      // Hot-swap
      await this.hotSwapDatabase(tempDbPath);
      console.log(`[open-pl-address] Hot-swap complete: database updated to v${remoteManifest.version}.`);
      return true;
    } catch (err: any) {
      console.error('[open-pl-address] Background update error:', err.message);
      return false;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Performs atomic file swap and safely re-attaches the database connection.
   */
  public async hotSwapDatabase(newDbPath: string): Promise<void> {
    const oldDb = this.activeDb;

    // Create new adapter and test it
    const newDbAdapter = createSqliteAdapter(newDbPath, true);
    newDbAdapter.prepare('SELECT count(*) FROM cities').get();

    // Close old DB
    if (oldDb) {
      try {
        oldDb.close();
      } catch {}
    }

    // Atomic move
    fs.renameSync(newDbPath, this.config.dbPath);

    // Reopen at target path
    this.activeDb = createSqliteAdapter(this.config.dbPath, true);
  }

  public close(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.activeDb) {
      this.activeDb.close();
      this.activeDb = null;
    }
  }

  private startPeriodicUpdateCheck(): void {
    const intervalMs = this.config.autoUpdateDays * 24 * 60 * 60 * 1000;
    this.updateTimer = setInterval(() => {
      this.checkForUpdate().catch(() => {});
    }, intervalMs);

    if (this.updateTimer.unref) {
      this.updateTimer.unref();
    }
  }

  private async downloadAndExtractDatabase(): Promise<void> {
    const manifestUrl = `${this.config.updateUrl!.replace(/\/$/, '')}/manifest.json`;
    let manifest: DatabaseManifest | null = null;
    try {
      manifest = await this.fetchJson<DatabaseManifest>(manifestUrl);
    } catch {}

    const gzFile = manifest?.compressedFile ?? 'pl_addresses.sqlite.gz';
    const downloadUrl = `${this.config.updateUrl!.replace(/\/$/, '')}/${gzFile}`;

    const tempGz = `${this.config.dbPath}.download.gz`;
    const tempDb = `${this.config.dbPath}.download`;

    await this.downloadRemoteFile(downloadUrl, tempGz);

    const source = fs.createReadStream(tempGz);
    const target = fs.createWriteStream(tempDb);
    const gunzip = zlib.createGunzip();
    await pipeline(source, gunzip, target);
    fs.unlinkSync(tempGz);

    if (manifest?.sha256) {
      const actualSha = await this.calculateSha256(tempDb);
      if (actualSha !== manifest.sha256) {
        fs.unlinkSync(tempDb);
        throw new Error(`Database corrupted during download: SHA mismatch.`);
      }
    }

    const dir = path.dirname(this.config.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.renameSync(tempDb, this.config.dbPath);
  }

  private async calculateSha256(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    return hash.digest('hex');
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    const getProtocol = (u: string) => (u.startsWith('https') ? https : http);

    return new Promise((resolve) => {
      const client = getProtocol(url);
      client.get(url, { headers: { 'User-Agent': 'open-pl-address-sdk' } }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            resolve(null);
          }
        });
        res.on('error', () => resolve(null));
      }).on('error', () => resolve(null));
    });
  }

  private async downloadRemoteFile(url: string, destPath: string): Promise<void> {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(destPath);
      const getProtocol = (u: string) => (u.startsWith('https') ? https : http);

      const client = getProtocol(url);
      client.get(url, { headers: { 'User-Agent': 'open-pl-address-sdk' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          this.downloadRemoteFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
          return;
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }
}
