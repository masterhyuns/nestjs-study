/**
 * 로그인 DTO
 *
 * @description
 * 사용자 로그인 시 필요한 데이터 전송 객체
 *
 * @why-separate-dto
 * CreateUserDto와 분리하는 이유:
 * - 관심사 분리: 회원가입과 로그인은 다른 목적
 * - 필드 최소화: 로그인은 email + password만 필요
 * - 보안: 불필요한 필드 노출 방지
 * - 명확성: API 문서에서 구분
 *
 * @validation
 * class-validator를 사용한 자동 검증:
 * - @IsEmail(): RFC 5322 이메일 형식
 * - @IsNotEmpty(): 필수 입력
 * - @IsString(): 문자열 타입
 *
 * @security
 * - 비밀번호 평문 전송: HTTPS 필수
 * - Rate Limiting: Brute Force 공격 방어
 * - Timing Attack: bcrypt.compare가 방어
 */

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  /**
   * 이메일 주소
   *
   * @description
   * 로그인에 사용할 이메일 주소
   *
   * @constraints
   * - 필수 입력
   * - 이메일 형식 (RFC 5322)
   *
   * @transform
   * - 소문자 변환: CreateUserDto와 동일한 정규화
   * - 공백 제거: 입력 실수 방지
   *
   * @why-transform
   * 로그인 시에도 정규화하는 이유:
   * - 일관성: DB에 저장된 이메일은 소문자
   * - 사용자 편의: "USER@EXAMPLE.COM" 입력해도 로그인 성공
   * - 보안: 대소문자 차이로 계정 추측 방지
   *
   * @example "user@example.com"
   */
  @ApiProperty({
    description: '이메일 주소',
    example: 'user@example.com',
    type: String,
    required: true,
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  @IsNotEmpty({ message: '이메일은 필수 입력 항목입니다' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  /**
   * 비밀번호
   *
   * @description
   * 로그인에 사용할 비밀번호 (평문)
   *
   * @constraints
   * - 필수 입력
   * - 문자열 타입
   *
   * @why-no-validation
   * 비밀번호 복잡도 검증을 하지 않는 이유:
   * - 로그인 시점: 이미 생성된 계정의 비밀번호
   * - 검증 불필요: DB에 저장된 해시와 비교만 하면 됨
   * - 사용자 경험: 복잡도 규칙 변경 시에도 로그인 가능해야 함
   *
   * @security
   * - ⚠️ HTTPS 필수: 평문 비밀번호 전송 시 암호화 필수
   * - ✅ 전송 후 즉시 해시 비교: 메모리에 평문 저장 안 함
   * - ✅ 로그 제외: 비밀번호는 절대 로깅하지 않음
   *
   * @example "Secure@123"
   */
  @ApiProperty({
    description: '비밀번호',
    example: 'Secure@123',
    type: String,
    required: true,
    minLength: 1, // 최소한 공백이 아닌지만 확인
  })
  @IsString({ message: '비밀번호는 문자열이어야 합니다' })
  @IsNotEmpty({ message: '비밀번호는 필수 입력 항목입니다' })
  password: string;

  /**
   * @future 추가 필드
   *
   * Work/ERP 확장 시 고려사항:
   *
   * 1. 다중 인증 (MFA):
   * ```typescript
   * @ApiPropertyOptional()
   * @IsOptional()
   * @IsString()
   * mfaCode?: string; // 6자리 OTP
   * ```
   *
   * 2. 기기 정보 (보안 로그):
   * ```typescript
   * @ApiPropertyOptional()
   * @IsOptional()
   * @IsString()
   * deviceId?: string; // 기기 식별자
   *
   * @ApiPropertyOptional()
   * @IsOptional()
   * @IsString()
   * userAgent?: string; // 브라우저 정보
   * ```
   *
   * 3. Remember Me:
   * ```typescript
   * @ApiPropertyOptional()
   * @IsOptional()
   * @IsBoolean()
   * rememberMe?: boolean; // Refresh Token 유효기간 연장 (7일 → 30일)
   * ```
   */
}
