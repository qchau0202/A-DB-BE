import { Router } from 'express';
import { handleAuthWebhook, syncAllUsers } from '../../controller/users/user.webhook';
import { getAllMongoUsers, getMongoUserById, getMongoUserBySupabaseId } from '../../controller/users/user.controller';

const userRouter = Router();

/**
 * @route POST /api/users/webhook
 * @desc Webhook for Supabase Auth events (user created/updated/deleted)
 * @access Public (should be protected by webhook secret in production)
 */
userRouter.post('/webhook', handleAuthWebhook);

/**
 * @route POST /api/users/sync
 * @desc Manually sync all users from Supabase to MongoDB
 * @access Admin only
 */
userRouter.post('/sync', syncAllUsers);

/**
 * @route GET /api/users
 * @desc Get all MongoDB users
 * @access Public
 */
userRouter.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = parseInt(req.query.skip as string) || 0;

    const { users, total } = await getAllMongoUsers(limit, skip);
    res.status(200).json({ users, total, limit, skip });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get MongoDB user by ID
 * @access Public
 */
userRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await getMongoUserById(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/supabase/:supabaseId
 * @desc Get MongoDB user by Supabase ID
 * @access Public
 */
userRouter.get('/supabase/:supabaseId', async (req, res, next) => {
  try {
    const { supabaseId } = req.params;
    const user = await getMongoUserBySupabaseId(supabaseId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
});

export default userRouter;
