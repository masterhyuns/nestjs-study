/**
 * Database Module
 *
 * @why-module
 * NestJS에서 Kysely 데이터베이스 인스턴스를 Provider로 관리
 * - 싱글톤 패턴
 * - 의존성 주입
 * - 라이프사이클 관리
 */

import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createDatabase, DB } from './database';

/**
 * @token DATABASE_PROVIDER
 * Kysely 데이터베이스 인스턴스 주입 토큰
 *
 * @usage
 * ```typescript
 * @Injectable()
 * export class UserRepository {
 *   constructor(
 *     @Inject(DATABASE_PROVIDER) private readonly db: DB,
 *   ) {}
 * }
 * ```
 */
export const DATABASE_PROVIDER = 'DATABASE_PROVIDER';

/**
 * @class DatabaseModule
 * Kysely 데이터베이스 모듈
 *
 * @why-global
 * @Global() 데코레이터로 전역 모듈 설정:
 * - 모든 모듈에서 import 없이 사용 가능
 * - 싱글톤 인스턴스 보장
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        /**
         * @env DATABASE_URL
         * SQLite 데이터베이스 파일 경로
         *
         * 예: "file:./prisma/dev.db"
         * → "./prisma/dev.db" 추출
         */
        const databaseUrl = configService.get<string>('DATABASE_URL', 'file:./database/dev.db');

        /**
         * @path databasePath
         * "file:" 접두사 제거
         */
        const databasePath = databaseUrl.replace(/^file:/, '');

        console.log('[DatabaseModule] Connecting to:', databasePath);

        /**
         * @instance db
         * Kysely 데이터베이스 인스턴스 생성
         */
        const db = createDatabase(databasePath);

        return db;
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_PROVIDER],
})
export class DatabaseModule implements OnModuleDestroy {
  /**
   * @lifecycle onModuleDestroy
   * 애플리케이션 종료 시 데이터베이스 연결 해제
   *
   * @why-cleanup
   * SQLite 파일 락 해제 및 리소스 정리
   */
  async onModuleDestroy() {
    console.log('[DatabaseModule] Disconnecting database...');
    // Kysely는 자동으로 리소스 정리됨 (better-sqlite3)
  }
}
