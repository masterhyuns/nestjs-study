/**
 * 비밀번호 복잡도 검증 데코레이터
 *
 * @description
 * 보안 강화를 위한 비밀번호 복잡도 검증
 *
 * @requirements
 * - 8자 이상
 * - 대문자 1개 이상
 * - 소문자 1개 이상
 * - 숫자 1개 이상
 * - 특수문자 1개 이상 (@$!%*?&)
 *
 * @usage
 * ```typescript
 * class CreateUserDto {
 *   @IsPassword()
 *   password: string;
 * }
 * ```
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * 비밀번호 검증 옵션
 */
export interface PasswordValidationOptions extends ValidationOptions {
  /** 최소 길이 (기본: 8) */
  minLength?: number;

  /** 최대 길이 (기본: 100) */
  maxLength?: number;

  /** 대문자 필수 여부 (기본: true) */
  requireUppercase?: boolean;

  /** 소문자 필수 여부 (기본: true) */
  requireLowercase?: boolean;

  /** 숫자 필수 여부 (기본: true) */
  requireNumbers?: boolean;

  /** 특수문자 필수 여부 (기본: true) */
  requireSpecialChars?: boolean;
}

/**
 * 비밀번호 복잡도 검증 데코레이터
 */
export const IsPassword = (validationOptions?: PasswordValidationOptions) => {
  const options = {
    minLength: validationOptions?.minLength ?? 8,
    maxLength: validationOptions?.maxLength ?? 100,
    requireUppercase: validationOptions?.requireUppercase ?? true,
    requireLowercase: validationOptions?.requireLowercase ?? true,
    requireNumbers: validationOptions?.requireNumbers ?? true,
    requireSpecialChars: validationOptions?.requireSpecialChars ?? true,
  };

  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // 길이 검증
          if (value.length < options.minLength || value.length > options.maxLength) {
            return false;
          }

          // 대문자 검증
          if (options.requireUppercase && !/[A-Z]/.test(value)) {
            return false;
          }

          // 소문자 검증
          if (options.requireLowercase && !/[a-z]/.test(value)) {
            return false;
          }

          // 숫자 검증
          if (options.requireNumbers && !/\d/.test(value)) {
            return false;
          }

          // 특수문자 검증
          if (options.requireSpecialChars && !/[@$!%*?&]/.test(value)) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const requirements: string[] = [];

          if (options.minLength > 0) {
            requirements.push(`${options.minLength}자 이상`);
          }
          if (options.requireUppercase) {
            requirements.push('대문자');
          }
          if (options.requireLowercase) {
            requirements.push('소문자');
          }
          if (options.requireNumbers) {
            requirements.push('숫자');
          }
          if (options.requireSpecialChars) {
            requirements.push('특수문자(@$!%*?&)');
          }

          return `비밀번호는 ${requirements.join(', ')}를 포함해야 합니다`;
        },
      },
    });
  };
};
