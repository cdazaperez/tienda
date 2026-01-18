import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import auditService from '../services/auditService.js';

export const productController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        categoryId,
        active,
        lowStock,
        sortBy = 'name',
        sortOrder = 'asc',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const where: Prisma.ProductWhereInput = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { sku: { contains: search as string, mode: 'insensitive' } },
          { barcode: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (categoryId) where.categoryId = categoryId as string;
      if (active === 'true') where.isActive = true;
      if (active === 'false') where.isActive = false;

      if (lowStock === 'true') {
        where.currentStock = {
          lte: prisma.product.fields.minStock,
        };
      }

      const orderBy: Prisma.ProductOrderByWithRelationInput = {
        [sortBy as string]: sortOrder as 'asc' | 'desc',
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limitNum,
          orderBy,
          include: {
            category: { select: { id: true, name: true } },
          },
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        success: true,
        data: products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { q } = req.query;

      if (!q || (q as string).length < 2) {
        res.json({ success: true, data: [] });
        return;
      }

      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q as string, mode: 'insensitive' } },
            { sku: { contains: q as string, mode: 'insensitive' } },
            { barcode: { equals: q as string } },
          ],
        },
        take: 20,
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const product = await prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          inventoryMovements: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async getByBarcode(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { barcode } = req.params;

      const product = await prisma.product.findUnique({
        where: { barcode },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const {
        sku,
        barcode,
        name,
        description,
        categoryId,
        brand,
        size,
        color,
        salePrice,
        costPrice,
        taxRate,
        unit,
        imageUrl,
        minStock,
        currentStock,
      } = req.body;

      const product = await prisma.product.create({
        data: {
          sku,
          barcode,
          name,
          description,
          categoryId,
          brand,
          size,
          color,
          salePrice,
          costPrice,
          taxRate: taxRate || 0,
          unit: unit || 'unidad',
          imageUrl,
          minStock: minStock || 0,
          currentStock: currentStock || 0,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      await auditService.log({
        userId,
        action: 'CREATE',
        entity: 'product',
        entityId: product.id,
        newValues: { sku, name, salePrice, categoryId },
        ipAddress: req.clientIp,
        description: `Producto creado: ${name} (${sku})`,
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const current = await prisma.product.findUnique({ where: { id } });

      if (!current) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
        return;
      }

      const {
        sku,
        barcode,
        name,
        description,
        categoryId,
        brand,
        size,
        color,
        salePrice,
        costPrice,
        taxRate,
        unit,
        imageUrl,
        minStock,
        isActive,
      } = req.body;

      // Verificar si hay cambio de precio
      const priceChanged =
        salePrice !== undefined &&
        current.salePrice.toString() !== salePrice.toString();

      const product = await prisma.product.update({
        where: { id },
        data: {
          sku,
          barcode,
          name,
          description,
          categoryId,
          brand,
          size,
          color,
          salePrice,
          costPrice,
          taxRate,
          unit,
          imageUrl,
          minStock,
          isActive,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      // Registrar cambio de precio separadamente
      if (priceChanged) {
        await auditService.log({
          userId,
          action: 'PRICE_CHANGE',
          entity: 'product',
          entityId: id,
          oldValues: { salePrice: current.salePrice.toString() },
          newValues: { salePrice: salePrice.toString() },
          ipAddress: req.clientIp,
          description: `Cambio de precio: ${current.salePrice} → ${salePrice}`,
        });
      }

      await auditService.log({
        userId,
        action: 'UPDATE',
        entity: 'product',
        entityId: id,
        oldValues: current,
        newValues: req.body,
        ipAddress: req.clientIp,
        description: `Producto actualizado: ${name || current.name}`,
      });

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;

      const product = await prisma.product.findUnique({ where: { id } });

      if (!product) {
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado',
        });
        return;
      }

      // Siempre soft delete para productos
      await prisma.product.update({
        where: { id },
        data: { isActive: false },
      });

      await auditService.log({
        userId,
        action: 'SOFT_DELETE',
        entity: 'product',
        entityId: id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: req.clientIp,
        description: `Producto desactivado: ${product.name}`,
      });

      res.json({
        success: true,
        message: 'Producto desactivado correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async getLowStock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const products = await prisma.$queryRaw`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = true AND p.current_stock <= p.min_stock
        ORDER BY p.current_stock ASC
      `;

      res.json({
        success: true,
        data: products,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default productController;
