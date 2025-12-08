/**
 * Kysely 데이터베이스 타입 정의
 *
 * @why-kysely-types
 * Kysely는 TypeScript의 타입 시스템을 활용한 Type-safe SQL query builder입니다.
 * - Prisma처럼 외부 바이너리 다운로드 불필요
 * - 완전한 타입 안정성 (compile-time type checking)
 * - Raw SQL보다 안전하고, ORM보다 유연함
 *
 * @structure
 * - Database: 전체 데이터베이스 스키마
 * - Table interfaces: 각 테이블의 컬럼 타입 정의
 * - Enum types: 데이터베이스 Enum 타입
 */

import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

/**
 * @enum UserRole
 * 사용자 시스템 권한 레벨
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

/**
 * @enum MemberRole
 * 워크스페이스 내 멤버 역할
 */
export enum MemberRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST',
}

/**
 * @enum ProjectStatus
 * 프로젝트 상태
 */
export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  COMPLETED = 'COMPLETED',
}

/**
 * @enum TaskStatus
 * 태스크 진행 상태
 */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  BLOCKED = 'BLOCKED',
}

/**
 * @enum TaskPriority
 * 태스크 우선순위
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * @interface UserTable
 * 사용자 테이블 스키마
 *
 * @why-generated
 * Generated<T>는 Kysely가 자동으로 값을 생성하는 컬럼을 나타냅니다.
 * - id: cuid() 자동 생성
 * - createdAt: now() 자동 생성
 * - updatedAt: 자동 업데이트
 */
export interface UserTable {
  id: Generated<string>;
  email: string;
  password: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: Generated<boolean>; // default true
  emailVerified: Generated<boolean>; // default false
  createdAt: Generated<Date>;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * @interface WorkspaceTable
 * 워크스페이스 (멀티 테넌시) 테이블
 */
export interface WorkspaceTable {
  id: Generated<string>;
  name: string;
  slug: string; // unique
  description: string | null;
  logoUrl: string | null;
  isActive: Generated<boolean>; // default true
  createdAt: Generated<Date>;
  updatedAt: Date;
}

/**
 * @interface WorkspaceMemberTable
 * 워크스페이스 멤버십 (User ↔ Workspace 다대다 관계)
 */
export interface WorkspaceMemberTable {
  id: Generated<string>;
  workspaceId: string; // FK to workspaces.id
  userId: string; // FK to users.id
  role: MemberRole;
  isAccepted: Generated<boolean>; // default false
  joinedAt: Generated<Date>;
}

/**
 * @interface ProjectTable
 * 프로젝트 테이블
 */
export interface ProjectTable {
  id: Generated<string>;
  workspaceId: string; // FK to workspaces.id
  name: string;
  key: string; // 프로젝트 키 (예: PROJ)
  description: string | null;
  status: Generated<ProjectStatus>; // default ACTIVE
  startDate: Date | null;
  endDate: Date | null;
  createdById: string; // FK to users.id
  createdAt: Generated<Date>;
  updatedAt: Date;
}

/**
 * @interface TaskTable
 * 태스크 테이블
 */
export interface TaskTable {
  id: Generated<string>;
  projectId: string; // FK to projects.id
  title: string;
  description: string | null;
  status: Generated<TaskStatus>; // default TODO
  priority: Generated<TaskPriority>; // default MEDIUM
  assigneeId: string | null; // FK to users.id
  estimatedHours: number | null;
  actualHours: number | null;
  dueDate: Date | null;
  createdAt: Generated<Date>;
  updatedAt: Date;
  completedAt: Date | null;
}

/**
 * @interface CommentTable
 * 댓글 테이블
 */
export interface CommentTable {
  id: Generated<string>;
  taskId: string; // FK to tasks.id
  userId: string; // FK to users.id
  content: string;
  createdAt: Generated<Date>;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * @interface Database
 * 전체 데이터베이스 스키마
 *
 * @why-table-naming
 * Kysely는 camelCase 키를 snake_case 테이블명으로 매핑합니다.
 * - users → users 테이블
 * - workspaceMembers → workspace_members 테이블 (설정 필요)
 */
export interface Database {
  users: UserTable;
  workspaces: WorkspaceTable;
  workspace_members: WorkspaceMemberTable;
  projects: ProjectTable;
  tasks: TaskTable;
  comments: CommentTable;
}

/**
 * @helper-types
 * Kysely 헬퍼 타입들
 *
 * @why-helper-types
 * - Selectable: SELECT 쿼리 결과 타입 (읽기 전용)
 * - Insertable: INSERT 쿼리 입력 타입 (Generated 필드 제외)
 * - Updateable: UPDATE 쿼리 입력 타입 (모든 필드 optional)
 */

// User 헬퍼 타입
export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

// Workspace 헬퍼 타입
export type Workspace = Selectable<WorkspaceTable>;
export type NewWorkspace = Insertable<WorkspaceTable>;
export type WorkspaceUpdate = Updateable<WorkspaceTable>;

// WorkspaceMember 헬퍼 타입
export type WorkspaceMember = Selectable<WorkspaceMemberTable>;
export type NewWorkspaceMember = Insertable<WorkspaceMemberTable>;
export type WorkspaceMemberUpdate = Updateable<WorkspaceMemberTable>;

// Project 헬퍼 타입
export type Project = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

// Task 헬퍼 타입
export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

// Comment 헬퍼 타입
export type Comment = Selectable<CommentTable>;
export type NewComment = Insertable<CommentTable>;
export type CommentUpdate = Updateable<CommentTable>;
