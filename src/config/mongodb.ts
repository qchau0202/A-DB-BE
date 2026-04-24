import { Db, MongoClient } from 'mongodb';
import { env } from './env';

let mongoClient: MongoClient | null = null;
let db: Db | null = null;

export const connectMongo = async (): Promise<void> => {
  if (!env.mongodbUri) {
    console.warn('MONGODB_URI is empty. MongoDB connection is skipped.');
    return;
  }

  if (mongoClient) {
    return;
  }

  mongoClient = new MongoClient(env.mongodbUri);
  await mongoClient.connect();
  db = mongoClient.db(env.mongodbDbName);
  console.log(`MongoDB connected: ${env.mongodbDbName}`);
};

export const getMongoDb = (): Db => {
  if (!db) {
    throw new Error('MongoDB is not connected.');
  }

  return db;
};

export const closeMongo = async (): Promise<void> => {
  if (!mongoClient) {
    return;
  }

  await mongoClient.close();
  mongoClient = null;
  db = null;
  console.log('MongoDB disconnected');
};
