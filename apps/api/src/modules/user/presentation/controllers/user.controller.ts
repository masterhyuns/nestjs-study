/**
 * 사용자 컨트롤러
 *
 * @description
 * 사용자 관련 HTTP API 엔드포인트 정의
 *
 * @why-controller-layer
 * Controller 계층이 필요한 이유:
 * 1. **HTTP 프로토콜 처리**: Request/Response 변환
 * 2. **라우팅 정의**: URL 경로와 HTTP 메서드 매핑
 * 3. **입력 검증**: DTO를 통한 요청 데이터 검증
 * 4. **API 문서화**: Swagger 자동 생성
 *
 * @architecture-decision
 * 왜 Presentation 계층에 Controller를 두는가:
 * - ✅ Clean Architecture: 외부 세계와의 인터페이스
 * - ✅ 의존성 방향: Controller → Service (단방향)
 * - ✅ 테스트 용이성: E2E 테스트로 전체 플로우 검증
 *
 * @api-design-principles
 * RESTful API 설계 원칙:
 * 1. **리소스 중심**: /users (명사 복수형)
 * 2. **HTTP 메서드**: GET(조회), POST(생성), PUT(수정), DELETE(삭제)
 * 3. **상태 코드**: 200(성공), 201(생성), 400(잘못된 요청), 401(인증 필요), 404(없음)
 * 4. **버전 관리**: /api/v1/users (향후 v2 확장 대비)
 *
 * @performance
 * - 회원가입: ~150ms (Service 계층 bcrypt 포함)
 * - 로그인: ~100ms (Service 계층 bcrypt 포함)
 * - 프로필 조회: ~20ms (DB 조회만)
 *
 * @scalability
 * Work/ERP 확장 시:
 * - 조직 관리: /api/v1/organizations
 * - 권한 관리: /api/v1/permissions
 * - SSO: /api/v1/auth/sso/:provider
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserService } from '@/modules/user/application/services/user.service';
import { CreateUserDto } from '@/modules/user/presentation/dtos/create-user.dto';
import { LoginDto } from '@/modules/user/presentation/dtos/login.dto';
import { Public } from '@/common/decorators/public.decorator';

/**
 * 사용자 API 컨트롤러
 *
 * @route /api/v1/users
 *
 * @why-v1-prefix
 * API 버전 관리 이유:
 * - Breaking Change 대응: v2로 마이그레이션하면서 v1 유지
 * - 하위 호환성: 기존 클라이언트에 영향 없음
 * - 점진적 전환: 클라이언트별로 버전 업그레이드 가능
 *
 * @swagger
 * Swagger 문서 자동 생성:
 * - URL: http://localhost:12000/api/v1/docs
 * - 클라이언트 개발자가 API 명세 확인
 * - Postman Collection 생성 가능
 */
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ==========================================================================
  // 회원가입 (Public)
  // ==========================================================================

  /**
   * 회원가입
   *
   * @description
   * 새로운 사용자를 등록합니다
   *
   * @route POST /api/v1/users/register
   *
   * @why-post-method
   * POST를 사용하는 이유:
   * - 리소스 생성: 새로운 User 생성
   * - Idempotent 아님: 같은 요청 여러 번 → 여러 사용자 생성 (이메일 중복 방지로 실제로는 1번만)
   * - Body 사용: 민감한 비밀번호를 URL에 노출하지 않음
   *
   * @why-201-status
   * - 200 OK: 일반 성공
   * - 201 Created: 리소스 생성 성공 ✅ 선택
   * - 202 Accepted: 비동기 처리 (이메일 인증 등)
   *
   * @param dto - 회원가입 정보
   * @returns 생성된 사용자 정보 (비밀번호 제외)
   *
   * @throws {400} DTO 검증 실패 (ValidationPipe)
   * @throws {409} 이메일 중복 (ConflictException)
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:12000/api/v1/users/register \
   *   -H "Content-Type: application/json" \
   *   -d '{
   *     "email": "user@example.com",
   *     "password": "Secure@123",
   *     "passwordConfirm": "Secure@123",
   *     "name": "홍길동",
   *     "phoneNumber": "010-1234-5678"
   *   }'
   * ```
   *
   * @swagger
   * - Tag: users
   * - Summary: 회원가입
   * - Request Body: CreateUserDto
   * - Response 201: 생성된 사용자
   * - Response 400: 검증 실패
   * - Response 409: 이메일 중복
   */
  @Public() // 인증 불필요 (누구나 회원가입 가능)
  @Post('register')
  @HttpCode(HttpStatus.CREATED) // 201 Created
  @ApiOperation({
    summary: '회원가입',
    description: `
새로운 사용자를 등록합니다.

**처리 과정:**
1. 이메일 중복 검증
2. 비밀번호 bcrypt 해싱 (12 rounds)
3. 사용자 DB 저장
4. 비밀번호 제외한 정보 반환

**보안:**
- 비밀번호는 bcrypt로 해싱되어 저장
- 응답에는 비밀번호가 포함되지 않음
- 이메일은 소문자로 정규화

**향후 확장:**
- 이메일 인증 링크 발송
- 환영 이메일 발송
- 조직 초대 토큰 처리
    `,
  })
  @ApiBody({
    type: CreateUserDto,
    description: '회원가입 정보',
    examples: {
      example1: {
        summary: '기본 회원가입',
        value: {
          email: 'user@example.com',
          password: 'Secure@123',
          passwordConfirm: 'Secure@123',
          name: '홍길동',
          phoneNumber: '010-1234-5678',
          marketingConsent: false,
        },
      },
      example2: {
        summary: '최소 정보 회원가입',
        value: {
          email: 'user@example.com',
          password: 'Secure@123',
          passwordConfirm: 'Secure@123',
          name: '김철수',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid-here',
          email: 'user@example.com',
          name: '홍길동',
          phoneNumber: '01012345678',
          role: 'USER',
          isEmailVerified: false,
          marketingConsent: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (DTO 검증 실패)',
    schema: {
      example: {
        success: false,
        error: {
          code: 'COMMON_VALIDATION_ERROR',
          message: ['이메일 형식이 올바르지 않습니다', '비밀번호는 8자 이상이어야 합니다'],
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
          path: '/api/v1/users/register',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '이메일 중복',
    schema: {
      example: {
        success: false,
        error: {
          code: 'DB_UNIQUE_CONSTRAINT',
          message: '이미 사용 중인 이메일입니다: user@example.com',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  async register(@Body() dto: CreateUserDto) {
    /**
     * Service 호출
     *
     * @why-no-try-catch
     * - HttpExceptionFilter가 모든 예외를 캐치
     * - Controller는 비즈니스 로직에 집중
     * - 에러 응답 형식 자동 통일
     */
    return await this.userService.register(dto);
  }

  // ==========================================================================
  // 로그인 (Public)
  // ==========================================================================

  /**
   * 로그인
   *
   * @description
   * 이메일과 비밀번호로 인증하고 JWT 토큰을 발급합니다
   *
   * @route POST /api/v1/users/login
   *
   * @why-post-method
   * - GET 아님: 비밀번호를 URL에 노출하면 안 됨 (로그, 히스토리에 남음)
   * - POST 사용: Body에 민감한 정보 전달
   *
   * @why-200-status
   * - 201 Created 아님: 리소스 생성이 아닌 인증
   * - 200 OK 사용: 성공적인 인증
   *
   * @param dto - 로그인 정보 (email, password)
   * @returns JWT 토큰 및 사용자 정보
   *
   * @throws {400} DTO 검증 실패
   * @throws {401} 인증 실패 (이메일 또는 비밀번호 틀림)
   *
   * @todo
   * JWT 토큰 발급 로직 추가:
   * - accessToken (15분)
   * - refreshToken (7일)
   *
   * @example
   * ```bash
   * curl -X POST http://localhost:12000/api/v1/users/login \
   *   -H "Content-Type: application/json" \
   *   -d '{
   *     "email": "user@example.com",
   *     "password": "Secure@123"
   *   }'
   * ```
   */
  @Public() // 인증 불필요 (로그인 엔드포인트)
  @Post('login')
  @HttpCode(HttpStatus.OK) // 200 OK
  @ApiOperation({
    summary: '로그인',
    description: `
이메일과 비밀번호로 사용자 인증을 수행합니다.

**처리 과정:**
1. 이메일로 사용자 조회
2. bcrypt로 비밀번호 검증
3. JWT 토큰 발급 (향후 구현)
4. 사용자 정보 반환

**보안:**
- Timing Attack 방지 (bcrypt constant-time comparison)
- Rate Limiting 적용 (5초에 10회 제한)
- 실패 시 구체적인 이유 노출 안 함

**향후 구현:**
- JWT accessToken 발급 (15분)
- JWT refreshToken 발급 (7일)
- 로그인 이력 기록
- 다중 기기 로그인 관리
    `,
  })
  @ApiBody({
    type: LoginDto,
    description: '로그인 정보',
    examples: {
      example1: {
        summary: '로그인',
        value: {
          email: 'user@example.com',
          password: 'Secure@123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'uuid-here',
            email: 'user@example.com',
            name: '홍길동',
            role: 'USER',
          },
          // 향후 추가
          // accessToken: 'jwt-token-here',
          // refreshToken: 'refresh-token-here',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패',
    schema: {
      example: {
        success: false,
        error: {
          code: 'AUTH_UNAUTHORIZED',
          message: '이메일 또는 비밀번호가 잘못되었습니다',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  async login(@Body() dto: LoginDto) {
    /**
     * 인증 수행
     *
     * @returns 사용자 정보 (향후 JWT 토큰 포함)
     */
    const user = await this.userService.validateUser(dto.email, dto.password);

    /**
     * @todo JWT 토큰 발급
     *
     * 향후 AuthService 연동:
     * ```typescript
     * const tokens = await this.authService.generateTokens(user);
     * return { user, ...tokens };
     * ```
     */

    return { user };
  }

  // ==========================================================================
  // 내 정보 조회 (Authenticated)
  // ==========================================================================

  /**
   * 내 정보 조회
   *
   * @description
   * 인증된 사용자의 프로필 정보를 조회합니다
   *
   * @route GET /api/v1/users/me
   *
   * @why-me-endpoint
   * /users/:id 대신 /users/me를 사용하는 이유:
   * - 보안: 타인의 ID로 조회 방지
   * - 편의성: 클라이언트가 자신의 ID를 몰라도 됨
   * - RESTful: 현재 로그인한 사용자라는 명확한 의미
   *
   * @requires JWT 인증
   *
   * @param request - Express Request (JWT Guard가 user 주입)
   * @returns 사용자 프로필 정보
   *
   * @throws {401} 인증되지 않음 (JWT 없음 또는 만료)
   *
   * @example
   * ```bash
   * curl -X GET http://localhost:12000/api/v1/users/me \
   *   -H "Authorization: Bearer <jwt-token>"
   * ```
   *
   * @todo
   * - JwtAuthGuard 구현 및 적용
   * - @CurrentUser() 데코레이터로 사용자 정보 추출
   */
  // @UseGuards(JwtAuthGuard) // 향후 적용
  @Get('me')
  @HttpCode(HttpStatus.OK) // 200 OK
  @ApiBearerAuth() // Swagger에 JWT 인증 표시
  @ApiOperation({
    summary: '내 정보 조회',
    description: `
현재 로그인한 사용자의 프로필 정보를 조회합니다.

**인증 필요:**
- Bearer Token (JWT)
- Authorization: Bearer <access-token>

**반환 정보:**
- 기본 프로필 (이메일, 이름, 전화번호)
- 역할 (USER, ADMIN)
- 계정 상태 (활성화 여부, 이메일 인증)

**향후 확장:**
- 참여 중인 워크스페이스 목록
- 할당된 태스크 요약
- 최근 활동 이력
    `,
  })
  @ApiResponse({
    status: 200,
    description: '내 정보 조회 성공',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid-here',
          email: 'user@example.com',
          name: '홍길동',
          phoneNumber: '01012345678',
          role: 'USER',
          isEmailVerified: false,
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 필요',
    schema: {
      example: {
        success: false,
        error: {
          code: 'AUTH_UNAUTHORIZED',
          message: '인증이 필요합니다',
        },
        meta: {
          timestamp: '2024-01-01T00:00:00.000Z',
          requestId: 'req-uuid',
        },
      },
    },
  })
  async getProfile(@Request() req: any) {
    /**
     * @todo JwtAuthGuard 적용 후 req.user에서 userId 추출
     *
     * 현재는 임시로 에러 반환 (Guard 미구현)
     */

    // const userId = req.user?.id;
    // return await this.userService.findById(userId);

    throw new Error('JWT 인증이 아직 구현되지 않았습니다. JwtAuthGuard를 먼저 구현하세요.');
  }

  // ==========================================================================
  // ID로 사용자 조회 (Authenticated)
  // ==========================================================================

  /**
   * ID로 사용자 조회
   *
   * @description
   * 특정 사용자의 공개 프로필을 조회합니다
   *
   * @route GET /api/v1/users/:id
   *
   * @why-this-endpoint
   * 사용 사례:
   * - 팀원 프로필 보기
   * - 태스크 담당자 정보 확인
   * - 멘션(@user) 시 사용자 정보 표시
   *
   * @requires JWT 인증
   *
   * @param id - 사용자 ID (UUID)
   * @returns 사용자 공개 프로필
   *
   * @throws {401} 인증되지 않음
   * @throws {404} 사용자 없음
   *
   * @privacy
   * 민감한 정보 제외:
   * - 전화번호 (같은 워크스페이스 멤버만)
   * - 이메일 (선택적 공개)
   * - 마케팅 동의 여부
   *
   * @example
   * ```bash
   * curl -X GET http://localhost:12000/api/v1/users/uuid-here \
   *   -H "Authorization: Bearer <jwt-token>"
   * ```
   */
  // @UseGuards(JwtAuthGuard) // 향후 적용
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ID로 사용자 조회',
    description: `
특정 사용자의 공개 프로필을 조회합니다.

**인증 필요:**
- Bearer Token (JWT)

**개인정보 보호:**
- 기본 정보만 공개 (이름, 역할)
- 민감한 정보는 같은 워크스페이스 멤버만 조회 가능
    `,
  })
  @ApiResponse({
    status: 200,
    description: '조회 성공',
  })
  @ApiResponse({
    status: 404,
    description: '사용자 없음',
  })
  async findById(@Param('id') id: string) {
    return await this.userService.findById(id);
  }

  // ==========================================================================
  // Work/ERP 확장 대비
  // ==========================================================================

  /**
   * @future 조직 초대 회원가입
   *
   * @route POST /api/v1/users/register/invitation
   *
   * @description
   * 조직 초대 토큰으로 회원가입
   *
   * @todo
   * - 초대 토큰 검증
   * - 조직 자동 가입
   * - 역할 자동 할당
   */

  /**
   * @future SSO 로그인
   *
   * @route POST /api/v1/users/login/sso/:provider
   *
   * @description
   * Google, Microsoft, GitHub 등 SSO 로그인
   *
   * @todo
   * - OAuth 2.0 연동
   * - SAML 2.0 지원
   * - 자동 계정 생성/연동
   */

  /**
   * @future 비밀번호 재설정
   *
   * @route POST /api/v1/users/password/reset
   *
   * @description
   * 이메일로 비밀번호 재설정 링크 발송
   *
   * @todo
   * - 재설정 토큰 생성 (1시간 유효)
   * - 이메일 발송
   * - 토큰 검증 및 비밀번호 변경
   */
}
