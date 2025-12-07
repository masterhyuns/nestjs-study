# 로컬 개발 환경 세팅 가이드

## 개요

이 문서는 **신규 개발자가 프로젝트를 클론하고 로컬에서 개발 환경을 구축**하는 전체 과정을 안내합니다.

**예상 소요 시간**: 10~15분

**필수 조건**:
- Node.js 18+ 설치
- pnpm 설치

**선택 사항** (Docker를 사용할 수 없으므로 불필요):
- ❌ Docker (사용 안 함)
- ❌ PostgreSQL (SQLite 사용)

---

## 1. 필수 소프트웨어 설치

### 1️⃣ Node.js 설치 (v18 이상)

```bash
# Node.js 버전 확인
node -v
# v18.0.0 이상이어야 함

# 설치되어 있지 않다면
# https://nodejs.org/ 에서 다운로드
# 또는 nvm 사용 (권장)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 2️⃣ pnpm 설치

```bash
# pnpm 설치
npm install -g pnpm

# 버전 확인
pnpm -v
# 8.0.0 이상 권장
```

---

## 2. 프로젝트 클론

```bash
# 저장소 클론
git clone <repository-url>
cd fullstack-nextjs

# 또는 SSH
git clone git@github.com:username/fullstack-nextjs.git
cd fullstack-nextjs
```

---

## 3. 의존성 설치

```bash
# 루트에서 모든 패키지 설치 (Turborepo가 자동으로 처리)
pnpm install
```

**설치되는 패키지**:
- API 서버 의존성 (NestJS, Prisma 등)
- 프론트엔드 의존성 (React, Next.js 등)
- 공통 패키지 (types, theme 등)

**예상 소요 시간**: 2~3분

---

## 4. 환경 변수 설정

### 4️⃣ .env 파일 생성

```bash
# API 서버 환경 변수 파일 복사
cd apps/api
cp .env.example .env
# .env.example이 없다면 아래 내용을 .env에 직접 작성
```

### .env 파일 내용

```bash
# apps/api/.env

# =============================================================================
# 데이터베이스 (SQLite - Docker 불필요)
# =============================================================================
DATABASE_URL="file:./prisma/dev.db"

# =============================================================================
# JWT (보안)
# =============================================================================
JWT_SECRET="dev-secret-change-in-production"
JWT_ACCESS_TOKEN_EXPIRATION="15m"
JWT_REFRESH_TOKEN_EXPIRATION="7d"

# =============================================================================
# 애플리케이션
# =============================================================================
NODE_ENV="development"
PORT=3000
API_PREFIX="api/v1"
CORS_ORIGIN="http://localhost:3001"

# =============================================================================
# 로깅
# =============================================================================
LOG_LEVEL="debug"

# =============================================================================
# Rate Limiting
# =============================================================================
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

**중요:**
- `DATABASE_URL`은 SQLite를 사용하므로 **Docker 없이도 작동**합니다.
- `JWT_SECRET`은 프로덕션에서 반드시 변경해야 합니다.
- `PORT=3000`은 기본값이며, 다른 포트를 사용하려면 변경 가능합니다.

---

## 5. 데이터베이스 초기화 (Prisma)

### 5️⃣ 마이그레이션 실행

```bash
# apps/api 디렉토리로 이동 (아직 안 했다면)
cd apps/api

# Prisma 마이그레이션 실행
npx prisma migrate dev
```

**실행 결과**:
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./prisma/dev.db"

SQLite database dev.db created at file:./prisma/dev.db

Applying migration `20251205071831_init`

The following migration(s) have been applied:
migrations/
  └─ 20251205071831_init/
    └─ migration.sql

Your database is now in sync with your schema.

✔ Generated Prisma Client
```

**생성되는 파일**:
- `apps/api/prisma/dev.db` ← SQLite 데이터베이스 파일
- `apps/api/prisma/dev.db-journal` ← 임시 파일 (자동 생성/삭제)

**확인 방법**:
```bash
# SQLite 파일이 생성되었는지 확인
ls -lah apps/api/prisma/dev.db

# 출력 예시:
# -rw-r--r--  1 user  staff   20K 12월  5 16:18 dev.db
```

### 6️⃣ Prisma Studio로 DB 확인 (선택 사항)

```bash
# Prisma Studio 실행 (웹 기반 DB GUI)
npx prisma studio
```

**실행 결과**:
- 브라우저에서 `http://localhost:5555` 자동으로 열림
- GUI로 테이블 구조 확인 가능
- 데이터 조회/추가/수정/삭제 가능

