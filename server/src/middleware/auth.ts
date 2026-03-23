import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string;
}

export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '인증이 필요합니다' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as JwtPayload;
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다' });
  }
}
