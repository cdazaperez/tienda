import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import auditService from '../services/auditService.js';

export const auditController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, entity, userId, action, startDate, endDate } =
        req.query;

      const result = await auditService.getAll({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        entity: entity as string | undefined,
        userId: userId as string | undefined,
        action: action as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  },

  async getByEntity(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { entity, entityId } = req.params;

      const logs = await auditService.getByEntity(entity, entityId);

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default auditController;
