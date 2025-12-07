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

### ❌ 문제 6: [Windows] Prisma 엔진 다운로드 실패

**에러**:
```
Downloading Prisma engines for Node-API for windows
Error: request to https://binaries.prisma.sh/... failed
```

**원인**:
- Windows 방화벽/프록시가 Prisma 엔진 다운로드 차단
- 회사 네트워크 정책으로 외부 바이너리 다운로드 제한
- OpenSSL 라이브러리 누락

**해결 방법 1: 프록시 설정 (회사 네트워크인 경우)**
```bash
# PowerShell에서 실행
$env:HTTP_PROXY="http://proxy.company.com:8080"
$env:HTTPS_PROXY="http://proxy.company.com:8080"

# 그 후 다시 실행
npx prisma migrate dev
```

**해결 방법 2: Prisma 엔진 캐시 초기화**
```bash
# PowerShell에서 실행
# 1. Prisma 엔진 캐시 폴더 삭제
Remove-Item -Recurse -Force $env:USERPROFILE\.cache\prisma

# 2. node_modules 삭제
Remove-Item -Recurse -Force node_modules

# 3. 재설치
pnpm install

# 4. Prisma Client 재생성
npx prisma generate

# 5. 마이그레이션 실행
npx prisma migrate dev
```

**해결 방법 3: 방화벽 임시 해제**
```
1. Windows 보안 설정 열기
2. 방화벽 및 네트워크 보호 → 개인 네트워크 → Windows Defender 방화벽 끄기
3. npx prisma migrate dev 실행
4. 방화벽 다시 켜기 (중요!)
```

**해결 방법 4: 환경 변수 설정 (엔진 다운로드 스킵)**
```bash
# PowerShell에서 실행
# Prisma 엔진 다운로드 재시도 설정
$env:PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING="1"

# 다시 실행
npx prisma generate
npx prisma migrate dev
```

**해결 방법 5: Node.js 버전 확인 및 재설치**
```bash
# Node.js 버전 확인
node -v

# 18.x 또는 20.x LTS 버전 권장
# https://nodejs.org/ 에서 최신 LTS 다운로드
```

**해결 방법 6: OpenSSL 설치 (Windows)**
```bash
# Chocolatey 사용 (관리자 권한 PowerShell)
choco install openssl

# 또는 수동 설치
# https://slproweb.com/products/Win32OpenSSL.html
# Win64 OpenSSL v3.x.x Light 다운로드
```

**해결 방법 7: 로컬 엔진 바이너리 사용 (PRISMA_QUERY_ENGINE_BINARY) ⭐ 추천**

이 방법은 엔진을 미리 다운로드해서 로컬 파일로 바라보게 설정합니다.
**팀 전체가 동일한 바이너리를 공유할 수 있어 가장 안정적입니다.**

**Step 1: Prisma 버전 및 엔진 commit hash 확인**

**❗ 주의**: `npx prisma -v`를 실행하면 엔진 다운로드를 시도하므로 에러가 발생할 수 있습니다.
**아래 대체 방법을 먼저 시도하세요.**

**방법 A: package.json에서 Prisma 버전 확인 (추천)**
```bash
# PowerShell에서 실행
cd apps/api
cat package.json | Select-String -Pattern "prisma"

# 또는
Get-Content package.json | Select-String "prisma"

# 출력 예시:
# "prisma": "^5.22.0",
# "@prisma/client": "^5.22.0"
```

**방법 B: node_modules에서 commit hash 직접 확인**
```bash
# PowerShell에서 실행
cd apps/api

# Prisma Client 설치되어 있다면
cat node_modules\.prisma\client\package.json | Select-String "prismaCommit"

# 또는
Get-Content node_modules\.prisma\client\libquery_engine-windows.dll.node.txt 2>$null

# 출력 예시:
# "prismaCommit": "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
```

**방법 C: npm에서 engines-version 패키지 확인**

