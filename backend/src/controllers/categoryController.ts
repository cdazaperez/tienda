import { Response, NextFunction } from 'express';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import auditService from '../services/auditService.js';

export const categoryController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { active } = req.query;

      const where = active === 'true' ? { isActive: true } : {};

      const categories = await prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const category = await prisma.category.findUnique({
        where: { id },
        include: {
          products: {
            where: { isActive: true },
            select: {
              id: true,
              sku: true,
              name: true,
              salePrice: true,
              currentStock: true,
            },
          },
        },
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Categoría no encontrada',
        });
        return;
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body;
      const userId = req.user!.userId;

      const category = await prisma.category.create({
        data: { name, description },
      });

      await auditService.log({
        userId,
        action: 'CREATE',
        entity: 'category',
        entityId: category.id,
        newValues: { name, description },
        ipAddress: req.clientIp,
        description: `Categoría creada: ${name}`,
      });

      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;
      const userId = req.user!.userId;

      const current = await prisma.category.findUnique({ where: { id } });

      if (!current) {
        res.status(404).json({
          success: false,
          message: 'Categoría no encontrada',
        });
        return;
      }

      const category = await prisma.category.update({
        where: { id },
        data: { name, description, isActive },
      });

      await auditService.log({
        userId,
        action: 'UPDATE',
        entity: 'category',
        entityId: id,
        oldValues: current,
        newValues: { name, description, isActive },
        ipAddress: req.clientIp,
        description: `Categoría actualizada: ${name}`,
      });

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });

      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Categoría no encontrada',
        });
        return;
      }

      if (category._count.products > 0) {
        // Soft delete
        await prisma.category.update({
          where: { id },
          data: { isActive: false },
        });

        await auditService.log({
          userId,
          action: 'SOFT_DELETE',
          entity: 'category',
          entityId: id,
          oldValues: { isActive: true },
          newValues: { isActive: false },
          ipAddress: req.clientIp,
          description: `Categoría desactivada: ${category.name}`,
        });
      } else {
        // Hard delete
        await prisma.category.delete({ where: { id } });

        await auditService.log({
          userId,
          action: 'DELETE',
          entity: 'category',
          entityId: id,
          oldValues: category,
          ipAddress: req.clientIp,
          description: `Categoría eliminada: ${category.name}`,
        });
      }

      res.json({
        success: true,
        message: 'Categoría eliminada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },
};

export default categoryController;
