/**
 * User Serializer
 *
 * @description
 * 사용자 응답 시 민감 정보 자동 제거
 * class-transformer의 @Exclude() 사용
 *
 * @usage
 * ```typescript
 * @SerializeOptions({ strategy: 'excludeAll' })
 * class UserEntity {
 *   @Expose() id: string;
 *   @Expose() email: string;
 *   @Exclude() password: string;  // 자동 제거
 * }
 * ```
 *
 * @security
 * - 비밀번호 제거
 * - 민감 정보 숨김
 */

import { Exclude, Expose } from 'class-transformer';

/**
 * 사용자 응답 엔티티
 *
 * @description
 * API 응답 시 사용할 사용자 정보
 * password, deletedAt 등 민감 정보 제거
 */
export class UserEntity {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  @Expose()
  avatarUrl?: string;

  @Expose()
  role: string;

  @Expose()
  isActive: boolean;

  @Expose()
  emailVerified: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // 민감 정보 제외
  @Exclude()
  password: string;

  @Exclude()
  deletedAt?: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
