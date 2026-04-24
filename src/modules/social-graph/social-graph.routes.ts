import { Router } from 'express';
import { socialGraphService } from './social-graph.service';

export const socialGraphRouter = Router();

socialGraphRouter.get('/mutual-connections/query', (req, res) => {
  const userId = Number(req.query.userId ?? 0);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Query param userId must be a positive number.' });
  }

  return res.json({
    description: 'Recursive CTE for mutual connections up to 3rd degree.',
    parameterHint: '$1 => source user id',
    query: socialGraphService.getMutualConnectionQuery(),
  });
});
