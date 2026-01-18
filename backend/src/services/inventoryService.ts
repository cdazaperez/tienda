import { MovementType, Prisma } from '@prisma/client';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import auditService from './auditService.js';
import Decimal from 'decimal.js';

interface InventoryMovementInput {
  productId: string;
  userId: string;
  type: MovementType;
  quantity: number;
  unitCost?: number;
  reason?: string;
  referenceId?: string;
  referenceType?: string;
}

export const inventoryService = {
  async createMovement(
    input: InventoryMovementInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;

    const product = await client.product.findUnique({
      where: { id: input.productId },
    });

    if (!product) {
      throw new AppError('Producto no encontrado', 404);
    }

    const previousStock = product.currentStock;

    // Calcular nuevo stock basado en tipo de movimiento
    let quantityChange: number;
    switch (input.type) {
      case MovementType.ENTRY:
      case MovementType.RETURN:
      case MovementType.VOID:
        quantityChange = Math.abs(input.quantity);
        break;
      case MovementType.SALE:
        quantityChange = -Math.abs(input.quantity);
        break;
      case MovementType.ADJUSTMENT:
        quantityChange = input.quantity; // Puede ser positivo o negativo
        break;
      default:
        throw new AppError('Tipo de movimiento inválido', 400);
    }

    const newStock = previousStock + quantityChange;

    // Verificar stock negativo
    if (newStock < 0) {
      const storeConfig = await client.storeConfig.findUnique({
        where: { id: 'store_config' },
      });

      if (!storeConfig?.allowNegativeStock) {
        throw new AppError(
          `Stock insuficiente para ${product.name}. Disponible: ${previousStock}`,
          400
        );
      }
    }

    // Crear movimiento
    const movement = await client.inventoryMovement.create({
      data: {
        productId: input.productId,
        userId: input.userId,
        type: input.type,
        quantity: quantityChange,
        previousStock,
        newStock,
        unitCost: input.unitCost ? new Decimal(input.unitCost) : null,
        reason: input.reason,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
      },
    });

    // Actualizar stock del producto
    await client.product.update({
      where: { id: input.productId },
      data: { currentStock: newStock },
    });

    return movement;
  },

  async adjustStock(
    productId: string,
    userId: string,
    newStockValue: number,
    reason: string,
    ipAddress?: string
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new AppError('Producto no encontrado', 404);
    }

    if (!reason || reason.trim() === '') {
      throw new AppError('El motivo del ajuste es obligatorio', 400);
    }

    const quantityChange = newStockValue - product.currentStock;

    const movement = await this.createMovement({
      productId,
      userId,
      type: MovementType.ADJUSTMENT,
      quantity: quantityChange,
      reason,
    });

    await auditService.log({
      userId,
      action: 'INVENTORY_ADJUSTMENT',
      entity: 'product',
      entityId: productId,
      oldValues: { stock: product.currentStock },
      newValues: { stock: newStockValue, reason },
      ipAddress,
      description: `Ajuste de inventario: ${product.currentStock} → ${newStockValue}`,
    });

    return movement;
  },

  async addEntry(
    productId: string,
    userId: string,
    quantity: number,
    unitCost?: number,
    reason?: string,
    ipAddress?: string
  ) {
    if (quantity <= 0) {
      throw new AppError('La cantidad debe ser mayor a 0', 400);
    }

    const movement = await this.createMovement({
      productId,
      userId,
      type: MovementType.ENTRY,
      quantity,
      unitCost,
      reason: reason || 'Entrada de mercancía',
    });

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    await auditService.log({
      userId,
      action: 'INVENTORY_ENTRY',
      entity: 'product',
      entityId: productId,
      newValues: { quantity, unitCost },
      ipAddress,
      description: `Entrada de ${quantity} unidades de ${product?.name}`,
    });

    return movement;
  },

  async getMovements(
    productId: string,
    params?: {
      startDate?: Date;
      endDate?: Date;
      type?: MovementType;
      page?: number;
      limit?: number;
    }
  ) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = { productId };

    if (params?.type) where.type = params.type;
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getLowStockProducts() {
    return prisma.product.findMany({
      where: {
        isActive: true,
        currentStock: {
          lte: prisma.product.fields.minStock,
        },
      },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { currentStock: 'asc' },
    });
  },

  async getStockReport() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const lowStockCount = products.filter(
      (p) => p.currentStock <= p.minStock
    ).length;

    const totalValue = products.reduce((sum, p) => {
      const cost = p.costPrice ? new Decimal(p.costPrice.toString()) : new Decimal(0);
      return sum.plus(cost.times(p.currentStock));
    }, new Decimal(0));

    return {
      products,
      summary: {
        totalProducts: products.length,
        lowStockCount,
        totalInventoryValue: totalValue.toFixed(2),
      },
    };
  },
};

export default inventoryService;
