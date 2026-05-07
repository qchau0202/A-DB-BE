import cors from 'cors';
import express, { Request, Response } from 'express';
import { env } from './config/env';
import { closeMongo, connectMongo } from './config/mongodb';
import { supabaseAdmin } from './config/supabase';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request.middleware';

const createApp = () => {
  const app = express();
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL_DEV].filter(
    (origin): origin is string => Boolean(origin),
  );

  // CORS for frontend integration
  app.use(cors({
    origin: allowedOrigins,
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
  // Connect to MongoDB
  await connectMongo();

  // Verify Supabase connection
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
      if (error) {
        console.error('Supabase connection failed:', error.message);
        console.error('Check your SUPABASE_SERVICE_ROLE_KEY environment variable');
      } else {
        console.log(`Supabase connected (found ${data.total} auth users)`);
      }
    } catch (err) {
      console.error('Supabase connection error:', err);
    }
  } else {
    console.warn('Supabase admin client not configured - user sync features disabled');
  }

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