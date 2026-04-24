import { getMongoDb } from '../../config/mongodb';
import type { PostDocument } from './posts.types';

const COLLECTION = 'posts';

export const postsRepository = {
  async createTextIndexes(): Promise<void> {
    const db = getMongoDb();
    await db.collection<PostDocument>(COLLECTION).createIndex(
      { snippet: 'text', tags: 'text' },
      { name: 'snippet_tags_text_idx' },
    );
  },

  async insertPost(payload: PostDocument): Promise<PostDocument> {
    const db = getMongoDb();
    const post = {
      ...payload,
      created_at: payload.created_at ?? new Date(),
    };

    await db.collection<PostDocument>(COLLECTION).insertOne(post);
    return post;
  },
};
