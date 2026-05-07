import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

type QuickiePayload = {
  author_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string | undefined;
  notify?: boolean;
};

const getQuickiesCollection = () => getMongoDb().collection('quickies');

export const createQuickie = async (payload: QuickiePayload) => {
  const now = new Date();
  const quickie = {
    author_id: payload.author_id,
    media_url: payload.media_url,
    media_type: payload.media_type,
    caption: payload.caption ?? null,
    viewers: [] as string[],
    reactions: { like: 0 },
    notify: payload.notify ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getQuickiesCollection().insertOne(quickie);
  return { _id: result.insertedId, ...quickie };
};

export const getQuickieById = async (id: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid quickie ID');
  }

  const quickie = await getQuickiesCollection().findOne({ _id: new ObjectId(id) });
  return quickie ?? null;
};

export const getQuickiesByAuthor = async (authorId: string, limit = 20, skip = 0) => {
  const quickies = await getQuickiesCollection()
    .find({ author_id: authorId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return quickies;
};

export const getFeedQuickies = async (authorIds: string[], limit = 20, skip = 0) => {
  const quickies = await getQuickiesCollection()
    .find({ author_id: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return quickies;
};

// Get latest quickies for public feed (all recent quickies)
export const getLatestQuickies = async (limit = 20, skip = 0) => {
  const quickies = await getQuickiesCollection()
    .find({})
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return quickies;
};

export const updateQuickie = async (id: string, authorId: string, updates: Partial<QuickiePayload>) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid quickie ID');
  }

  const allowedUpdates: Record<string, unknown> = {};
  if (updates.media_url !== undefined) allowedUpdates.media_url = updates.media_url;
  if (updates.caption !== undefined) allowedUpdates.caption = updates.caption;

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  allowedUpdates.updatedAt = new Date();

  const result = await getQuickiesCollection().findOneAndUpdate(
    { _id: new ObjectId(id), author_id: authorId },
    { $set: allowedUpdates },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const deleteQuickie = async (id: string, authorId: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid quickie ID');
  }

  const result = await getQuickiesCollection().deleteOne({
    _id: new ObjectId(id),
    author_id: authorId,
  });

  return result.deletedCount === 1;
};

export const addViewerToQuickie = async (id: string, viewerId: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid quickie ID');
  }

  const result = await getQuickiesCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $addToSet: { viewers: viewerId },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const addReactionToQuickie = async (id: string, userId: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid quickie ID');
  }

  const result = await getQuickiesCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $inc: { 'reactions.like': 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export default {
  createQuickie,
  getQuickieById,
  getQuickiesByAuthor,
  getFeedQuickies,
  getLatestQuickies,
  updateQuickie,
  deleteQuickie,
  addViewerToQuickie,
  addReactionToQuickie,
};