**Spring Boot의 H2 Console과 유사한 역할**

**종료 방법**: `Ctrl + C`

---

## 6. 서버 실행

### 7️⃣ API 서버 실행 (개발 모드)

```bash
# apps/api 디렉토리에서
pnpm start:dev

# 또는 루트 디렉토리에서
pnpm --filter @repo/api start:dev
```

**실행 결과**:
```
============================================================
🚀 애플리케이션이 포트 3000에서 실행 중입니다.
🌍 환경: development
📡 API 주소: http://localhost:3000/api/v1
============================================================

📚 API 문서: http://localhost:3000/api/v1/docs

✅ 적용된 전역 설정:
   1. Request ID Middleware (요청 추적)
   2. Exception Filter (에러 처리 + Prisma 에러 자동 변환)
   3. Validation Pipe (입력 검증 + class-validator)
   4. Transform Interceptor (응답 포맷 ApiSuccessResponse)
   5. Logging Interceptor (요청/응답 로깅 + 민감정보 제거)
   6. Timeout Interceptor (30초 타임아웃)
   7. Rate Limiting (60초에 100번 요청 제한)
   8. Environment Variables Validation (타입 검증)
============================================================
```

### 8️⃣ 서버 동작 확인

**방법 1: 브라우저**
```
http://localhost:3000/health
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-12-05T07:30:00.000Z"
  }
}
```

**방법 2: cURL**
```bash
curl http://localhost:3000/health
```

**방법 3: Swagger UI (API 문서)**
```
http://localhost:3000/api/v1/docs
```

---

## 7. 전체 프로젝트 실행 (선택 사항)

프론트엔드도 함께 실행하려면:

```bash
# 루트 디렉토리에서
pnpm dev
```

**실행되는 서비스**:
- API 서버: `http://localhost:3000`
- 프론트엔드: `http://localhost:3001` (Next.js)

---

## 8. 체크리스트

개발 환경이 제대로 세팅되었는지 확인:

- [ ] Node.js v18+ 설치됨
- [ ] pnpm 설치됨
- [ ] 프로젝트 클론됨
- [ ] `pnpm install` 실행됨
- [ ] `apps/api/.env` 파일 생성됨
- [ ] `npx prisma migrate dev` 실행됨
- [ ] `apps/api/prisma/dev.db` 파일 생성됨
- [ ] `pnpm start:dev` 실행됨
- [ ] `http://localhost:3000/health` 응답 확인됨
- [ ] `http://localhost:3000/api/v1/docs` Swagger 확인됨

---

## 9. Prisma 파일 관리 (Git)

### ✅ Git에 포함해야 하는 파일

```
apps/api/prisma/
├── schema.prisma           ✅ Git에 포함 (DB 스키마 정의)
└── migrations/             ✅ Git에 포함 (마이그레이션 히스토리)
    ├── 20251205071831_init/
    │   └── migration.sql
    └── migration_lock.toml
```

**이유**:
- `schema.prisma`: 데이터베이스 구조 정의 (팀 전체 공유)
- `migrations/`: 데이터베이스 변경 히스토리 (버전 관리)

### ❌ Git에 포함하지 말아야 하는 파일

```
apps/api/prisma/
├── dev.db                  ❌ Git 무시 (로컬 DB 파일)
├── dev.db-journal          ❌ Git 무시 (임시 파일)
├── dev.db-shm              ❌ Git 무시 (공유 메모리 파일)
└── dev.db-wal              ❌ Git 무시 (Write-Ahead Log)
```

**이유**:
- 개발자마다 다른 로컬 데이터를 가짐
- 파일 크기가 커질 수 있음
- 마이그레이션으로 언제든 재생성 가능

### .gitignore 설정 (이미 적용됨)

```gitignore
# apps/api/prisma/ 내부 파일들
*.db
*.db-journal
*.db-shm
*.db-wal
```

---

## 10. 문제 해결 (Troubleshooting)

### ❌ 문제 1: `pnpm install` 실패

**에러**:
```
ERR_PNPM_FETCH_404  GET https://registry.npmjs.org/@repo/types: Not Found
```

