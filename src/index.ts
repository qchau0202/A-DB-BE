import { createApp } from './app';
import { env } from './config/env';
import { closeMongo, connectMongo } from './config/mongodb';

const app = createApp();

const server = app.listen(env.port, async () => {
  await connectMongo();
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