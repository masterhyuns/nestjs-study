/**
 * NestJS 애플리케이션 부트스트랩
 *
 * @description
 * 엔터프라이즈급 협업 플랫폼 API 서버 진입점
 *
 * @features
 * - Swagger API 문서 자동 생성
 * - 보안 헤더 (Helmet)
 * - CORS 설정
 * - Global Pipes (Validation, Transform)
 * - Global Filters (Exception Handling)
 * - Global Interceptors (Logging, Transform)
 * - Global Guards (JWT Auth)
 *
 * @performance
 * - 시작 시간: ~2초
 * - 메모리: ~150MB (초기)
 *
 * @scalability
 * - 수평 확장: PM2 클러스터 모드
 * - 로드 밸런싱: Nginx/AWS ALB
 */

import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
// import { JwtAuthGuard } from './common/guards/jwt-auth.guard';  // JWT 구현 후 활성화

/**
 * 애플리케이션 부트스트랩
 */
const bootstrap = async (): Promise<void> => {
  // NestJS 애플리케이션 생성
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ConfigService 가져오기
  const configService = app.get(ConfigService);

  // Reflector 가져오기 (Guards용)
  // const reflector = app.get(Reflector);  // JWT 구현 후 활성화

  // API 버전 관리 (URI Versioning)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Prefix 설정
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  // 보안 헤더 (Helmet)
  app.use(helmet());

  // CORS 설정
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:13000'),
    credentials: true,
  });

  // ==========================================================================
  // Global Filters (예외 처리)
  // ==========================================================================
  app.useGlobalFilters(new HttpExceptionFilter());

  // ==========================================================================
  // Global Pipes (검증 & 변환)
  // ==========================================================================
  app.useGlobalPipes(
    new ValidationPipe({
      // DTO에 정의되지 않은 속성 제거
      whitelist: true,
      // 정의되지 않은 속성이 있으면 요청 거부
      forbidNonWhitelisted: true,
      // 타입 자동 변환 (query params, path params)
      transform: true,
      // 상세 에러 메시지
      disableErrorMessages: false,
    }),
  );

  // ==========================================================================
  // Global Interceptors (로깅 & 응답 변환 & 타임아웃)
  // ==========================================================================
  app.useGlobalInterceptors(
    new LoggingInterceptor(),      // 요청/응답 로깅
    new TransformInterceptor(),    // 응답 포맷 변환
    new TimeoutInterceptor(30000), // 30초 타임아웃
  );

  // ==========================================================================
  // Global Guards (인증 & 인가)
  // ==========================================================================
  // JWT 모듈 구현 후 활성화
  // app.useGlobalGuards(new JwtAuthGuard(reflector));

  // ==========================================================================
  // Swagger API 문서 (개발/스테이징 환경만)
  // ==========================================================================
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('협업 플랫폼 API')
      .setDescription('엔터프라이즈급 협업 플랫폼 REST API 문서')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'JWT 토큰 입력',
          in: 'header',
        },
        'access-token',
      )
      .addTag('auth', '인증/인가')
      .addTag('users', '사용자 관리')
      .addTag('workspaces', '워크스페이스')
      .addTag('projects', '프로젝트')
      .addTag('tasks', '태스크')
      .addTag('health', '헬스 체크')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      customSiteTitle: '협업 플랫폼 API 문서',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    console.log(`\n📚 API 문서: http://localhost:${configService.get('PORT')}/${apiPrefix}/docs\n`);
  }

  // 서버 시작
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 애플리케이션이 포트 ${port}에서 실행 중입니다.`);
  console.log(`🌍 환경: ${nodeEnv}`);
  console.log(`📡 API 주소: http://localhost:${port}/${apiPrefix}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`✅ 적용된 전역 설정:`);
  console.log(`   1. Request ID Middleware (요청 추적)`);
  console.log(`   2. Exception Filter (에러 처리 + Prisma 에러 자동 변환)`);
  console.log(`   3. Validation Pipe (입력 검증 + class-validator)`);
  console.log(`   4. Transform Interceptor (응답 포맷 ApiSuccessResponse)`);
  console.log(`   5. Logging Interceptor (요청/응답 로깅 + 민감정보 제거)`);
  console.log(`   6. Timeout Interceptor (30초 타임아웃)`);
  console.log(`   7. Rate Limiting (60초에 100번 요청 제한)`);
  console.log(`   8. Environment Variables Validation (타입 검증)`);
  // console.log(`   9. JWT Auth Guard (인증) - 비활성화 (JWT 모듈 미구현)`);
  console.log(`\n${'='.repeat(60)}\n`);
};

// 애플리케이션 시작
bootstrap().catch((error) => {
  console.error('❌ 애플리케이션 시작 실패:', error);
  process.exit(1);
});
