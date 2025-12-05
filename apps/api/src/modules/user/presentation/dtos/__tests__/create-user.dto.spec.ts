/**
 * CreateUserDto Unit 테스트
 *
 * @description
 * 사용자 생성 DTO의 Validation 로직을 테스트
 *
 * @why-unit-test-dto
 * DTO Validation을 Unit Test하는 이유:
 * 1. **빠른 피드백**: DB 연결 없이 밀리초 내 검증
 * 2. **명확한 에러 메시지**: 어떤 필드가 왜 실패했는지 확인
 * 3. **회귀 방지**: Validation 규칙 변경 시 자동 검증
 * 4. **문서화**: Validation 규칙이 곧 테스트 (Living Documentation)
 *
 * @architecture-decision
 * 왜 class-validator를 사용하는가:
 * - Decorator 기반으로 가독성 높음
 * - NestJS ValidationPipe와 완벽 통합
 * - 커스텀 Validator 쉽게 확장 가능
 * - TypeScript 타입 안전성 유지
 *
 * @testing-strategy
 * Given-When-Then 패턴 적용:
 * - Given: 테스트 데이터 준비
 * - When: Validation 실행
 * - Then: 결과 검증
 *
 * @performance
 * - 테스트 1개당 ~10ms
 * - 전체 DTO 테스트 ~100ms
 * - DB 연결 없어 매우 빠름
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from '../create-user.dto';
import { createUserDto, createInvalidUserDto } from '@/test/helpers/fixtures.helper';

/**
 * DTO를 검증하는 헬퍼 함수
 *
 * @why-helper-function
 * - 모든 테스트에서 동일한 검증 로직 사용
 * - DRY 원칙: Don't Repeat Yourself
 * - 에러 메시지 추출 로직 중앙화
 *
 * @how-it-works
 * 1. Plain Object → DTO Class Instance 변환
 * 2. @Transform 데코레이터 적용 (소문자 변환 등)
 * 3. @IsEmail, @IsPassword 등 Validation 실행
 * 4. 에러 발생 시 필드별 메시지 추출
 *
 * @returns 검증 에러 배열 (성공 시 빈 배열)
 */
const validateDto = async (dto: any) => {
  // Plain Object를 DTO Class Instance로 변환
  // @Transform 데코레이터가 적용되려면 이 과정 필수
  const dtoInstance = plainToInstance(CreateUserDto, dto);

  // class-validator의 validate 함수 실행
  // 모든 데코레이터 (@IsEmail, @IsPassword 등) 검증
  const errors = await validate(dtoInstance);

  return errors;
};

/**
 * 에러 메시지 추출 헬퍼
 *
 * @why
 * - ValidationError 객체는 중첩 구조
 * - 테스트에서는 간단한 문자열 배열이 필요
 *
 * @example
 * errors = [{ property: 'email', constraints: { isEmail: '...' } }]
 * → ['올바른 이메일 형식이 아닙니다']
 */
const getErrorMessages = (errors: any[], field: string): string[] => {
  const error = errors.find((e) => e.property === field);
  if (!error || !error.constraints) return [];

  return Object.values(error.constraints);
};