**해결**:
```bash
# pnpm 캐시 삭제 후 재설치
pnpm store prune
pnpm install
```

---

### ❌ 문제 2: `npx prisma migrate dev` 실패

**에러**:
```
Environment variable not found: DATABASE_URL
```

**해결**:
```bash
# .env 파일이 있는지 확인
ls apps/api/.env

# 없다면 생성
cd apps/api
echo 'DATABASE_URL="file:./prisma/dev.db"' > .env

# 다시 실행
npx prisma migrate dev
```

---

### ❌ 문제 3: 포트 3000 이미 사용 중

**에러**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**해결 방법 1: 기존 프로세스 종료**
```bash
# Mac/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID번호> /F
```

**해결 방법 2: 다른 포트 사용**
```bash
# apps/api/.env
PORT=3001
```

---

### ❌ 문제 4: SQLite 파일이 생성되지 않음

**증상**:
```
PrismaClientInitializationError: Can't reach database server
```

**해결**:
```bash
# Prisma 클라이언트 재생성
cd apps/api
npx prisma generate

# 마이그레이션 다시 실행
npx prisma migrate dev
```

---

### ❌ 문제 5: Swagger가 안 열림

**증상**:
```
http://localhost:3000/api/v1/docs 404 Not Found
```

**원인**:
- Swagger는 개발/스테이징 환경에서만 활성화됨
- `NODE_ENV=production`이면 비활성화

**해결**:
```bash
# apps/api/.env 확인
NODE_ENV="development"  # ← production이 아니어야 함
```

---

## 11. 다음 단계

개발 환경 세팅이 완료되었습니다! 🎉

**추천 순서**:

1. **아키텍처 이해**
   - [ARCHITECTURE.md](/docs/ARCHITECTURE.md) 읽기
   - Clean Architecture + DDD 구조 파악

2. **API 문서 확인**
   - Swagger UI에서 API 엔드포인트 확인
   - 회원가입/로그인 API 테스트

3. **코드 스타일 가이드**
   - [CODING-STYLE.md](/docs/guides/CODING-STYLE.md) (예정)
   - ESLint, Prettier 설정 확인

4. **첫 번째 기능 개발**
   - 간단한 CRUD API 추가
   - 테스트 작성
   - PR 생성

---

## 12. 추가 리소스

### 문서

- [프로젝트 아키텍처](/docs/ARCHITECTURE.md)
- [Prisma ORM 가이드](/docs/guides/DATABASE-QUERY.md)
- [의존성 주입 가이드](/docs/guides/DEPENDENCY-INJECTION.md)
- [RxJS & tap 연산자](/docs/guides/RXJS-TAP-OPERATOR.md)
- [보안 가이드](/docs/guides/SECURITY.md)
- [로깅 가이드](/docs/guides/LOGGING.md)

### 유용한 명령어

```bash
# Prisma
npx prisma studio              # DB GUI 실행
npx prisma migrate dev         # 마이그레이션 생성 및 적용
npx prisma migrate reset       # DB 초기화 (모든 데이터 삭제)
npx prisma generate            # Prisma Client 재생성

# 개발
pnpm start:dev                 # API 서버 실행 (개발 모드)
pnpm build                     # 빌드
pnpm test                      # 테스트 실행
pnpm lint                      # ESLint 실행

# 데이터베이스
pnpm prisma:migrate            # 마이그레이션 생성
pnpm prisma:studio             # Prisma Studio 실행
```

---

## 13. 팀 협업 시 주의사항

### 새로운 마이그레이션이 추가되었을 때

다른 개발자가 마이그레이션을 추가했다면:

```bash
# 1. 최신 코드 pull
git pull origin main

# 2. 의존성 업데이트 (필요 시)
pnpm install

# 3. 마이그레이션 적용
cd apps/api
npx prisma migrate dev

# 4. Prisma Client 재생성 (자동으로 됨)
npx prisma generate
```

### 마이그레이션 충돌 해결

여러 개발자가 동시에 마이그레이션을 생성한 경우:

```bash
# 1. 로컬 DB 초기화
npx prisma migrate reset

# 2. 모든 마이그레이션 재적용
npx prisma migrate dev
```

---

**마지막 업데이트**: 2025-12-05
**작성자**: Backend Team
**문의**: 개발 환경 세팅 중 문제가 발생하면 팀 채널에 문의하세요.
