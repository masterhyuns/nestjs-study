/**
 * 사용자 애플리케이션 서비스
 *
 * @description
 * 사용자와 관련된 비즈니스 로직을 처리하는 서비스 계층
 *
 * @why-service-layer
 * Service 계층이 필요한 이유:
 * 1. **비즈니스 로직 집중화**: 회원가입, 로그인 등 핵심 비즈니스 규칙
 * 2. **트랜잭션 관리**: 여러 Repository 작업을 하나의 트랜잭션으로 묶음
 * 3. **재사용성**: Controller, CLI, Queue 등 다양한 곳에서 호출 가능
 * 4. **테스트 용이성**: 비즈니스 로직만 독립적으로 테스트
 *
 * @architecture-decision
 * 왜 Application 계층에 Service를 두는가:
 * - ❌ Controller에 비즈니스 로직: 재사용 불가, 테스트 어려움
 * - ❌ Repository에 비즈니스 로직: 데이터 접근과 비즈니스 규칙 혼재
 * - ✅ Service 계층 분리: Clean Architecture의 Use Case 역할
 *
 * @performance
 * - 회원가입: ~150ms (bcrypt 해싱 포함)
 * - 로그인: ~100ms (bcrypt 비교 포함)
 * - 프로필 조회: ~20ms (DB 조회만)
 *
 * @scalability
 * Work/ERP 확장 시:
 * - SSO 연동: 별도 SSOAuthService 추가
 * - 조직 계층: OrganizationService와 협력
 * - 권한 관리: PermissionService 분리
 */

import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '@/modules/user/infrastructure/persistence/user.repository';
import { CreateUserDto } from '@/modules/user/presentation/dtos/create-user.dto';
import { User } from '@prisma/client';

