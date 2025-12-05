/**
 * 사용자 도메인 타입 정의
 *
 * @description
 * 협업 플랫폼 사용자 관련 공통 타입
 * 백엔드/프론트엔드 공유
 */

/**
 * 사용자 역할
 *
 * @description
 * 시스템 전체 권한 레벨
 *
 * @scalability
 * Work/ERP 확장 시 역할 추가 가능
 */
export enum UserRole {
  /** 시스템 관리자 (플랫폼 전체 관리) */
  SUPER_ADMIN = 'SUPER_ADMIN',

  /** 조직 관리자 (조직 설정, 멤버 관리) */
  ORG_ADMIN = 'ORG_ADMIN',

  /** 프로젝트 관리자 (프로젝트 생성, 멤버 할당) */
  MANAGER = 'MANAGER',

  /** 일반 멤버 (할당된 작업 수행) */
  MEMBER = 'MEMBER',
}

/**
 * 사용자 상태
 */
export enum UserStatus {
  /** 활성 (정상 사용) */
  ACTIVE = 'ACTIVE',

  /** 비활성 (휴면) */
  INACTIVE = 'INACTIVE',

  /** 대기 (이메일 미인증) */
  PENDING = 'PENDING',

  /** 정지 (관리자 조치) */
  SUSPENDED = 'SUSPENDED',
}

/**
 * 사용자 엔티티
 */
export interface User {
  /** 사용자 ID */
  id: string;

  /** 이메일 */
  email: string;

  /** 이름 */
  name: string;

  /** 프로필 이미지 URL */
  avatarUrl?: string;

  /** 역할 */
  role: UserRole;

  /** 활성 상태 */
  isActive: boolean;

  /** 이메일 인증 여부 */
  emailVerified: boolean;

  /** 생성일 */
  createdAt: Date;

  /** 수정일 */
  updatedAt: Date;
}

/**
 * 사용자 생성 DTO
 */
export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
}

/**
 * 사용자 업데이트 DTO
 */
export interface UpdateUserDto {
  name?: string;
  avatarUrl?: string;
}
