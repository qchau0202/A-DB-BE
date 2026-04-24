import cors from 'cors';
import express from 'express';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (_req, res) => {
    res.json({
      service: 'DevConnect API',
      status: 'ok',
    });
  });

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
