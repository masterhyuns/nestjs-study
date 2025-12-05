-- PostgreSQL 초기화 스크립트
--
-- 데이터베이스 초기 설정 및 확장 프로그램 설치

-- UUID 생성 확장 (Prisma cuid() 대신 UUID 사용 시)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 전문 검색 확장 (Full-Text Search)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 통계 정보 확장
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 데이터베이스 설정
ALTER DATABASE collaboration_dev SET timezone TO 'UTC';

-- 연결 풀 설정
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';

-- 성능 모니터링 활성화
ALTER SYSTEM SET track_activities = on;
ALTER SYSTEM SET track_counts = on;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET track_functions = 'pl';

COMMENT ON DATABASE collaboration_dev IS '협업 플랫폼 개발 데이터베이스';
