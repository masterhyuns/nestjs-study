# 개발 컨벤션 가이드

## 목차

1. [코드 스타일](#1-코드-스타일)
2. [파일 및 폴더 명명](#2-파일-및-폴더-명명)
3. [TypeScript 타입 정의](#3-typescript-타입-정의)
4. [주석 작성 규칙](#4-주석-작성-규칙)
5. [Git Commit Convention](#5-git-commit-convention)
6. [데이터베이스 쿼리](#6-데이터베이스-쿼리)

## 1. 코드 스타일

### 1.1 기본 원칙

- **함수**: 화살표 함수 사용 (JavaScript, Node.js, React)
- **들여쓰기**: 2 spaces
- **세미콜론**: 필수
- **따옴표**: Single quote (`'`)
- **Trailing Comma**: 사용
- **Import 순서**: 정의된 순서 준수

```typescript
// ✅ 올바른 예
export const createUser = async (data: CreateUserDto): Promise<User> => {
  const hashedPassword = await hashPassword(data.password);

  return await userRepository.create({
    ...data,
    password: hashedPassword,
  });
};

// ❌ 잘못된 예 (일반 function)
export async function createUser(data: CreateUserDto): Promise<User> {
  // ...
}
```

### 1.2 Import 순서

```typescript
// 1. Node.js 내장 모듈
import { readFileSync } from 'fs';
import { join } from 'path';

// 2. NestJS 및 프레임워크
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 3. 외부 라이브러리
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// 4. 내부 모듈 (절대 경로)
import { PrismaService } from '@/shared/database/prisma.service';
import { User } from '@/modules/user/domain/entities/user.entity';

// 5. 타입 imports
import type { CreateUserDto } from './dtos/create-user.dto';
import type { UserRepository } from './repositories/user.repository.interface';

// 6. 상대 경로 (같은 모듈 내)
import { validateEmail } from '../utils/validators';
```

## 2. 파일 및 폴더 명명

### 2.1 파일 명명 규칙

| 파일 유형 | 규칙 | 예시 |
|----------|------|------|
| NestJS 컨트롤러 | `*.controller.ts` | `user.controller.ts` |
| NestJS 서비스 | `*.service.ts` | `user.service.ts` |
| 리포지토리 | `*.repository.ts` | `user.repository.ts` |
| 엔티티 | `*.entity.ts` | `user.entity.ts` |
| DTO | `*.dto.ts` | `create-user.dto.ts` |
| 인터페이스 | `*.interface.ts` | `user.repository.interface.ts` |
| 타입 정의 | `types.ts` | `types.ts` (각 모듈에) |
| 유틸리티 | `*.util.ts` | `date.util.ts` |
| 테스트 | `*.spec.ts` | `user.service.spec.ts` |
| E2E 테스트 | `*.e2e-spec.ts` | `user.e2e-spec.ts` |

```
✅ 올바른 예:
- user.controller.ts
- create-user.dto.ts
- user.repository.interface.ts
- types.ts

❌ 잘못된 예:
- UserController.ts
- CreateUserDTO.ts
- user-repository-interface.ts
```

### 2.2 폴더 구조

```
apps/api/src/modules/user/
├── domain/                     # 도메인 계층
│   ├── entities/
│   │   └── user.entity.ts
│   ├── value-objects/
│   ├── repositories/
│   │   └── user.repository.interface.ts
│   └── events/
├── application/                # 애플리케이션 계층
│   ├── commands/
│   ├── queries/
│   └── services/
├── infrastructure/             # 인프라 계층
│   ├── persistence/
│   │   └── user.repository.ts
│   └── external/
├── presentation/               # 프레젠테이션 계층
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── dtos/
│   └── validators/
├── types.ts                    # 모듈 타입 정의
└── user.module.ts              # NestJS 모듈
```

## 3. TypeScript 타입 정의

### 3.1 타입 정의 위치

- **공통 타입**: `packages/types/src/`
- **모듈별 타입**: `apps/api/src/modules/*/types.ts`
- **도메인 타입**: Domain Layer

```typescript
// packages/types/src/user/types.ts (공통 타입)
/**
 * 사용자 역할
 *
 * @description
 * 시스템 전체 권한 레벨
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORG_ADMIN = 'ORG_ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
}

// apps/api/src/modules/user/types.ts (모듈별 타입)
/**
 * 사용자 생성 요청 DTO
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}
```

### 3.2 Interface vs Type

- **Interface**: 객체 타입, 확장 가능
- **Type**: Union, Intersection, Utility Types

```typescript
// ✅ Interface 사용 (객체)
export interface User {
  id: string;
  email: string;
  name: string;
}

// ✅ Type 사용 (Union, Utility)
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type PartialUser = Partial<User>;
export type UserWithRole = User & { role: UserRole };
```

## 4. 주석 작성 규칙

### 4.1 JSDoc 필수 항목

**모든 public 함수/클래스에 JSDoc 주석 필수:**

```typescript
/**
 * 사용자 인증 서비스
 *
 * @description
 * JWT 기반 인증 처리
 * - Access Token (15분)
 * - Refresh Token (7일)
 *
 * @performance
 * - 토큰 검증: <5ms
 * - 로그인: <100ms
 *
 * @security
 * - ✅ 비밀번호: bcrypt (salt rounds: 12)
 * - ✅ JWT: RS256 (비대칭 키)
 *
 * @scalability
 * - Work/ERP 확장: SSO 연동 준비
 */
@Injectable()
export class AuthService {
  /**
   * 사용자 로그인
   *
   * @param email - 이메일 주소
   * @param password - 비밀번호 (평문)
   * @returns JWT 토큰 (Access + Refresh)
   *
   * @throws {UnauthorizedException} 인증 실패
   * @throws {NotFoundException} 사용자 없음
   *
   * @example
   * ```typescript
   * const tokens = await authService.login('user@example.com', 'password');
   * ```
   *
   * @performance ~80ms (bcrypt 검증 포함)
   */
  async login(email: string, password: string): Promise<AuthTokens> {
    // 구현...
  }
}
```

### 4.2 주석 템플릿

```typescript
/**
 * 함수 설명 (한 줄 요약)
 *
 * @description
 * 상세 설명
 * - 주요 기능 1
 * - 주요 기능 2
 *
 * @param param1 - 파라미터 설명
 * @param param2 - 파라미터 설명
 * @returns 반환값 설명
 *
 * @throws {ErrorType} 에러 상황
 *
 * @example
 * ```typescript
 * const result = await someFunction(param1, param2);
 * ```
 *
 * @performance 성능 특성 (예상 응답 시간)
 *
 * @security 보안 고려사항
 *
 * @scalability 확장성 고려사항
 *
 * @todo 향후 개선 사항
 */
```

## 5. Git Commit Convention

### 5.1 Commit Message 형식

```
type(scope): 제목

본문 (선택)

꼬리말 (선택)
```

### 5.2 Type

| Type | 설명 | 예시 |
|------|------|------|
| `feat` | 새 기능 | feat(user): 사용자 프로필 편집 기능 추가 |
| `fix` | 버그 수정 | fix(auth): JWT 토큰 갱신 오류 수정 |
| `refactor` | 리팩토링 | refactor(db): 리포지토리 패턴 적용 |
| `perf` | 성능 개선 | perf(query): 사용자 통계 쿼리 최적화 |
| `docs` | 문서 | docs(api): Swagger 문서 업데이트 |
| `test` | 테스트 | test(user): 사용자 서비스 단위 테스트 추가 |
| `chore` | 빌드/설정 | chore(deps): dependencies 업데이트 |
| `style` | 코드 포맷팅 | style(lint): ESLint 규칙 적용 |

### 5.3 Scope

모듈명 또는 영역:
- `user`, `auth`, `project`, `task`
- `db`, `api`, `config`
- `deps`, `docker`

### 5.4 예시

```bash
# 새 기능
feat(user): 사용자 프로필 이미지 업로드 기능 추가

# 버그 수정
fix(auth): 로그인 시 Refresh Token 갱신 안 되는 문제 수정

# 리팩토링
refactor(db): Prisma Raw SQL을 사용한 복잡한 쿼리 최적화

# 성능 개선
perf(cache): Redis 캐싱 전략 개선으로 API 응답 속도 50% 향상

# 문서
docs(guide): 데이터베이스 쿼리 작성 가이드 추가

# 테스트
test(user): 사용자 리포지토리 통합 테스트 추가

# 빌드/설정
chore(docker): PostgreSQL 16으로 업그레이드
```

### 5.5 제외 사항

- ❌ **Claude Code 정보 제외** (커밋 메시지에 AI 생성 정보 미포함)

```bash
# ❌ 잘못된 예
feat(user): 사용자 기능 추가

🤖 Generated with Claude Code

# ✅ 올바른 예
feat(user): 사용자 프로필 편집 기능 추가
```

## 6. 데이터베이스 쿼리

### 6.1 Prisma vs Raw SQL 선택 기준

| 상황 | 도구 | 이유 |
|------|------|------|
| 단순 CRUD | Prisma | 타입 안전성, 생산성 |
| 1-2개 JOIN | Prisma | 관계 자동 해결 |
| 3개 이상 JOIN | Raw SQL | 성능, 명확성 |
| 집계/분석 | Raw SQL | Window Function, CTE |
| 대량 작업 | Raw SQL | Bulk Insert/Update |
| 동적 필터 | Kysely | 타입 안전 유지 |

### 6.2 예시

```typescript
// ✅ Prisma 사용 (단순 조회)
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, name: true, email: true },
});

// ✅ Raw SQL 사용 (복잡한 집계)
const stats = await prisma.$queryRaw<UserStatistics[]>`
  SELECT
    u.id,
    COUNT(t.id) AS total_tasks,
    AVG(t.completion_time) AS avg_time
  FROM users u
  LEFT JOIN tasks t ON t.assignee_id = u.id
  GROUP BY u.id
`;
```

상세 내용은 [데이터베이스 쿼리 가이드](./database-query-guide.md) 참고

---

**마지막 업데이트**: 2025-12-05