```bash
# PowerShell에서 실행
cd apps/api

# @prisma/engines-version 패키지에서 commit hash 확인
cat node_modules\@prisma\engines-version\package.json | Select-String "version"

# 또는 engines 패키지 확인
cat node_modules\@prisma\engines\package.json
```

**방법 D: 이 프로젝트의 정확한 commit hash (Prisma 6.1.0) ⭐**

**이 프로젝트는 Prisma 6.1.0을 사용합니다.**

**Prisma 6.1.0의 엔진 commit hash**:
```
11f085a2012c0f4778414c8db2651556ee0ef959
```

**다운로드 URL**:
```bash
# query-engine
https://binaries.prisma.sh/all_commits/11f085a2012c0f4778414c8db2651556ee0ef959/windows/query_engine-windows.dll.node.gz

# schema-engine
https://binaries.prisma.sh/all_commits/11f085a2012c0f4778414c8db2651556ee0ef959/windows/schema-engine-windows.exe.gz

# introspection-engine
https://binaries.prisma.sh/all_commits/11f085a2012c0f4778414c8db2651556ee0ef959/windows/introspection-engine-windows.exe.gz
```

**다른 버전을 사용하는 경우**:
1. npm registry에서 확인: `https://registry.npmjs.org/@prisma/engines/{버전}`
2. 버전 필드에서 commit hash 추출 (예: `6.1.0-21.{commit_hash}`)

**방법 E: 엔진 다운로드 스킵하고 실행 (임시)**
```powershell
# PowerShell에서 실행
$env:PRISMA_SKIP_POSTINSTALL_GENERATE="1"
npx prisma -v

# 출력에서 Query Engine 라인의 해시값 확인
```

**확인된 commit hash 예시**:
```
605197351a3c8bdd595af2d2a9bc3025bca48ea2
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
이 전체 해시값을 복사하세요
```

**Step 2: 엔진 바이너리 다운로드**

**중요**: Prisma는 3가지 엔진을 사용합니다. **모두 다운로드해야 합니다.**
1. **query-engine** (Query Engine): 데이터베이스 쿼리 실행
2. **schema-engine** (Schema Engine): 마이그레이션 실행 (`migrate dev`)
3. **introspection-engine** (선택): 기존 DB에서 스키마 생성 (`prisma db pull`)

**방법 A: 브라우저에서 다운로드 (VPN 끄고 시도)**

**① query-engine 다운로드**
```
1. URL:
   https://binaries.prisma.sh/all_commits/{commit_hash}/windows/query_engine-windows.dll.node.gz

2. 예시:
   https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/query_engine-windows.dll.node.gz

3. 압축 해제 → query_engine-windows.dll.node
```

**② schema-engine 다운로드 (마이그레이션용)**
```
1. URL:
   https://binaries.prisma.sh/all_commits/{commit_hash}/windows/schema-engine-windows.exe.gz

2. 예시:
   https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/schema-engine-windows.exe.gz

3. 압축 해제 → schema-engine-windows.exe
```

**③ introspection-engine 다운로드 (선택 사항)**
```
1. URL:
   https://binaries.prisma.sh/all_commits/{commit_hash}/windows/introspection-engine-windows.exe.gz

2. 예시:
   https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/windows/introspection-engine-windows.exe.gz

3. 압축 해제 → introspection-engine-windows.exe
```

**압축 해제 방법**:
- 7-Zip 사용: 우클릭 → 7-Zip → Extract Here
- 또는 PowerShell: `gzip -d 파일명.gz`

