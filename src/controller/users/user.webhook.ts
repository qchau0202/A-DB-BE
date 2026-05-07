import { Request, Response, NextFunction } from 'express';
import { syncUserToMongo, deleteMongoUser } from './user.controller';

/**
 * Webhook handler for Supabase Auth events
 * This allows Supabase to notify our backend when users are created/updated/deleted
 * via OAuth, Dashboard, or other external methods
 */
export const handleAuthWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, record, old_record } = req.body;

    console.log(`[Auth Webhook] Received event: ${type}`);

    switch (type) {
      case 'INSERT':
      case 'UPDATE': {
        // New user created or existing user updated in Supabase
        const userData = {
          supabase_id: record.id,
          email: record.email,
          username: record.user_metadata?.username || record.email?.split('@')[0] || 'user',
          name: record.user_metadata?.name || record.user_metadata?.display_name || record.email?.split('@')[0] || 'User',
          bio: record.user_metadata?.bio,
          avatar_url: record.user_metadata?.avatar_url || record.user_metadata?.avatar,
        };

        const mongoUser = await syncUserToMongo(userData);
        console.log(`[Auth Webhook] User synced to MongoDB: ${userData.email}`);

        return res.status(200).json({
          success: true,
          message: 'User synced to MongoDB',
          user: mongoUser,
        });
      }

      case 'DELETE': {
        // User deleted from Supabase
        const deletedUserId = old_record?.id;
        if (deletedUserId) {
          const deleted = await deleteMongoUser(deletedUserId);
          console.log(`[Auth Webhook] User deleted from MongoDB: ${deletedUserId}`);

          return res.status(200).json({
            success: true,
            message: 'User deleted from MongoDB',
            deleted,
          });
        }
        break;
      }

      default:
        console.log(`[Auth Webhook] Unhandled event type: ${type}`);
        return res.status(400).json({
          success: false,
          message: `Unhandled event type: ${type}`,
        });
    }
  } catch (error) {
    console.error('[Auth Webhook] Error:', error);
    next(error);
  }
};

/**
 * Manual sync endpoint - sync all users from Supabase to MongoDB
 * Useful for initial migration or fixing sync issues
 */
export const syncAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supabaseAdmin } = await import('../../config/supabase');

    if (!supabaseAdmin) {
      return res.status(500).json({
        success: false,
        message: 'Supabase admin client not configured',
      });
    }

    // Fetch all users from Supabase
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      throw new Error(`Failed to fetch users from Supabase: ${error.message}`);
    }

    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Sync each user to MongoDB
    for (const user of users || []) {
      try {
        await syncUserToMongo({
          supabase_id: user.id,
          email: user.email || '',
          username: user.user_metadata?.username || user.email?.split('@')[0],
          name: user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split('@')[0],
          bio: user.user_metadata?.bio,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.avatar,
        });
        results.synced++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Failed to sync ${user.email}: ${err}`);
        console.error(`Failed to sync user ${user.id}:`, err);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Synced ${results.synced} users, ${results.failed} failed`,
      results,
    });
  } catch (error) {
    console.error('[User Sync] Error:', error);
    next(error);
  }
};

export default {
  handleAuthWebhook,
  syncAllUsers,
};
