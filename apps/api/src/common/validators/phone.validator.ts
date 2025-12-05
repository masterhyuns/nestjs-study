/**
 * 휴대폰 번호 검증 데코레이터
 *
 * @description
 * 한국 휴대폰 번호 형식 검증
 *
 * @format
 * - 010-1234-5678 (하이픈 포함)
 * - 01012345678 (하이픈 미포함)
 *
 * @usage
 * ```typescript
 * class CreateUserDto {
 *   @IsPhoneNumber()
 *   phoneNumber: string;
 * }
 * ```
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * 한국 휴대폰 번호 검증 데코레이터
 */
export const IsPhoneNumber = (validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // 한국 휴대폰 번호 정규식
          // 010/011/016/017/018/019로 시작
          // 하이픈 포함/미포함 모두 허용
          const phoneRegex = /^(01[0|1|6|7|8|9])-?(\d{3,4})-?(\d{4})$/;

          return phoneRegex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return '올바른 휴대폰 번호 형식이 아닙니다 (예: 010-1234-5678)';
        },
      },
    });
  };
};
