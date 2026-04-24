import { Router } from 'express';
import { postsRepository } from './posts.repository';

export const postsRouter = Router();

postsRouter.post('/indexes/text', async (_req, res, next) => {
  try {
    await postsRepository.createTextIndexes();
    res.json({ message: 'MongoDB text index created for snippet + tags.' });
  } catch (error) {
    next(error);
  }
});

postsRouter.post('/', async (req, res, next) => {
  try {
    const post = await postsRepository.insertPost(req.body);
    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});
