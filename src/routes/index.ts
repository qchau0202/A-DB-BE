import { Router } from 'express';
import { authRouter } from './auth';
import { profileRouter } from './profile/profile.routes';
import { postRouter } from './posts/post.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/posts', postRouter);

console.log('[Routes] Registered: /api/auth/*, /api/profile/*, /api/posts/*');
