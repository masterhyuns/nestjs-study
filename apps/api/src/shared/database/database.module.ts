/**
 * Database Module
 *
 * @description
 * 데이터베이스 관련 서비스를 제공하는 전역 모듈
 *
 * @exports
 * - PrismaService: Prisma Client
 */

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
