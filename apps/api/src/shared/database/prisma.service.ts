/**
 * Prisma Service
 *
 * @description
 * Prisma Client를 NestJS Injectable로 래핑
 * 애플리케이션 생명주기 관리 (연결/종료)
 *
 * @usage
 * ```typescript
 * constructor(private readonly prisma: PrismaService) {}
 *
 * await this.prisma.user.findMany();
 * await this.prisma.$queryRaw`SELECT * FROM users`;
 * ```
 *
 * @performance
 * - Connection Pool: 기본 설정 사용
 * - Query Logging: 개발 환경에서만 활성화
 */

import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly configService: ConfigService) {
    super({
      log:
        configService.get('NODE_ENV') === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
      errorFormat: 'colorless',
    });
  }

  /**
   * 모듈 초기화 시 데이터베이스 연결
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('✅ 데이터베이스 연결 성공');
    } catch (error) {
      this.logger.error('❌ 데이터베이스 연결 실패:', error);
      throw error;
    }
  }

  /**
   * 모듈 종료 시 데이터베이스 연결 해제
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('📡 데이터베이스 연결 종료');
  }

  /**
   * 헬스 체크
   *
   * @returns true if connected
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
