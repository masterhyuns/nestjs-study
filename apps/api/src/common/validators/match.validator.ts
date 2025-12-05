/**
 * 필드 일치 검증 데코레이터
 *
 * @description
 * 두 필드의 값이 일치하는지 검증
 * 주로 비밀번호 확인에 사용
 *
 * @usage
 * ```typescript
 * class CreateUserDto {
 *   @IsPassword()
 *   password: string;
 *
 *   @Match('password')
 *   passwordConfirm: string;
 * }
 * ```
 */

import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * 필드 일치 검증 데코레이터
 *
 * @param property - 비교할 필드명
 * @param validationOptions - 검증 옵션
 */
export const Match = (property: string, validationOptions?: ValidationOptions) => {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return value === relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${propertyName}이(가) ${relatedPropertyName}와(과) 일치하지 않습니다`;
        },
      },
    });
  };
};
