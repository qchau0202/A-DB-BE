import { Router } from 'express';
import { healthRouter } from '../modules/health/health.routes';
import { socialGraphRouter } from '../modules/social-graph/social-graph.routes';
import { postsRouter } from '../modules/posts/posts.routes';
import { analyticsRouter } from '../modules/analytics/analytics.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/social-graph', socialGraphRouter);
apiRouter.use('/posts', postsRouter);
apiRouter.use('/analytics', analyticsRouter);
