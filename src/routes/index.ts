import { Router } from 'express';
import { authRouter } from './auth';
import { profileRouter } from './profile/profile.routes';
import { postRouter } from './posts/post.routes';
import { commentRouter } from './comments/comment.routes';
import { quickieRouter } from './quickies/quickie.routes';
import { documentRouter } from './documents/document.routes';
import { notificationRouter } from './notifications/notification.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/posts', postRouter);
apiRouter.use('/comments', commentRouter);
apiRouter.use('/quickies', quickieRouter);
apiRouter.use('/documents', documentRouter);
apiRouter.use('/notifications', notificationRouter);

console.log('[Routes] Registered: /api/auth/*, /api/profile/*, /api/posts/*, /api/comments/*, /api/quickies/*, /api/documents/*, /api/notifications/*');
