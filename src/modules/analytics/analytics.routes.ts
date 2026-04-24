import { Router } from 'express';
import { influentialSnippetsQuery } from './analytics.queries';

export const analyticsRouter = Router();

analyticsRouter.get('/influential-snippets/query', (_req, res) => {
  res.json({
    description: 'SQL window function ranking for most influential snippets in the last 7 days.',
    query: influentialSnippetsQuery,
  });
});
