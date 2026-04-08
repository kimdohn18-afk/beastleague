import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    // 비밀 키 검증
    const registerSecret = req.headers['x-register-secret'];
    if (!registerSecret || registerSecret !== process.env.AUTH_REGISTER_SECRET) {
      return res.status(403).json({ error: '접근 권한이 없습니다' });
    }

    const { email, name, provider, providerId } = req.body;

    if (!provider || !providerId) {
      return res.status(400).json({ error: 'provider and providerId are required' });
    }

    let user = await User.findOne({ provider, providerId });

    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
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

export const authRouter = router;
