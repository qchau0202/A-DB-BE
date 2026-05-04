import { Router, Request, Response, NextFunction } from 'express';
import {
  createNotification,
  getNotificationsByRecipient,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationById,
} from '../../controller/notifications/notification.controller';
import { callSupabaseAuth } from '../../controller/auth/auth.controller';

export const notificationRouter = Router();

console.log('[Routes] Notifications routes loading...');

const getAuthUserId = async (req: Request): Promise<string | null> => {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

  try {
    const user = await callSupabaseAuth<Record<string, unknown>>('/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    return (user && typeof user === 'object' && 'id' in user) ? String((user as any).id) : null;
  } catch {
    return null;
  }
};

// Create notification
notificationRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const senderId = await getAuthUserId(req);
    if (!senderId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const payload = req.body as {
      recipient_id: string;
      type: 'follow' | 'post_like' | 'post_comment' | 'quickie_view' | 'quickie_react' | 'document_like' | 'mention';
      title: string;
      body?: string;
      target_id?: string;
      target_type?: 'post' | 'comment' | 'quickie' | 'document';
    };

    if (!payload.recipient_id || !payload.type || !payload.title) {
      return res.status(400).json({ message: 'recipient_id, type, and title are required' });
    }

    const notification = await createNotification({
      ...payload,
      sender_id: senderId,
    });

    return res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
});

// Get notifications for current user
notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = parseInt(req.query.skip as string) || 0;

    const notifications = await getNotificationsByRecipient(userId, { unreadOnly, limit, skip });
    const unreadCount = await getUnreadCount(userId);

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// Get unread count only
notificationRouter.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const count = await getUnreadCount(userId);
    return res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
});

// Get notification by ID
notificationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const notification = await getNotificationById(req.params.id as string);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Only recipient or sender can view
    if (notification.recipient_id !== userId && notification.sender_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.status(200).json({ notification });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
notificationRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const notification = await markAsRead(req.params.id as string, userId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.status(200).json({ notification });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
notificationRouter.patch('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const modifiedCount = await markAllAsRead(userId);
    return res.status(200).json({ modifiedCount });
  } catch (error) {
    next(error);
  }
});

// Delete notification
notificationRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const deleted = await deleteNotification(req.params.id as string, userId);
    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});
