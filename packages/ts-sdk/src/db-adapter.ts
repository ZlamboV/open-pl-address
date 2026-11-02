import { DatabaseSync } from 'node:sqlite';
import type { ISqliteDatabase, ISqliteStatement } from './types.ts';

/**
 * Adapter wrapping Node.js built-in DatabaseSync (node:sqlite).
 */
export class NodeSqliteAdapter implements ISqliteDatabase {
  private db: DatabaseSync;

  constructor(filePath: string, options: { readOnly?: boolean } = {}) {
    this.db = new DatabaseSync(filePath, { readOnly: options.readOnly ?? false });
  }

  public prepare(sql: string): ISqliteStatement {
    const stmt = this.db.prepare(sql);
    return {
      all: (...params: unknown[]) => stmt.all(...(params as any[])),
      get: (...params: unknown[]) => stmt.get(...(params as any[])),
      run: (...params: unknown[]) => {
        const res = stmt.run(...(params as any[]));
        return {
          changes: Number(res.changes),
          lastInsertRowid: res.lastInsertRowid,
        };
      },
    };
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public close(): void {
    this.db.close();
  }
}

/**
 * Factory function to instantiate SQLite connection.
 * Attempts to use better-sqlite3 if present in runtime; otherwise falls back to node:sqlite.
 */
export function createSqliteAdapter(filePath: string, readOnly = true): ISqliteDatabase {
  return new NodeSqliteAdapter(filePath, { readOnly });
}
