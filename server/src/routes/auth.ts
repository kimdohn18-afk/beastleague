import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export const authRouter = Router();

// POST /api/auth/register — NextAuth 콜백에서 호출 (인증 미들웨어 없음)
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, provider, providerId } = req.body as {
      email: string; name: string; provider: 'kakao' | 'google'; providerId: string;
    };

    if (!email || !provider || !providerId) {
      return res.status(400).json({ error: 'email, provider, providerId 필수' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, name, provider, providerId });
    }

    const accessToken = jwt.sign(
      { userId: String(user._id), email: user.email },
      process.env.JWT_SECRET ?? 'dev-secret',
      { expiresIn: '30d' }
    );

    return res.json({ userId: String(user._id), email: user.email, accessToken });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
