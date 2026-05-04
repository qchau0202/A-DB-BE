import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

type CommentPayload = {
  target_id: string;
  parent_comment_id?: string | null;
  author_id: string;
  content: string;
};

const getCommentsCollection = () => getMongoDb().collection('comments');
const getPostsCollection = () => getMongoDb().collection('posts');

export const createComment = async (payload: CommentPayload) => {
  if (!ObjectId.isValid(payload.target_id)) {
    throw new Error('Invalid target ID');
  }

  if (payload.parent_comment_id && !ObjectId.isValid(payload.parent_comment_id)) {
    throw new Error('Invalid parent comment ID');
  }

  const now = new Date();
  const comment = {
    target_id: new ObjectId(payload.target_id),
    parent_comment_id: payload.parent_comment_id ? new ObjectId(payload.parent_comment_id) : null,
    author_id: payload.author_id,
    content: payload.content,
    is_deleted: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getCommentsCollection().insertOne(comment);

  // Increment post comment_count
  await getPostsCollection().updateOne(
    { _id: new ObjectId(payload.target_id) },
    { $inc: { comment_count: 1 } }
  );

  return { _id: result.insertedId, ...comment };
};

export const getCommentById = async (id: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid comment ID');
  }

  const comment = await getCommentsCollection().findOne({ _id: new ObjectId(id) });
  return comment ?? null;
};

export const getCommentsByTarget = async (targetId: string, parentId: string | null = null, limit = 20, skip = 0) => {
  if (!ObjectId.isValid(targetId)) {
    throw new Error('Invalid target ID');
  }

  const filter: Record<string, unknown> = {
    target_id: new ObjectId(targetId),
    is_deleted: false,
  };

  if (parentId === null) {
    filter.parent_comment_id = null;
  } else if (parentId !== undefined) {
    if (!ObjectId.isValid(parentId)) {
      throw new Error('Invalid parent comment ID');
    }
    filter.parent_comment_id = new ObjectId(parentId);
  }

  const comments = await getCommentsCollection()
    .find(filter)
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return comments;
};

export const getReplies = async (parentCommentId: string, limit = 20, skip = 0) => {
  if (!ObjectId.isValid(parentCommentId)) {
    throw new Error('Invalid parent comment ID');
  }

  const comments = await getCommentsCollection()
    .find({
      parent_comment_id: new ObjectId(parentCommentId),
      is_deleted: false,
    })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return comments;
};

export const updateComment = async (id: string, authorId: string, content: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid comment ID');
  }

  const result = await getCommentsCollection().findOneAndUpdate(
    {
      _id: new ObjectId(id),
      author_id: authorId,
      is_deleted: false,
    },
    {
      $set: {
        content,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const deleteComment = async (id: string, authorId: string) => {
  if (!ObjectId.isValid(id)) {
    throw new Error('Invalid comment ID');
  }

  // Soft delete - set content to [removed] and is_deleted to true
  const result = await getCommentsCollection().findOneAndUpdate(
    {
      _id: new ObjectId(id),
      author_id: authorId,
      is_deleted: false,
    },
    {
      $set: {
        content: '[removed]',
        is_deleted: true,
        updatedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );

  if (result) {
    // Decrement post comment_count
    await getPostsCollection().updateOne(
      { _id: result.target_id },
      { $inc: { comment_count: -1 } }
    );
  }

  return result ? true : false;
};

export const getCommentCount = async (targetId: string) => {
  if (!ObjectId.isValid(targetId)) {
    throw new Error('Invalid target ID');
  }

  const count = await getCommentsCollection().countDocuments({
    target_id: new ObjectId(targetId),
    is_deleted: false,
  });

  return count;
};

export default {
  createComment,
  getCommentById,
  getCommentsByTarget,
  getReplies,
  updateComment,
  deleteComment,
  getCommentCount,
};
