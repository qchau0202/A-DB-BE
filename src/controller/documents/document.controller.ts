import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

type DocumentPayload = {
  author_id: string;
  title: string;
  body: string;
  parent_doc_id?: string | null | undefined;
  category_tags?: string[] | undefined;
  is_published?: boolean | undefined;
};

type DocumentUpdatePayload = {
  title?: string;
  body?: string;
  parent_doc_id?: string | null;
  category_tags?: string[];
  is_published?: boolean;
  editor_id: string;
  expected_version: number;
};

const getDocumentsCollection = () => getMongoDb().collection('documents');

export const createDocument = async (payload: DocumentPayload) => {
  const now = new Date();
  const doc = {
    author_id: payload.author_id,
    editors: [] as string[],
    title: payload.title,
    body: payload.body,
    parent_doc_id: payload.parent_doc_id ? new ObjectId(payload.parent_doc_id) : null,
    category_tags: payload.category_tags ?? [],
    version: 1,
    is_published: payload.is_published ?? false,
    view_count: 0,
    reactions: { like: 0, insightful: 0 },
    comment_count: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getDocumentsCollection().insertOne(doc);
  return { _id: result.insertedId, ...doc };
};

export const getDocumentById = async (id: string) => {
  // Accept either Mongo ObjectId (24-hex) or string _id (e.g. UUID or custom id)
  let doc: any = null;
  if (ObjectId.isValid(id)) {
    doc = await getDocumentsCollection().findOne({ _id: new ObjectId(id) });
    if (doc) return doc;
  }

  // Fallback: attempt to find by literal string _id (some imports/records may use string ids)
  doc = await getDocumentsCollection().findOne({ _id: id as any });
  return doc ?? null;
};

export const getDocumentsByAuthor = async (authorId: string, includeDrafts = false, limit = 20, skip = 0) => {
  const filter: Record<string, unknown> = { author_id: authorId };
  if (!includeDrafts) {
    filter.is_published = true;
  }

  const docs = await getDocumentsCollection()
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs;
};

export const getPublishedDocuments = async (limit = 20, skip = 0) => {
  const docs = await getDocumentsCollection()
    .find({ is_published: true })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs;
};

export const getDocumentsByTags = async (tags: string[], limit = 20, skip = 0) => {
  const docs = await getDocumentsCollection()
    .find({
      category_tags: { $in: tags },
      is_published: true,
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs;
};

export const getChildDocuments = async (parentId: string, limit = 20, skip = 0) => {
  // Allow parentId to be either ObjectId or string id
  const parentFilter = ObjectId.isValid(parentId) ? new ObjectId(parentId) : parentId;

  const docs = await getDocumentsCollection()
    .find({
      parent_doc_id: parentFilter,
      is_published: true,
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs;
};

// Optimistic locking update - rejects if version mismatches
export const updateDocument = async (id: string, payload: DocumentUpdatePayload) => {
  // Accept ObjectId or string _id
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : (id as any);
  const filter: Record<string, unknown> = {
    _id: idFilter as any,
    version: payload.expected_version,
  };

  // Allow update if user is author or in editors list
  const accessFilter = {
    $or: [
      { author_id: payload.editor_id },
      { editors: payload.editor_id },
    ],
  };

  const allowedUpdates: Record<string, unknown> = {};
  if (payload.title !== undefined) allowedUpdates.title = payload.title;
  if (payload.body !== undefined) allowedUpdates.body = payload.body;
  if (payload.parent_doc_id !== undefined) {
    allowedUpdates.parent_doc_id = payload.parent_doc_id ? new ObjectId(payload.parent_doc_id) : null;
  }
  if (payload.category_tags !== undefined) allowedUpdates.category_tags = payload.category_tags;
  if (payload.is_published !== undefined) allowedUpdates.is_published = payload.is_published;

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error('No valid fields to update');
  }

  // Increment version and add editor
  const update = {
    $set: {
      ...allowedUpdates,
      updatedAt: new Date(),
    },
    $inc: { version: 1 },
    $addToSet: { editors: payload.editor_id },
  };

  const result = await getDocumentsCollection().findOneAndUpdate(
    { ...filter, ...accessFilter },
    update,
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const deleteDocument = async (id: string, userId: string) => {
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : (id as any);

  const result = await getDocumentsCollection().deleteOne({
    _id: idFilter as any,
    $or: [
      { author_id: userId },
      { editors: userId },
    ],
  });

  return result.deletedCount === 1;
};

export const addReaction = async (id: string, reactionType: 'like' | 'insightful') => {
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : (id as any);
  const updateField = `reactions.${reactionType}`;

  const result = await getDocumentsCollection().findOneAndUpdate(
    { _id: idFilter as any, is_published: true },
    {
      $inc: { [updateField]: 1 },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const incrementViewCount = async (id: string) => {
  const idFilter = ObjectId.isValid(id) ? new ObjectId(id) : (id as any);

  const result = await getDocumentsCollection().findOneAndUpdate(
    { _id: idFilter as any, is_published: true },
    { $inc: { view_count: 1 } },
    { returnDocument: 'after' }
  );

  return result ?? null;
};

export const searchDocuments = async (query: string, limit = 20) => {
  const docs = await getDocumentsCollection()
    .find(
      { $text: { $search: query }, is_published: true },
      { projection: { score: { $meta: 'textScore' } } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .toArray();

  return docs;
};

export default {
  createDocument,
  getDocumentById,
  getDocumentsByAuthor,
  getPublishedDocuments,
  getDocumentsByTags,
  getChildDocuments,
  updateDocument,
  deleteDocument,
  addReaction,
  incrementViewCount,
  searchDocuments,
};
