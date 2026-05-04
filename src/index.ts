import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { closeMongo, connectMongo } from './config/mongodb';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request.middleware';

const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({
      service: 'DevConnect API',
      status: 'ok',
    });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const start = async () => {
  await connectMongo();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Server is running at http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    console.log('Shutting down server...');
    server.close(async () => {
      await closeMongo();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});