**방법 B: PowerShell로 일괄 다운로드 (고급)**
```powershell
# PowerShell에서 실행 (commit_hash 부분을 실제 값으로 변경)
$commitHash = "605197351a3c8bdd595af2d2a9bc3025bca48ea2"  # npx prisma -v에서 확인한 값
$downloadDir = "$env:USERPROFILE\Downloads\prisma-engines"

# 다운로드 폴더 생성
New-Item -ItemType Directory -Force -Path $downloadDir

# 1. query-engine 다운로드
$queryUrl = "https://binaries.prisma.sh/all_commits/$commitHash/windows/query_engine-windows.dll.node.gz"
Invoke-WebRequest -Uri $queryUrl -OutFile "$downloadDir\query_engine-windows.dll.node.gz"

# 2. schema-engine 다운로드
$schemaUrl = "https://binaries.prisma.sh/all_commits/$commitHash/windows/schema-engine-windows.exe.gz"
Invoke-WebRequest -Uri $schemaUrl -OutFile "$downloadDir\schema-engine-windows.exe.gz"

# 3. introspection-engine 다운로드 (선택)
$introUrl = "https://binaries.prisma.sh/all_commits/$commitHash/windows/introspection-engine-windows.exe.gz"
Invoke-WebRequest -Uri $introUrl -OutFile "$downloadDir\introspection-engine-windows.exe.gz"

Write-Host "다운로드 완료: $downloadDir"
Write-Host "7-Zip으로 모든 .gz 파일을 압축 해제하세요."
```

**Step 3: 엔진 파일을 프로젝트 내부에 저장 (팀 공유용)**

```bash
# 프로젝트 루트에 prisma-engines 폴더 생성
mkdir prisma-engines
cd prisma-engines
mkdir windows

# 다운로드 & 압축 해제한 파일을 여기에 복사
# - query_engine-windows.dll.node
# - schema-engine-windows.exe
# - introspection-engine-windows.exe (선택)
```

**폴더 구조 예시**:
```
fullstack-nextjs/
├── apps/
├── packages/
├── prisma-engines/           ← 새로 생성
│   └── windows/
│       ├── query_engine-windows.dll.node      ← Query Engine (필수)
│       ├── schema-engine-windows.exe          ← Schema Engine (필수)
│       └── introspection-engine-windows.exe   ← Introspection Engine (선택)
├── pnpm-workspace.yaml
└── package.json
```

**Step 4: 환경 변수 설정**

**중요**: 3가지 엔진 모두 환경 변수로 지정해야 합니다.

**방법 A: .env 파일에 추가 (프로젝트별 설정) - 추천**
```bash
# apps/api/.env에 추가

# Query Engine (데이터베이스 쿼리 실행)
PRISMA_QUERY_ENGINE_BINARY=../../prisma-engines/windows/query_engine-windows.dll.node

# Schema Engine (마이그레이션 실행)
PRISMA_SCHEMA_ENGINE_BINARY=../../prisma-engines/windows/schema-engine-windows.exe

# Introspection Engine (선택 사항: prisma db pull 사용 시)
PRISMA_INTROSPECTION_ENGINE_BINARY=../../prisma-engines/windows/introspection-engine-windows.exe
```

**방법 B: PowerShell 세션에서 설정 (임시)**
```powershell
# PowerShell에서 실행 (절대 경로 사용)
$basePath = "C:\Users\YourName\fullstack-nextjs\prisma-engines\windows"
$env:PRISMA_QUERY_ENGINE_BINARY="$basePath\query_engine-windows.dll.node"
$env:PRISMA_SCHEMA_ENGINE_BINARY="$basePath\schema-engine-windows.exe"
$env:PRISMA_INTROSPECTION_ENGINE_BINARY="$basePath\introspection-engine-windows.exe"
```

**방법 C: Windows 환경 변수로 설정 (영구적)**
```
1. Win + R → sysdm.cpl 입력
2. 고급 탭 → 환경 변수 클릭
3. 사용자 변수 → 새로 만들기 (3개 추가)

   변수 1:
   - 이름: PRISMA_QUERY_ENGINE_BINARY
   - 값: C:\Users\YourName\fullstack-nextjs\prisma-engines\windows\query_engine-windows.dll.node

   변수 2:
   - 이름: PRISMA_SCHEMA_ENGINE_BINARY
   - 값: C:\Users\YourName\fullstack-nextjs\prisma-engines\windows\schema-engine-windows.exe

   변수 3:
   - 이름: PRISMA_INTROSPECTION_ENGINE_BINARY
   - 값: C:\Users\YourName\fullstack-nextjs\prisma-engines\windows\introspection-engine-windows.exe

4. 확인 → PowerShell 재시작
```

