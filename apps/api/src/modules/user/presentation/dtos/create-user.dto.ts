/**
 * 사용자 생성 DTO (회원가입)
 *
 * @description
 * 회원가입 시 필요한 정보를 검증하는 Data Transfer Object
 *
 * @validation
 * - 모든 필드는 class-validator로 자동 검증
 * - main.ts의 ValidationPipe가 자동으로 실행
 * - 검증 실패 시 400 Bad Request 자동 반환
 *
 * @swagger
 * - API 문서에 자동으로 포함됨
 * - 예제 값, 설명, 제약사항 모두 표시
 *
 * @example
 * ```json
 * POST /api/v1/users/register
 * {
 *   "email": "user@example.com",
 *   "password": "Secure@123",
 *   "passwordConfirm": "Secure@123",
 *   "name": "홍길동",
 *   "phoneNumber": "010-1234-5678"
 * }
 * ```
 *
 * @errorExample
 * ```json
 * // 검증 실패 시:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "COMMON_VALIDATION_ERROR",
 *     "message": [
 *       "이메일 형식이 올바르지 않습니다",
 *       "비밀번호는 최소 8자 이상이어야 합니다"
 *     ]
 *   }
 * }
 * ```
 */

import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Match } from '@/common/validators/match.validator';
import { IsPassword } from '@/common/validators/password.validator';
import { IsPhoneNumber } from '@/common/validators/phone.validator';

export class CreateUserDto {
  /**
   * 이메일 주소
   *
   * @description
   * - RFC 5322 표준 이메일 형식 검증
   * - 자동으로 소문자 변환 및 공백 제거
   * - 중복 검증은 서비스 레이어에서 수행
   *
   * @constraints
   * - 필수 입력
   * - 이메일 형식 (user@domain.com)
   * - 최대 255자
   *
   * @transform
   * - 소문자 변환: "USER@EXAMPLE.COM" → "user@example.com"
   * - 공백 제거: " user@example.com " → "user@example.com"
   *
   * @example "user@example.com"
   */
  @ApiProperty({
    description: '이메일 주소 (소문자 자동 변환, 중복 불가)',
    example: 'user@example.com',
    format: 'email',
    maxLength: 255,
  })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  @IsNotEmpty({ message: '이메일은 필수 입력 항목입니다' })
  @MaxLength(255, { message: '이메일은 최대 255자까지 입력 가능합니다' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  /**
   * 비밀번호
   *
   * @description
   * - 보안 강화를 위한 복잡도 검증
   * - bcrypt로 해싱 후 저장 (서비스 레이어)
   * - 평문으로 DB에 저장되지 않음
   *
   * @constraints
   * - 필수 입력
   * - 8~100자
   * - 최소 1개의 대문자 포함
   * - 최소 1개의 소문자 포함
   * - 최소 1개의 숫자 포함
   * - 최소 1개의 특수문자 포함 (@$!%*?&)
   *
   * @security
   * - ✅ 응답에서 자동 제거 (UserEntity @Exclude)
   * - ✅ 로그에서 자동 마스킹 (LoggingInterceptor)
   * - ✅ bcrypt salt rounds 12
   *
   * @example "Secure@123"
   */
  @ApiProperty({
    description:
      '비밀번호 (8자 이상, 대소문자+숫자+특수문자 포함)',
    example: 'Secure@123',
    format: 'password',
    minLength: 8,
    maxLength: 100,
  })
  @IsPassword({
    message:
      '비밀번호는 8자 이상, 대소문자, 숫자, 특수문자를 포함해야 합니다',
  })
  @IsNotEmpty({ message: '비밀번호는 필수 입력 항목입니다' })
  password: string;

  /**
   * 비밀번호 확인
   *
   * @description
   * - password 필드와 일치해야 함
   * - 커스텀 @Match() 데코레이터 사용
   * - DB에 저장되지 않음 (검증용)
   *
   * @constraints
   * - 필수 입력
   * - password 필드와 정확히 일치
   *
   * @example "Secure@123"
   */
  @ApiProperty({
    description: '비밀번호 확인 (password와 일치해야 함)',
    example: 'Secure@123',
    format: 'password',
  })
  @Match('password', { message: '비밀번호가 일치하지 않습니다' })
  @IsNotEmpty({ message: '비밀번호 확인은 필수 입력 항목입니다' })
  passwordConfirm: string;

  /**
   * 사용자 이름
   *
   * @description
   * - 한글, 영문, 숫자 허용
   * - 공백 자동 제거
   * - 특수문자 제한 (일부만 허용)
   *
   * @constraints
   * - 필수 입력
   * - 2~50자
   * - 한글, 영문, 숫자만 허용 (일부 특수문자 허용: -, _)
   *
   * @transform
   * - 앞뒤 공백 제거: " 홍길동 " → "홍길동"
   *
   * @example "홍길동"
   */
  @ApiProperty({
    description: '사용자 이름 (한글, 영문, 숫자 허용)',
    example: '홍길동',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: '이름은 문자열이어야 합니다' })
  @IsNotEmpty({ message: '이름은 필수 입력 항목입니다' })
  @MinLength(2, { message: '이름은 최소 2자 이상이어야 합니다' })
  @MaxLength(50, { message: '이름은 최대 50자까지 입력 가능합니다' })
  @Matches(/^[가-힣a-zA-Z0-9\s\-_]+$/, {
    message: '이름은 한글, 영문, 숫자만 입력 가능합니다',
  })
  @Transform(({ value }) => value?.trim())
  name: string;

  /**
   * 휴대폰 번호 (선택)
   *
   * @description
   * - 한국 휴대폰 번호 형식 검증
   * - 하이픈 자동 제거 후 저장
   * - 2FA 인증에 사용 (향후)
   *
   * @constraints
   * - 선택 입력
   * - 010/011/016/017/018/019로 시작
   * - 하이픈 포함/미포함 모두 허용
   * - 총 11자리 (하이픈 제외)
   *
   * @transform
   * - 하이픈 제거: "010-1234-5678" → "01012345678"
   *
   * @example "010-1234-5678" 또는 "01012345678"
   */
  @ApiProperty({
    description: '휴대폰 번호 (010-1234-5678 형식, 선택)',
    example: '010-1234-5678',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber({ message: '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)' })
  @Transform(({ value }) => value?.replace(/-/g, ''))
  phoneNumber?: string;

  /**
   * 마케팅 수신 동의 (선택)
   *
   * @description
   * - 이메일/SMS 마케팅 수신 동의 여부
   * - 기본값: false
   *
   * @default false
   */
  @ApiProperty({
    description: '마케팅 수신 동의 여부',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  marketingConsent?: boolean;
}
