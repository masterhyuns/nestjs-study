/**
 * 데이터베이스 마이그레이션 실행 스크립트
 *
 * @why-manual-migration
 * Kysely는 Prisma처럼 자동 마이그레이션 도구가 없습니다.
 * 대신 SQL 파일을 직접 작성하고 순차적으로 실행합니다.
 *
 * @advantages
 * 1. **완전한 제어**: SQL을 직접 작성하므로 정확한 제어 가능
 * 2. **버전 관리**: Git으로 SQL 파일 버전 관리
 * 3. **성능 최적화**: 인덱스, 트리거 등 세밀한 조정 가능
 *
 * @usage
 * ```bash
 * # 마이그레이션 실행
 * pnpm db:migrate
 *
 * # 롤백 (수동)
 * pnpm db:rollback
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Database from 'better-sqlite3';
import { config } from 'dotenv';

// .env 파일 로드
config();

/**
 * @constant MIGRATIONS_DIR
 * 마이그레이션 SQL 파일 디렉토리
 */
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * @constant DATABASE_PATH
 * SQLite 데이터베이스 파일 경로
 */
const DATABASE_URL = process.env.DATABASE_URL || 'file:./database/dev.db';
const DATABASE_PATH = DATABASE_URL.replace(/^file:/, '');

/**
 * @function createMigrationsTable
 * 마이그레이션 이력 테이블 생성
 *
 * @why-migrations-table
 * 실행된 마이그레이션을 추적하여 중복 실행 방지
 */
const createMigrationsTable = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

/**
 * @function getExecutedMigrations
 * 이미 실행된 마이그레이션 목록 조회
 *
 * @returns 실행된 마이그레이션 파일명 배열
 */
const getExecutedMigrations = (db: Database.Database): string[] => {
  const rows = db.prepare('SELECT name FROM migrations ORDER BY id').all() as { name: string }[];
  return rows.map((row) => row.name);
};

/**
 * @function getPendingMigrations
 * 아직 실행되지 않은 마이그레이션 목록 조회
 *
 * @returns 실행 대기 중인 마이그레이션 파일 배열
 */
const getPendingMigrations = (executedMigrations: string[]): string[] => {
  const allMigrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort(); // 파일명 순서대로 정렬 (001_, 002_, ...)

  return allMigrationFiles.filter((file) => !executedMigrations.includes(file));
};

/**
 * @function executeMigration
 * 마이그레이션 SQL 파일 실행
 *
 * @param db - SQLite 데이터베이스 인스턴스
 * @param filename - 마이그레이션 파일명
 */
const executeMigration = (db: Database.Database, filename: string) => {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`[Migration] Executing: ${filename}`);

  try {
    // SQL 파일 실행 (트랜잭션으로 감싸기)
    db.exec('BEGIN TRANSACTION');
    db.exec(sql);

    // 마이그레이션 이력 저장
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(filename);

    db.exec('COMMIT');

    console.log(`[Migration] ✓ Success: ${filename}`);
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`[Migration] ✗ Failed: ${filename}`);
    throw error;
  }
};

/**
 * @function runMigrations
 * 모든 pending 마이그레이션 실행
 */
const runMigrations = () => {
  console.log('[Migration] Starting migrations...');
  console.log(`[Migration] Database path: ${DATABASE_PATH}`);

  // 데이터베이스 연결
  const db = new Database(DATABASE_PATH, {
    verbose: console.log,
  });

  try {
    // 마이그레이션 테이블 생성
    createMigrationsTable(db);

    // 실행된 마이그레이션 목록 조회
    const executedMigrations = getExecutedMigrations(db);
    console.log(`[Migration] Already executed: ${executedMigrations.length} migrations`);

    // Pending 마이그레이션 목록 조회
    const pendingMigrations = getPendingMigrations(executedMigrations);

    if (pendingMigrations.length === 0) {
      console.log('[Migration] No pending migrations.');
      return;
    }

    console.log(`[Migration] Pending migrations: ${pendingMigrations.length}`);

    // 각 마이그레이션 실행
    for (const filename of pendingMigrations) {
      executeMigration(db, filename);
    }

    console.log('[Migration] ✓ All migrations completed successfully!');
  } catch (error) {
    console.error('[Migration] ✗ Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
};

/**
 * @entrypoint
 * 스크립트 실행
 */
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
