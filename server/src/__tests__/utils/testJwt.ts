import jwt from 'jsonwebtoken';

const SECRET = 'test-secret';
process.env.JWT_SECRET = SECRET;
process.env.INTERNAL_API_KEY = 'test-internal-key';

export function makeToken(userId: string, email = 'test@example.com'): string {
  return jwt.sign({ userId, email }, SECRET, { expiresIn: '1h' });
}
