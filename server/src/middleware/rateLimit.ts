import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' },
});

export const internalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: '요청이 너무 많습니다.' },
});
