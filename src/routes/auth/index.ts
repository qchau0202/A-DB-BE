import { Router } from 'express';
import { registrationRouter } from './registration.routes';
import { sessionRouter } from './session.routes';

export const authRouter = Router();

authRouter.use('/', registrationRouter);
authRouter.use('/', sessionRouter);