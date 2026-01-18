import { Response, NextFunction } from 'express';
import { MovementType } from '@prisma/client';
import { AuthenticatedRequest } from '../types/index.js';
import inventoryService from '../services/inventoryService.js';

export const inventoryController = {
  async getMovements(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { productId } = req.params;
      const { startDate, endDate, type, page, limit } = req.query;

      const result = await inventoryService.getMovements(productId, {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        type: type as MovementType | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
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

  async addEntry(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const userId = req.user!.userId;
      const { quantity, unitCost, reason } = req.body;

      const movement = await inventoryService.addEntry(
        productId,
        userId,
        quantity,
        unitCost,
        reason,
        req.clientIp
      );

      res.status(201).json({
        success: true,
        data: movement,
        message: `Entrada de ${quantity} unidades registrada correctamente`,
      });
    } catch (error) {
      next(error);
    }
  },

  async adjustStock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { productId } = req.params;
      const userId = req.user!.userId;
      const { newStock, reason } = req.body;

      const movement = await inventoryService.adjustStock(
        productId,
        userId,
        newStock,
        reason,
        req.clientIp
      );

      res.status(201).json({
        success: true,
        data: movement,
        message: 'Ajuste de inventario registrado correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async getLowStock(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const products = await inventoryService.getLowStockProducts();

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  },

  async getStockReport(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const report = await inventoryService.getStockReport();

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default inventoryController;