**Step 5: Prisma 재생성 및 실행**
```bash
# PowerShell에서 실행
cd apps/api

# Prisma Client 재생성
npx prisma generate

# 마이그레이션 실행
npx prisma migrate dev
```

**성공 시 출력**:
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./prisma/dev.db"

✔ Generated Prisma Client (version 5.22.0) to .\node_modules\@prisma\client
```

**Step 6: Git 관리 (팀 공유 시)**

**옵션 A: 바이너리를 Git에 포함 (팀 전체 사용)**
```bash
# .gitignore에서 prisma-engines 폴더 제외 (포함시키기)
# 이미 .gitignore에 있다면 주석 처리하거나 예외 추가

# Git에 추가
git add prisma-engines/
git commit -m "chore: Prisma 엔진 바이너리 추가 (Windows)"
git push
```

**장점**: 팀원 모두 동일한 바이너리 사용, 다운로드 문제 없음
**단점**: Git 저장소 크기 증가 (~30MB)

**옵션 B: 바이너리를 Git에서 제외 (각자 다운로드)**
```gitignore
# .gitignore에 추가
prisma-engines/
```

팀원들은 각자 다운로드 후 동일한 경로에 배치

**검증 방법**:
```bash
# PowerShell에서 실행

# 1. 환경 변수 확인 (3개 모두)
echo $env:PRISMA_QUERY_ENGINE_BINARY
echo $env:PRISMA_SCHEMA_ENGINE_BINARY
echo $env:PRISMA_INTROSPECTION_ENGINE_BINARY

# 2. Prisma 버전 확인 (바이너리 경로 표시됨)
npx prisma -v

# 출력 예시:
# Query Engine (Node-API) : libquery-engine {hash} (at C:\...\prisma-engines\windows\query_engine-windows.dll.node)
#                                                     ^^^ 사용자 지정 경로가 표시되어야 함

# 3. 마이그레이션 테스트 (schema-engine 사용)
npx prisma migrate dev

# 성공 시:
# ✔ Generated Prisma Client
# Your database is now in sync with your schema
```

**팀 협업 시 README 추가 예시**:
```markdown
## Windows 환경 설정

Prisma 엔진 다운로드 이슈로 인해 로컬 바이너리를 사용합니다.

1. `apps/api/.env`에 다음 3줄 추가:
   ```
   PRISMA_QUERY_ENGINE_BINARY=../../prisma-engines/windows/query_engine-windows.dll.node
   PRISMA_SCHEMA_ENGINE_BINARY=../../prisma-engines/windows/schema-engine-windows.exe
   PRISMA_INTROSPECTION_ENGINE_BINARY=../../prisma-engines/windows/introspection-engine-windows.exe
   ```

2. 바이너리가 없다면:
   - `prisma-engines/windows/` 폴더 확인 (3개 파일 필요)
   - 없으면 [다운로드 가이드](docs/guides/LOCAL-SETUP.md#문제-6-windows-prisma-엔진-다운로드-실패) 참고
```

**주의사항**:
- Prisma 버전을 업데이트하면 commit hash가 변경되므로 바이너리도 새로 다운로드해야 함
- Mac/Linux 개발자와 협업 시 각 OS별 바이너리를 별도로 관리:
  ```
  prisma-engines/
  ├── windows/
  │   ├── query_engine-windows.dll.node
  │   ├── schema-engine-windows.exe
  │   └── introspection-engine-windows.exe
  ├── darwin/  (Mac)
  │   ├── libquery_engine-darwin.dylib.node
  │   ├── schema-engine-darwin
  │   └── introspection-engine-darwin
  └── linux/
      ├── libquery_engine-linux.so.node
      ├── schema-engine-linux
      └── introspection-engine-linux
  ```

**참고**:
- 이 방법은 외부 다운로드가 완전히 차단된 환경에서 가장 효과적
- 한 번만 설정하면 팀 전체가 동일한 바이너리 사용 가능
- VPN 사용 시 VPN 끄고 다운로드 시도

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
