import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, name, provider, providerId } = req.body;

    if (!provider || !providerId) {
      return res.status(400).json({ error: 'provider and providerId are required' });
    }

    // Search by provider + providerId first
    let user = await User.findOne({ provider, providerId });

    if (!user && email) {
      // Try finding by email
      user = await User.findOne({ email });
      if (user) {
        // Update providerId
        user.providerId = providerId;
        user.provider = provider;
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        email: email || `${provider}_${providerId}@beastleague.local`,
        name: name || `${provider}유저`,
        provider,
        providerId,
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    return res.status(200).json({ user, token });
  } catch (error: any) {
    console.error('Auth register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 로그아웃 엔드포인트 추가
router.post('/logout', (_req: Request, res: Response) => {
  // 세션 기반일 경우 세션 파괴, JWT일 경우 클라이언트 측에서 토큰 폐기 안내
  return res.status(200).json({ message: 'Successfully logged out' });
});

export const authRouter = router;