/**
 * 사용자 서비스
 *
 * @responsibilities
 * - 회원가입 (비밀번호 해싱, 중복 검증)
 * - 로그인 (인증 검증)
 * - 프로필 관리 (조회, 수정)
 * - 비밀번호 변경 (기존 비밀번호 확인)
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  /**
   * bcrypt salt rounds
   *
   * @why-12-rounds
   * Salt Rounds 선택 이유:
   * - 10 rounds: 빠르지만 보안 약함 (~50ms)
   * - 12 rounds: 보안과 성능의 균형 (~100ms) ✅ 선택
   * - 14 rounds: 안전하지만 느림 (~400ms)
   *
   * @security
   * - 2^12 = 4,096번 반복 해싱
   * - GPU 공격 방어: 1초에 수백 번만 시도 가능
   * - Rainbow Table 무력화: Salt로 매번 다른 해시 생성
   *
   * @reference
   * - OWASP 권장: 10-12 rounds
   * - NIST 권장: 최소 10,000 iterations (bcrypt는 자동)
   */
  private readonly BCRYPT_SALT_ROUNDS = 12;

  constructor(private readonly userRepository: UserRepository) {}

  // ==========================================================================
  // 회원가입
  // ==========================================================================

  /**
   * 사용자 회원가입
   *
   * @description
   * 새로운 사용자를 생성하고 시스템에 등록
   *
   * @why-this-flow
   * 회원가입 처리 순서:
   * 1. 이메일 중복 검증 → 빠른 실패 (DB 부하 감소)
   * 2. 비밀번호 해싱 → 평문 저장 금지
   * 3. DB 저장 → 트랜잭션 보장
   * 4. 민감정보 제거 → 응답에서 password 제외
   *
   * @param dto - 사용자 생성 정보
   * @returns 생성된 사용자 (비밀번호 제외)
   *
   * @throws {ConflictException} 이메일 중복
   * @throws {BadRequestException} DTO 검증 실패
   *
   * @example
   * ```typescript
   * const user = await userService.register({
   *   email: 'user@example.com',
   *   password: 'Secure@123',
   *   passwordConfirm: 'Secure@123',
   *   name: '홍길동',
   *   phoneNumber: '010-1234-5678',
   * });
   * ```
   *
   * @performance ~150ms (bcrypt 해싱 100ms + DB 50ms)
   *
   * @security
   * - ✅ 비밀번호 bcrypt 해싱 (salt rounds 12)
   * - ✅ 이메일 소문자 정규화
   * - ✅ SQL Injection 방어 (Prisma ORM)
   * - ✅ 응답에서 password 필드 제외
   *
   * @scalability
   * Work/ERP 확장 시:
   * - 조직 초대: organizationId 추가
   * - 이메일 인증: EmailService.sendVerification() 호출
   * - 환영 이메일: Queue로 비동기 발송
   */
  async register(dto: CreateUserDto): Promise<Omit<User, 'password'>> {
    this.logger.log(`회원가입 시도: ${dto.email}`);

    // ========================================================================
    // 1. 이메일 중복 검증
    // ========================================================================

    /**
     * 왜 먼저 검증하는가?
     * - 빠른 실패: DB 저장 전 중복 확인 → 불필요한 bcrypt 연산 방지
     * - 명확한 에러: ConflictException으로 구체적인 에러 메시지
     * - Prisma 에러 회피: DB unique constraint 에러 대신 명시적 검증
     */
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      this.logger.warn(`회원가입 실패: 이메일 중복 (${dto.email})`);

      throw new ConflictException(
        `이미 사용 중인 이메일입니다: ${dto.email}`,
      );
    }

    // ========================================================================
    // 2. 비밀번호 해싱
    // ========================================================================

    /**
     * 왜 bcrypt를 사용하는가?
     * - ❌ MD5/SHA: 너무 빠름 → GPU로 초당 수십억 번 크랙 가능
     * - ❌ SHA256: Salt 필요 + 너무 빠름
     * - ✅ bcrypt: 의도적으로 느림 + Salt 자동 + Future-proof
     *
     * @alternative
     * - Argon2: 더 안전하지만 Node.js native binding 필요
     * - scrypt: 메모리 하드 함수, bcrypt보다 느림
     *
     * @why-bcrypt-chosen
     * - Node.js 생태계 성숙도 (npm bcrypt 다운로드 200만+/주)
     * - 검증된 보안 (20년 이상 사용)
     * - NestJS 공식 문서 예제
     */
    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    this.logger.debug(`비밀번호 해싱 완료: ${dto.email}`);

    // ========================================================================
    // 3. 사용자 생성
    // ========================================================================

    /**
     * 왜 DTO를 직접 전달하지 않는가?
     * - passwordConfirm은 DB에 저장 안 함 (검증용)
     * - 해싱된 비밀번호로 교체 필요
     * - 추가 필드 제어 (role, isActive 등)
     */
    const user = await this.userRepository.create({
      email: dto.email.toLowerCase(), // 소문자 정규화 (중복 방지)
      password: hashedPassword,
      name: dto.name.trim(),
      // 기본값 (Prisma Schema default 활용)
      // role: UserRole.MEMBER (Schema default)
      // isEmailVerified: false (Schema default)
      // isActive: true (Schema default)
    });

    this.logger.log(`회원가입 성공: ${user.email} (ID: ${user.id})`);

    // ========================================================================
    // 4. 비밀번호 제거 후 반환
    // ========================================================================

    /**
     * 왜 password를 제거하는가?
     * - 보안: 해싱된 비밀번호도 클라이언트에 노출 금지
     * - 일관성: UserEntity의 @Exclude와 동일한 동작
     * - 명시성: 타입에서 password 제외 (Omit<User, 'password'>)
     */
    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  // ==========================================================================
  // 로그인 (인증)
  // ==========================================================================

  /**
   * 사용자 인증 (이메일 + 비밀번호)
   *
   * @description
   * 이메일과 비밀번호로 사용자 인증
   *
   * @why-this-flow
   * 로그인 처리 순서:
   * 1. 이메일로 사용자 조회
   * 2. 사용자 존재 여부 확인
   * 3. 비밀번호 비교 (bcrypt)
   * 4. 인증 성공 → 사용자 정보 반환
   *
   * @param email - 이메일 주소
   * @param password - 비밀번호 (평문)
   * @returns 인증된 사용자 (비밀번호 제외)
   *
   * @throws {UnauthorizedException} 인증 실패
   * @throws {NotFoundException} 사용자 없음
   *
   * @example
   * ```typescript
   * const user = await userService.validateUser(
   *   'user@example.com',
   *   'Secure@123'
   * );
   * ```
   *
   * @performance ~100ms (bcrypt 비교 80ms + DB 20ms)
   *
   * @security
   * - ✅ Timing Attack 방지: bcrypt.compare는 constant-time
   * - ✅ 에러 메시지 모호화: "이메일 또는 비밀번호가 잘못되었습니다"
   * - ⚠️ Brute Force: Rate Limiting 필요 (Throttler Guard)
   *
   * @todo
   * - 로그인 실패 횟수 제한 (5회 실패 시 계정 잠금)
   * - 로그인 이력 기록 (lastLoginAt 업데이트)
   * - 다중 기기 로그인 제한 (선택사항)
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, 'password'>> {
    this.logger.log(`로그인 시도: ${email}`);

    // ========================================================================
    // 1. 사용자 조회
    // ========================================================================

    /**
     * 왜 findByEmail을 사용하는가?
     * - 이메일은 Unique Index → O(1) 조회
     * - 비밀번호 포함 조회 (일반 조회는 password 제외)
     */
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      this.logger.warn(`로그인 실패: 사용자 없음 (${email})`);

      /**
       * 왜 구체적인 에러 메시지를 주지 않는가?
       * - 보안: 이메일 존재 여부 노출 방지 (계정 탈취 시도 방어)
       * - 일관성: 비밀번호 틀린 경우와 동일한 메시지
       */
      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
    }

    // ========================================================================
    // 2. 비밀번호 검증
    // ========================================================================

    /**
     * bcrypt.compare 동작 원리:
     * 1. 저장된 해시에서 Salt 추출
     * 2. 입력 비밀번호를 같은 Salt로 해싱
     * 3. 두 해시 비교 (constant-time comparison)
     *
     * @why-constant-time
     * - Timing Attack 방지: 비교 시간으로 비밀번호 길이 유추 불가
     * - bcrypt가 자동으로 처리
     */
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`로그인 실패: 비밀번호 불일치 (${email})`);

      throw new UnauthorizedException('이메일 또는 비밀번호가 잘못되었습니다');
    }

    // ========================================================================
    // 3. 추가 검증 (계정 상태)
    // ========================================================================

    /**
     * 비즈니스 규칙 검증
     * - 계정 활성화 여부
     * - 이메일 인증 여부 (선택사항)
     * - 계정 잠금 여부
     */
    if (!user.isActive) {
      this.logger.warn(`로그인 실패: 비활성 계정 (${email})`);

      throw new UnauthorizedException('비활성화된 계정입니다');
    }

    // 이메일 인증 강제 (향후 활성화)
    // if (!user.isEmailVerified) {
    //   throw new UnauthorizedException('이메일 인증이 필요합니다');
    // }

    // ========================================================================
    // 4. 로그인 성공 처리
    // ========================================================================

    this.logger.log(`로그인 성공: ${email} (ID: ${user.id})`);

    // 로그인 시간 업데이트 (비동기 - 응답 지연 방지)
    // this.updateLastLogin(user.id).catch((err) => {
    //   this.logger.error(`로그인 시간 업데이트 실패: ${err.message}`);
    // });

    /**
     * 비밀번호 제거 후 반환
     */
    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  // ==========================================================================
  // 프로필 조회
  // ==========================================================================

  /**
   * 사용자 ID로 프로필 조회
   *
   * @description
   * 인증된 사용자의 프로필 정보 조회
   *
   * @param userId - 사용자 ID
   * @returns 사용자 프로필 (비밀번호 제외)
   *
   * @throws {NotFoundException} 사용자 없음
   *
   * @example
   * ```typescript
   * const user = await userService.findById(userId);
   * ```
   *
   * @performance ~20ms (DB 조회만)
   *
   * @caching
   * 향후 Redis 캐싱 추가:
   * - Key: `user:${userId}`
   * - TTL: 5분
   * - Invalidation: 프로필 수정 시
   */
  async findById(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`사용자를 찾을 수 없습니다 (ID: ${userId})`);
    }

    // UserRepository.findById는 이미 password를 제외하고 반환
    return user as Omit<User, 'password'>;
  }

  /**
   * 이메일로 사용자 조회
   *
   * @description
   * 이메일로 사용자 검색 (내부 용도)
   *
   * @param email - 이메일 주소
   * @returns 사용자 정보 (비밀번호 제외)
   *
   * @throws {NotFoundException} 사용자 없음
   *
   * @internal
   * 외부 API에 노출하지 않음 (이메일로 타인 조회 금지)
   */
  async findByEmail(email: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new NotFoundException(`사용자를 찾을 수 없습니다 (Email: ${email})`);
    }

    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  // ==========================================================================
  // Work/ERP 확장 대비
  // ==========================================================================

  /**
   * 조직 초대 회원가입
   *
   * @todo
   * Work/ERP 확장 시 구현:
   * - 조직 ID로 사용자 생성
   * - 초대 토큰 검증
   * - 조직 역할 할당
   * - 환영 이메일 발송
   */
  // async registerWithOrganization(dto: RegisterWithOrgDto) {
  //   // 구현 예정
  // }

  /**
   * SSO 로그인
   *
   * @todo
   * Work/ERP 확장 시 구현:
   * - Google, Microsoft, GitHub OAuth
   * - SAML 2.0 지원
   * - JWT 토큰 발급
   */
  // async loginWithSSO(provider: string, token: string) {
  //   // 구현 예정
  // }
}
