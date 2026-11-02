import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { AddressDatabaseManager } from '../src/db-manager.ts';

test('AddressDatabaseManager - initialization and query execution', async () => {
  const dbPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const manager = new AddressDatabaseManager({ dbPath });

  const db = await manager.initialize();
  assert.ok(db, 'Active DB should exist');

  const cityCount = (db.prepare('SELECT count(*) as cnt FROM cities').get() as any).cnt;
  assert.ok(cityCount > 0, 'Should have cities loaded');

  manager.close();
});

test('AddressDatabaseManager - Hot-swap safely replaces database without downtime', async () => {
  const originalPath = path.resolve(process.cwd(), 'data/pl_addresses.sqlite');
  const testDbDir = path.resolve(process.cwd(), 'data/test-hotswap');
  if (!fs.existsSync(testDbDir)) fs.mkdirSync(testDbDir, { recursive: true });

  const activePath = path.join(testDbDir, 'current.sqlite');
  const newPath = path.join(testDbDir, 'new.sqlite');

  // Copy initial DB
  fs.copyFileSync(originalPath, activePath);
  fs.copyFileSync(originalPath, newPath);

  const manager = new AddressDatabaseManager({ dbPath: activePath });
  const db1 = await manager.initialize();

  // Verify can query initial DB
  const initialCities = (manager.getDatabase().prepare('SELECT count(*) as cnt FROM cities').get() as any).cnt;
  assert.ok(initialCities > 0);

  // Perform hot swap
  await manager.hotSwapDatabase(newPath);

  // Verify connection still works post hot-swap
  const postSwapCities = (manager.getDatabase().prepare('SELECT count(*) as cnt FROM cities').get() as any).cnt;
  assert.strictEqual(postSwapCities, initialCities);

  manager.close();

  // Cleanup test dir
  try {
    fs.rmSync(testDbDir, { recursive: true, force: true });
  } catch {}
});
