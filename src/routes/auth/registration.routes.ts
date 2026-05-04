import { Router } from 'express';
import { authController } from '../../controller/auth/auth.controller';

export const registrationRouter = Router();

registrationRouter.post('/sign-up', authController.signUp);