/**
 * Logger Module
 *
 * @description
 * 구조화된 로깅을 제공하는 모듈
 *
 * @why-global-module
 * Global 모듈로 선언하는 이유:
 * - 모든 곳에서 StructuredLoggerService를 import 없이 사용 가능
 * - Interceptor, Filter, Service에서 의존성 주입으로 사용
 * - 로깅 방식 변경 시 한 곳만 수정
 *
 * @usage
 * ```typescript
 * // app.module.ts
 * imports: [LoggerModule]
 *
 * // 모든 Service, Controller, Filter, Interceptor에서 사용
 * constructor(private readonly logger: StructuredLoggerService) {}
 * ```
 */

import { Global, Module } from '@nestjs/common';
import { StructuredLoggerService } from './structured-logger.service';

@Global()
@Module({
  providers: [StructuredLoggerService],
  exports: [StructuredLoggerService],
})
export class LoggerModule {}