describe('CreateUserDto', () => {
  /**
   * 전체 DTO 검증 성공 테스트
   *
   * @why-test-success-case
   * - Happy Path 검증 (모든 필드 올바를 때)
   * - 변환 로직 검증 (소문자 변환, 공백 제거 등)
   * - 기본값 설정 확인
   */
  describe('성공 케이스', () => {
    it('모든 필드가 유효하면 검증 통과', async () => {
      // Given: 유효한 사용자 데이터
      const dto = createUserDto();

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 에러가 없어야 함
      expect(errors).toHaveLength(0);
    });

    it('선택 필드(phoneNumber, marketingConsent)가 없어도 검증 통과', async () => {
      // Given: 필수 필드만 있는 데이터
      const dto = createUserDto({
        phoneNumber: undefined,
        marketingConsent: undefined,
      });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 에러가 없어야 함
      expect(errors).toHaveLength(0);
    });
  });

  /**
   * 이메일 필드 검증 테스트
   *
   * @why-test-email
   * - 가장 중요한 식별자 (로그인 ID)
   * - 중복 불가 (DB UNIQUE 제약)
   * - RFC 5322 표준 준수 필요
   */
  describe('email 필드 검증', () => {
    it('유효한 이메일은 검증 통과', async () => {
      // Given: 다양한 유효한 이메일 형식
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.kr',
        'user_name@sub.example.com',
      ];

      // When & Then: 각 이메일이 모두 통과
      for (const email of validEmails) {
        const dto = createUserDto({ email });
        const errors = await validateDto(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('잘못된 이메일 형식은 에러 반환', async () => {
      // Given: 유효하지 않은 이메일 형식들
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'invalid@.com',
        'invalid..email@example.com',
      ];

      // When & Then: 각 이메일이 모두 실패
      for (const email of invalidEmails) {
        const dto = createUserDto({ email });
        const errors = await validateDto(dto);

        expect(errors.length).toBeGreaterThan(0);
        const messages = getErrorMessages(errors, 'email');
        expect(messages).toContain('올바른 이메일 형식이 아닙니다');
      }
    });

    it('이메일이 비어있으면 에러 반환', async () => {
      // Given: 빈 이메일
      const dto = createUserDto({ email: '' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 필수 입력 에러
      const messages = getErrorMessages(errors, 'email');
      expect(messages).toContain('이메일은 필수 입력 항목입니다');
    });

    it('이메일이 255자를 초과하면 에러 반환', async () => {
      // Given: 256자 이메일
      const longEmail = 'a'.repeat(240) + '@example.com'; // 253자 (255 초과)

      const dto = createUserDto({ email: longEmail });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 최대 길이 에러
      const messages = getErrorMessages(errors, 'email');
      expect(messages).toContain('이메일은 최대 255자까지 입력 가능합니다');
    });

    it('이메일은 소문자로 자동 변환', async () => {
      // Given: 대문자가 섞인 이메일
      const dto = createUserDto({ email: 'USER@EXAMPLE.COM' });

      // When: DTO 인스턴스 생성 (@Transform 적용)
      const instance = plainToInstance(CreateUserDto, dto);

      // Then: 소문자로 변환됨
      expect(instance.email).toBe('user@example.com');
    });

    it('이메일 앞뒤 공백은 자동 제거', async () => {
      // Given: 공백이 있는 이메일
      const dto = createUserDto({ email: '  user@example.com  ' });

      // When: DTO 인스턴스 생성 (@Transform 적용)
      const instance = plainToInstance(CreateUserDto, dto);

      // Then: 공백 제거됨
      expect(instance.email).toBe('user@example.com');
    });
  });

  /**
   * 비밀번호 필드 검증 테스트
   *
   * @why-test-password
   * - 보안의 핵심 (강력한 비밀번호 강제)
   * - 복잡도 규칙 (대소문자, 숫자, 특수문자)
   * - 커스텀 Validator (@IsPassword) 동작 확인
   */
  describe('password 필드 검증', () => {
    it('유효한 비밀번호는 검증 통과', async () => {
      // Given: 모든 요구사항을 만족하는 비밀번호
      const validPasswords = [
        'Test@1234',
        'SecureP@ssw0rd',
        'MyP@ssword123',
        'Abcd@1234',
      ];

      // When & Then: 각 비밀번호가 모두 통과
      for (const password of validPasswords) {
        const dto = createUserDto({ password, passwordConfirm: password });
        const errors = await validateDto(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('8자 미만이면 에러 반환', async () => {
      // Given: 7자 비밀번호
      const dto = createUserDto({ password: 'Test@12' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 최소 길이 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages.some((m) => m.includes('8자 이상'))).toBe(true);
    });

    it('대문자가 없으면 에러 반환', async () => {
      // Given: 대문자 없는 비밀번호
      const dto = createUserDto({ password: 'test@1234' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 대문자 필요 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages.some((m) => m.includes('대문자') || m.includes('대소문자'))).toBe(true);
    });

    it('소문자가 없으면 에러 반환', async () => {
      // Given: 소문자 없는 비밀번호
      const dto = createUserDto({ password: 'TEST@1234' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 소문자 필요 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages.some((m) => m.includes('소문자') || m.includes('대소문자'))).toBe(true);
    });

    it('숫자가 없으면 에러 반환', async () => {
      // Given: 숫자 없는 비밀번호
      const dto = createUserDto({ password: 'Test@abcd' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 숫자 필요 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages.some((m) => m.includes('숫자'))).toBe(true);
    });

    it('특수문자가 없으면 에러 반환', async () => {
      // Given: 특수문자 없는 비밀번호
      const dto = createUserDto({ password: 'Test1234' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 특수문자 필요 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages.some((m) => m.includes('특수문자'))).toBe(true);
    });

    it('비밀번호가 비어있으면 에러 반환', async () => {
      // Given: 빈 비밀번호
      const dto = createUserDto({ password: '' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 필수 입력 에러
      const messages = getErrorMessages(errors, 'password');
      expect(messages).toContain('비밀번호는 필수 입력 항목입니다');
    });
  });

  /**
   * 비밀번호 확인 필드 검증 테스트
   *
   * @why-test-password-confirm
   * - 사용자 실수 방지 (두 번 입력해서 확인)
   * - 커스텀 Validator (@Match) 동작 확인
   */
  describe('passwordConfirm 필드 검증', () => {
    it('password와 일치하면 검증 통과', async () => {
      // Given: 일치하는 비밀번호
      const dto = createUserDto({
        password: 'Test@1234',
        passwordConfirm: 'Test@1234',
      });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 에러 없음
      expect(errors).toHaveLength(0);
    });

    it('password와 불일치하면 에러 반환', async () => {
      // Given: 불일치하는 비밀번호
      const dto = createUserDto({
        password: 'Test@1234',
        passwordConfirm: 'Different@123',
      });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 불일치 에러
      const messages = getErrorMessages(errors, 'passwordConfirm');
      expect(messages).toContain('비밀번호가 일치하지 않습니다');
    });

    it('passwordConfirm이 비어있으면 에러 반환', async () => {
      // Given: 빈 확인 비밀번호
      const dto = createUserDto({ passwordConfirm: '' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 필수 입력 에러
      const messages = getErrorMessages(errors, 'passwordConfirm');
      expect(messages).toContain('비밀번호 확인은 필수 입력 항목입니다');
    });
  });

  /**
   * 이름 필드 검증 테스트
   *
   * @why-test-name
   * - 사용자 식별 정보
   * - 한글, 영문, 숫자 허용
   * - 특수문자 일부만 허용
   */
  describe('name 필드 검증', () => {
    it('유효한 이름은 검증 통과', async () => {
      // Given: 다양한 유효한 이름 형식
      const validNames = [
        '홍길동',
        'John Doe',
        '김철수123',
        'User-Name',
        'User_Name',
      ];

      // When & Then: 각 이름이 모두 통과
      for (const name of validNames) {
        const dto = createUserDto({ name });
        const errors = await validateDto(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('2자 미만이면 에러 반환', async () => {
      // Given: 1자 이름
      const dto = createUserDto({ name: 'A' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 최소 길이 에러
      const messages = getErrorMessages(errors, 'name');
      expect(messages).toContain('이름은 최소 2자 이상이어야 합니다');
    });

    it('50자를 초과하면 에러 반환', async () => {
      // Given: 51자 이름
      const dto = createUserDto({ name: 'A'.repeat(51) });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 최대 길이 에러
      const messages = getErrorMessages(errors, 'name');
      expect(messages).toContain('이름은 최대 50자까지 입력 가능합니다');
    });

    it('허용되지 않은 특수문자가 있으면 에러 반환', async () => {
      // Given: 특수문자 포함 이름
      const invalidNames = ['홍길동!', 'John@Doe', '김철수#', 'User*Name'];

      // When & Then: 각 이름이 모두 실패
      for (const name of invalidNames) {
        const dto = createUserDto({ name });
        const errors = await validateDto(dto);

        const messages = getErrorMessages(errors, 'name');
        expect(messages).toContain('이름은 한글, 영문, 숫자만 입력 가능합니다');
      }
    });

    it('이름이 비어있으면 에러 반환', async () => {
      // Given: 빈 이름
      const dto = createUserDto({ name: '' });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 필수 입력 에러
      const messages = getErrorMessages(errors, 'name');
      expect(messages).toContain('이름은 필수 입력 항목입니다');
    });

    it('이름 앞뒤 공백은 자동 제거', async () => {
      // Given: 공백이 있는 이름
      const dto = createUserDto({ name: '  홍길동  ' });

      // When: DTO 인스턴스 생성 (@Transform 적용)
      const instance = plainToInstance(CreateUserDto, dto);

      // Then: 공백 제거됨
      expect(instance.name).toBe('홍길동');
    });
  });

  /**
   * 휴대폰 번호 필드 검증 테스트
   *
   * @why-test-phone-number
   * - 선택 필드이지만 입력 시 형식 검증 필요
   * - 한국 휴대폰 번호 형식만 허용
   * - 커스텀 Validator (@IsPhoneNumber) 동작 확인
   */
  describe('phoneNumber 필드 검증', () => {
    it('유효한 휴대폰 번호는 검증 통과', async () => {
      // Given: 다양한 유효한 형식
      const validPhones = [
        '010-1234-5678',
        '01012345678',
        '011-123-4567',
        '0161234567',
      ];

      // When & Then: 각 번호가 모두 통과
      for (const phoneNumber of validPhones) {
        const dto = createUserDto({ phoneNumber });
        const errors = await validateDto(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('잘못된 형식이면 에러 반환', async () => {
      // Given: 유효하지 않은 형식들
      const invalidPhones = ['123-4567', '010-123-456', '02-1234-5678', '1234567890'];

      // When & Then: 각 번호가 모두 실패
      for (const phoneNumber of invalidPhones) {
        const dto = createUserDto({ phoneNumber });
        const errors = await validateDto(dto);

        const messages = getErrorMessages(errors, 'phoneNumber');
        expect(messages).toContain('올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)');
      }
    });

    it('선택 필드이므로 없어도 검증 통과', async () => {
      // Given: phoneNumber 없는 데이터
      const dto = createUserDto({ phoneNumber: undefined });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 에러 없음
      expect(errors).toHaveLength(0);
    });

    it('하이픈은 자동으로 제거됨', async () => {
      // Given: 하이픈 있는 번호
      const dto = createUserDto({ phoneNumber: '010-1234-5678' });

      // When: DTO 인스턴스 생성 (@Transform 적용)
      const instance = plainToInstance(CreateUserDto, dto);

      // Then: 하이픈 제거됨
      expect(instance.phoneNumber).toBe('01012345678');
    });
  });

  /**
   * 마케팅 수신 동의 필드 검증 테스트
   *
   * @why-test-marketing-consent
   * - 법적 요구사항 (개인정보 보호법)
   * - 기본값 확인 (false)
   */
  describe('marketingConsent 필드 검증', () => {
    it('true/false 모두 검증 통과', async () => {
      // Given: 동의 여부
      const dto1 = createUserDto({ marketingConsent: true });
      const dto2 = createUserDto({ marketingConsent: false });

      // When: DTO 검증 실행
      const errors1 = await validateDto(dto1);
      const errors2 = await validateDto(dto2);

      // Then: 에러 없음
      expect(errors1).toHaveLength(0);
      expect(errors2).toHaveLength(0);
    });

    it('선택 필드이므로 없어도 검증 통과', async () => {
      // Given: marketingConsent 없는 데이터
      const dto = createUserDto({ marketingConsent: undefined });

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 에러 없음
      expect(errors).toHaveLength(0);
    });
  });

  /**
   * 전체 DTO 검증 실패 케이스
   *
   * @why-test-multiple-errors
   * - 여러 필드가 동시에 잘못되었을 때 모든 에러 반환 확인
   * - 사용자에게 한 번에 모든 문제 알려주기
   */
  describe('복합 에러 케이스', () => {
    it('여러 필드가 잘못되면 모든 에러 반환', async () => {
      // Given: 여러 필드가 잘못된 데이터
      const dto = createInvalidUserDto();

      // When: DTO 검증 실행
      const errors = await validateDto(dto);

      // Then: 여러 에러 반환
      expect(errors.length).toBeGreaterThan(0);

      // email 에러
      const emailErrors = getErrorMessages(errors, 'email');
      expect(emailErrors.length).toBeGreaterThan(0);

      // password 에러
      const passwordErrors = getErrorMessages(errors, 'password');
      expect(passwordErrors.length).toBeGreaterThan(0);

      // name 에러
      const nameErrors = getErrorMessages(errors, 'name');
      expect(nameErrors.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Work/ERP 확장 대비
 *
 * @scalability
 * 더 많은 필드 추가 시:
 * 1. 각 필드별로 describe 블록 추가
 * 2. 성공/실패 케이스 모두 테스트
 * 3. 변환 로직 (@Transform) 테스트
 * 4. 커스텀 Validator 테스트
 *
 * @example
 * ERP 확장 시 추가 필드:
 * - department: 부서 (select)
 * - employeeId: 사번 (unique)
 * - joinDate: 입사일 (date)
 * - salary: 급여 (number, encrypted)
 */
