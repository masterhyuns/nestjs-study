/**
 * Request ID 미들웨어
 *
 * @description
 * 모든 요청에 고유한 ID를 부여하여 로그 추적 가능
 *
 * @features
 * - UUID v4 생성
 * - X-Request-ID 헤더로 클라이언트에 반환
 * - request.id로 접근 가능
 * - 분산 시스템 로그 추적
 *
 * @usage
 * app.use(requestIdMiddleware);
 *
 * @performance <1ms
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // 클라이언트가 보낸 Request ID 사용 또는 새로 생성
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Request 객체에 ID 저장
    req.id = requestId;

    // 응답 헤더에 Request ID 추가
    res.setHeader('X-Request-ID', requestId);

    next();
  }
}
