import cors from 'cors';
import express, { Request, Response } from 'express';
import { env } from './config/env';
import { closeMongo, connectMongo } from './config/mongodb';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request.middleware';

const createApp = () => {
  const app = express();

  // CORS for frontend integration
  app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL_DEV].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  }));
  app.use(express.json());

  app.use(requestLogger);

  app.get('/', (_req: Request, res: Response) => {
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