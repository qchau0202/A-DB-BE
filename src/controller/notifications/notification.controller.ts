import { ObjectId } from 'mongodb';
import { getMongoDb } from '../../config/mongodb';

export type NotificationType = 'follow' | 'post_like' | 'post_comment' | 'quickie_view' | 'quickie_react' | 'document_like' | 'mention';
export type TargetType = 'post' | 'comment' | 'quickie' | 'document';

export interface NotificationPayload {
  recipient_id: string;
  sender_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  target_id?: string;
  target_type?: TargetType;
}

export interface Notification {
  _id: ObjectId;
  recipient_id: string;
  sender_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  target_id: string | null;
  target_type: TargetType | null;
  is_read: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

const getNotificationsCollection = () => getMongoDb().collection<Notification>('notifications');

// Create notification
export const createNotification = async (payload: NotificationPayload): Promise<Notification> => {
  const now = new Date();
  const notification: Omit<Notification, '_id'> = {
    recipient_id: payload.recipient_id,
    sender_id: payload.sender_id,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    target_id: payload.target_id ?? null,
    target_type: payload.target_type ?? null,
    is_read: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await getNotificationsCollection().insertOne(notification as Notification);
  return { _id: result.insertedId, ...notification };
};

// Get notifications for a recipient
export const getNotificationsByRecipient = async (
  recipientId: string,
  options: { unreadOnly?: boolean; limit?: number; skip?: number } = {}
): Promise<Notification[]> => {
  const { unreadOnly = false, limit = 20, skip = 0 } = options;

  const query: Record<string, unknown> = { recipient_id: recipientId };
  if (unreadOnly) {
    query.is_read = false;
  }

  const notifications = await getNotificationsCollection()
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return notifications;
};

// Get unread count
export const getUnreadCount = async (recipientId: string): Promise<number> => {
  const count = await getNotificationsCollection().countDocuments({
    recipient_id: recipientId,
    is_read: false,
  });
  return count;
};

// Mark notification as read
export const markAsRead = async (notificationId: string, recipientId: string): Promise<Notification | null> => {
  if (!ObjectId.isValid(notificationId)) {
    throw new Error('Invalid notification ID');
  }

  const result = await getNotificationsCollection().findOneAndUpdate(
    { _id: new ObjectId(notificationId), recipient_id: recipientId },
    { $set: { is_read: true, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  return result;
};

// Mark all notifications as read
export const markAllAsRead = async (recipientId: string): Promise<number> => {
  const result = await getNotificationsCollection().updateMany(
    { recipient_id: recipientId, is_read: false },
    { $set: { is_read: true, updatedAt: new Date() } }
  );

  return result.modifiedCount;
};

// Delete notification
export const deleteNotification = async (notificationId: string, recipientId: string): Promise<boolean> => {
  if (!ObjectId.isValid(notificationId)) {
    throw new Error('Invalid notification ID');
  }

  const result = await getNotificationsCollection().deleteOne({
    _id: new ObjectId(notificationId),
    recipient_id: recipientId,
  });

  return result.deletedCount > 0;
};

// Get notification by ID
export const getNotificationById = async (notificationId: string): Promise<Notification | null> => {
  if (!ObjectId.isValid(notificationId)) {
    throw new Error('Invalid notification ID');
  }

  const notification = await getNotificationsCollection().findOne({
    _id: new ObjectId(notificationId),
  });

  return notification;
};

// Helper to create follow notification
export const createFollowNotification = async (followerId: string, followingId: string, followerName: string): Promise<Notification> => {
  return createNotification({
    recipient_id: followingId,
    sender_id: followerId,
    type: 'follow',
    title: `${followerName} started following you`,
  });
};

// Helper to create post like notification
export const createPostLikeNotification = async (likerId: string, authorId: string, likerName: string, postId: string): Promise<Notification> => {
  return createNotification({
    recipient_id: authorId,
    sender_id: likerId,
    type: 'post_like',
    title: `${likerName} liked your post`,
    target_id: postId,
    target_type: 'post',
  });
};

// Helper to create post comment notification
export const createPostCommentNotification = async (commenterId: string, authorId: string, commenterName: string, postId: string, commentPreview: string): Promise<Notification> => {
  return createNotification({
    recipient_id: authorId,
    sender_id: commenterId,
    type: 'post_comment',
    title: `${commenterName} commented on your post`,
    body: commentPreview.slice(0, 100),
    target_id: postId,
    target_type: 'post',
  });
};

// Helper to create quickie view notification
export const createQuickieViewNotification = async (viewerId: string, authorId: string, viewerName: string, quickieId: string): Promise<Notification> => {
  return createNotification({
    recipient_id: authorId,
    sender_id: viewerId,
    type: 'quickie_view',
    title: `${viewerName} viewed your quickie`,
    target_id: quickieId,
    target_type: 'quickie',
  });
};

// Helper to create quickie reaction notification
export const createQuickieReactionNotification = async (reactorId: string, authorId: string, reactorName: string, quickieId: string): Promise<Notification> => {
  return createNotification({
    recipient_id: authorId,
    sender_id: reactorId,
    type: 'quickie_react',
    title: `${reactorName} reacted to your quickie`,
    target_id: quickieId,
    target_type: 'quickie',
  });
};

// Helper to create document like notification
export const createDocumentLikeNotification = async (likerId: string, authorId: string, likerName: string, documentId: string): Promise<Notification> => {
  return createNotification({
    recipient_id: authorId,
    sender_id: likerId,
    type: 'document_like',
    title: `${likerName} liked your document`,
    target_id: documentId,
    target_type: 'document',
  });
};

// Helper to create mention notification
export const createMentionNotification = async (mentionerId: string, mentionedId: string, mentionerName: string, targetId: string, targetType: TargetType, context: string): Promise<Notification> => {
  return createNotification({
    recipient_id: mentionedId,
    sender_id: mentionerId,
    type: 'mention',
    title: `${mentionerName} mentioned you in a ${targetType}`,
    body: context.slice(0, 100),
    target_id: targetId,
    target_type: targetType,
  });
};
