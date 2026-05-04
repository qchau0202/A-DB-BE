import { Router } from 'express';
import { authController } from '../../controller/auth/auth.controller';

export const sessionRouter = Router();

sessionRouter.post('/sign-in', authController.signIn);
sessionRouter.post('/refresh', authController.refreshSession);
sessionRouter.post('/sign-out', authController.signOut);
sessionRouter.get('/me', authController.me);