# 시작 가이드

## 사전 요구사항

- **Node.js**: 20.0.0 이상
- **pnpm**: 9.0.0 이상
- **Docker**: 최신 버전
- **Docker Compose**: 최신 버전

## 설치 단계

### 1. 의존성 설치

```bash
# pnpm 설치 (없는 경우)
npm install -g pnpm

# 프로젝트 의존성 설치
pnpm install
```

### 2. 환경 변수 설정

```bash
# 환경 변수 파일 복사
cp .env.example apps/api/.env

# .env 파일 수정 (필요시)
vim apps/api/.env
```

### 3. Docker 컨테이너 시작

```bash
# PostgreSQL, Redis, MinIO 시작
docker-compose up -d

# 컨테이너 상태 확인
docker-compose ps
```

### 4. 데이터베이스 마이그레이션

```bash
# Prisma 클라이언트 생성
cd apps/api
pnpm prisma generate

# 마이그레이션 실행
pnpm prisma migrate dev

# Prisma Studio 실행 (DB GUI)
pnpm prisma studio
```

### 5. 개발 서버 시작

```bash
# 루트 디렉토리로 이동
cd ../..

# 개발 서버 시작 (Hot Reload)
pnpm dev
```

## 접속 정보

### API 서버

- **API 엔드포인트**: http://localhost:12000/api/v1
- **API 문서 (Swagger)**: http://localhost:12000/api/v1/docs
- **헬스 체크**: http://localhost:12000/api/v1/health

### 데이터베이스

- **PostgreSQL**: localhost:12001
  - 사용자: `postgres`
  - 비밀번호: `postgres`
  - 데이터베이스: `collaboration_dev`

- **pgAdmin**: http://localhost:12005
  - 이메일: `admin@example.com`
  - 비밀번호: `admin`

- **Prisma Studio**: http://localhost:5555

### 캐시 & 스토리지

- **Redis**: localhost:12002
- **MinIO API**: http://localhost:12003
- **MinIO Console**: http://localhost:12004
  - 사용자: `minioadmin`
  - 비밀번호: `minioadmin`

## 개발 명령어

```bash
# 개발 서버 (Watch Mode)
pnpm dev

# 빌드
pnpm build

# 테스트
pnpm test              # 단위 테스트
pnpm test:e2e          # E2E 테스트
pnpm test:cov          # 커버리지

# 린트
pnpm lint

# 포맷팅
pnpm format

# 데이터베이스
pnpm db:migrate        # 마이그레이션
pnpm db:seed           # 시드 데이터
pnpm db:studio         # Prisma Studio
```

## 주요 디렉토리

```
fullstack-nextjs/
├── apps/
│   └── api/                    # NestJS API 서버
│       ├── src/
│       │   ├── modules/        # 비즈니스 모듈
│       │   ├── shared/         # 공통 모듈
│       │   └── common/         # 유틸리티
│       └── prisma/             # DB 스키마
├── packages/
│   └── types/                  # 공통 타입
├── docs/
│   └── guides/                 # 개발 가이드
└── infrastructure/
    └── docker/                 # Docker 설정
```

## 다음 단계

1. [개발 컨벤션](./conventions.md) 읽기
2. [데이터베이스 쿼리 가이드](./database-query-guide.md) 읽기
3. [API 문서](http://localhost:3000/api/v1/docs) 확인
4. 첫 모듈 개발 시작

## 문제 해결

### Docker 컨테이너가 시작되지 않는 경우

```bash
# 컨테이너 로그 확인
docker-compose logs postgres
docker-compose logs redis

# 컨테이너 재시작
docker-compose restart

# 완전히 재구성
docker-compose down -v
docker-compose up -d
```

### Prisma 마이그레이션 오류

```bash
# Prisma 클라이언트 재생성
pnpm prisma generate

# 마이그레이션 초기화 (주의: 데이터 손실)
pnpm prisma migrate reset

# 새 마이그레이션 생성
pnpm prisma migrate dev --name init
```

### 포트 충돌

```bash
# 포트 사용 중인 프로세스 확인
lsof -i :3000
lsof -i :5432

# 프로세스 종료
kill -9 <PID>
```

## 추가 리소스

- [NestJS 공식 문서](https://docs.nestjs.com/)
- [Prisma 공식 문서](https://www.prisma.io/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- [Turborepo 문서](https://turbo.build/repo/docs)

---

**마지막 업데이트**: 2025-12-05
