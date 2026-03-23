import { Request, Response, NextFunction } from 'express';

export function authenticateInternal(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    res.status(403).json({ error: '접근 권한이 없습니다' });
    return;
  }
  next();
}
