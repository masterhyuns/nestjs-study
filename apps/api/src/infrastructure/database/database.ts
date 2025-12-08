/**
 * Kysely 데이터베이스 인스턴스
 *
 * @why-kysely
 * Kysely를 선택한 이유:
 * 1. **외부 바이너리 불필요**: Prisma처럼 엔진 다운로드 문제 없음
 * 2. **Type-safe SQL**: 컴파일 타임에 SQL 쿼리 검증
 * 3. **SQLite 완벽 지원**: better-sqlite3 사용
 * 4. **유연성**: Raw SQL + Type safety 조합
 *
 * @architecture
 * - 싱글톤 패턴으로 데이터베이스 인스턴스 관리
 * - NestJS Module에서 Provider로 주입
 * - Transaction 지원
 */

import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Database as DatabaseSchema } from './types';

/**
 * @function createDatabase
 * Kysely 데이터베이스 인스턴스 생성
 *
 * @param databasePath - SQLite 데이터베이스 파일 경로
 * @returns Kysely<DatabaseSchema> 인스턴스
 *
 * @why-better-sqlite3
 * better-sqlite3를 사용하는 이유:
 * - 가장 빠른 SQLite Node.js 드라이버
 * - 동기식 API (async/await 불필요)
 * - Kysely 공식 지원
 */
export const createDatabase = (databasePath: string) => {
  /**
   * @dialect SqliteDialect
   * Kysely에 SQLite 방언(dialect) 설정
   *
   * @options
   * - verbose: SQL 쿼리 로깅 (개발 환경에서만)
   * - fileMustExist: false → 파일 없으면 자동 생성
   */
  const dialect = new SqliteDialect({
    database: new Database(databasePath, {
      // 개발 환경에서 SQL 로깅 활성화
      verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      // 파일 없으면 자동 생성
      fileMustExist: false,
    }),
  });

  /**
   * @instance Kysely
   * Type-safe SQL query builder 인스턴스
   *
   * @generic DatabaseSchema
   * 데이터베이스 스키마 타입을 제네릭으로 전달하여
   * 모든 쿼리에서 타입 안정성 보장
   */
  return new Kysely<DatabaseSchema>({
    dialect,
    // SQL 쿼리 로깅 (개발 환경)
    log: (event) => {
      if (process.env.NODE_ENV === 'development') {
        if (event.level === 'query') {
          console.log('[Kysely Query]', event.query.sql);
          console.log('[Kysely Params]', event.query.parameters);
        }
        if (event.level === 'error') {
          console.error('[Kysely Error]', event.error);
        }
      }
    },
  });
};

/**
 * @type DB
 * Kysely 데이터베이스 인스턴스 타입
 *
 * @usage
 * ```typescript
 * import { DB } from './database';
 *
 * const users = await db
 *   .selectFrom('users')
 *   .selectAll()
 *   .execute();
 * ```
 */
export type DB = Kysely<DatabaseSchema>;
