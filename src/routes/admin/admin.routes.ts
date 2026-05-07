import { Router } from 'express';
import { resetData, getDataStats } from '../../controller/admin/reset.controller';

const adminRouter = Router();

/**
 * @route POST /api/admin/reset
 * @desc Reset all application data (keeps auth users)
 * @access Admin only (should add auth middleware in production)
 */
adminRouter.post('/reset', resetData);

/**
 * @route GET /api/admin/stats
 * @desc Get data statistics (counts of all collections)
 * @access Admin only (should add auth middleware in production)
 */
adminRouter.get('/stats', getDataStats);

export default adminRouter;
