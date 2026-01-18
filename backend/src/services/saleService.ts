import { MovementType, PaymentMethod, SaleStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import prisma from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { CreateSaleInput, ReportFilters } from '../types/index.js';
import inventoryService from './inventoryService.js';
import sequenceService, { SEQUENCES } from './sequenceService.js';
import auditService from './auditService.js';

export const saleService = {
  async createSale(input: CreateSaleInput, userId: string, ipAddress?: string) {
    if (!input.items || input.items.length === 0) {
      throw new AppError('La venta debe tener al menos un producto', 400);
    }

    // Obtener productos
    const productIds = input.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new AppError('Uno o más productos no existen', 404);
    }

    // Verificar stock y productos activos
    for (const item of input.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      if (!product.isActive) {
        throw new AppError(`El producto ${product.name} está inactivo`, 400);
      }

      if (product.currentStock < item.quantity) {
        const storeConfig = await prisma.storeConfig.findUnique({
          where: { id: 'store_config' },
        });

        if (!storeConfig?.allowNegativeStock) {
          throw new AppError(
            `Stock insuficiente para ${product.name}. Disponible: ${product.currentStock}`,
            400
          );
        }
      }
    }

    // Ejecutar en transacción
    const sale = await prisma.$transaction(async (tx) => {
      // Obtener número de recibo
      const receiptNumber = await sequenceService.getNextValue(
        SEQUENCES.RECEIPT
      );

      // Calcular totales
      let subtotal = new Decimal(0);
      let totalTax = new Decimal(0);

      const saleItems: Prisma.SaleItemCreateManyInput[] = [];

      for (const item of input.items) {
        const product = products.find((p) => p.id === item.productId)!;
        const quantity = item.quantity;
        const unitPrice = new Decimal(product.salePrice.toString());
        const discountPercent = new Decimal(item.discountPercent || 0);
        const taxRate = new Decimal(product.taxRate.toString());

        // Calcular línea
        const lineSubtotal = unitPrice.times(quantity);
        const lineDiscount = lineSubtotal.times(discountPercent).dividedBy(100);
        const lineSubtotalAfterDiscount = lineSubtotal.minus(lineDiscount);
        const lineTax = lineSubtotalAfterDiscount.times(taxRate);
        const lineTotal = lineSubtotalAfterDiscount.plus(lineTax);

        subtotal = subtotal.plus(lineSubtotalAfterDiscount);
        totalTax = totalTax.plus(lineTax);

        saleItems.push({
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          quantity,
          unitPrice: unitPrice.toDecimalPlaces(2),
          discountPercent: discountPercent.toDecimalPlaces(2),
          discountAmount: lineDiscount.toDecimalPlaces(2),
          taxRate: taxRate.toDecimalPlaces(4),
          taxAmount: lineTax.toDecimalPlaces(2),
          subtotal: lineSubtotalAfterDiscount.toDecimalPlaces(2),
          total: lineTotal.toDecimalPlaces(2),
        });
      }

      // Aplicar descuento global si existe
      let globalDiscount = new Decimal(0);
      if (input.globalDiscountPercent && input.globalDiscountPercent > 0) {
        globalDiscount = subtotal
          .times(input.globalDiscountPercent)
          .dividedBy(100);
        subtotal = subtotal.minus(globalDiscount);
        // Recalcular impuestos sobre el nuevo subtotal
        totalTax = new Decimal(0);
        for (const item of saleItems) {
          const taxRate = new Decimal(item.taxRate.toString());
          const itemSubtotal = new Decimal(item.subtotal.toString());
          const proportionalDiscount = globalDiscount
            .times(itemSubtotal)
            .dividedBy(subtotal.plus(globalDiscount));
          const adjustedSubtotal = itemSubtotal.minus(proportionalDiscount);
          totalTax = totalTax.plus(adjustedSubtotal.times(taxRate));
        }
      }

      const total = subtotal.plus(totalTax);
      const amountPaid = new Decimal(input.amountPaid);
      const changeAmount = amountPaid.minus(total).greaterThan(0)
        ? amountPaid.minus(total)
        : new Decimal(0);

      if (amountPaid.lessThan(total)) {
        throw new AppError(
          `Monto pagado insuficiente. Total: ${total.toFixed(2)}`,
          400
        );
      }

      // Crear venta
      const newSale = await tx.sale.create({
        data: {
          receiptNumber,
          userId,
          subtotal: subtotal.toDecimalPlaces(2),
          discountAmount: globalDiscount.toDecimalPlaces(2),
          taxAmount: totalTax.toDecimalPlaces(2),
          total: total.toDecimalPlaces(2),
          paymentMethod: input.paymentMethod as PaymentMethod,
          amountPaid: amountPaid.toDecimalPlaces(2),
          changeAmount: changeAmount.toDecimalPlaces(2),
          notes: input.notes,
        },
      });

      // Crear items de venta
      for (const item of saleItems) {
        await tx.saleItem.create({
          data: {
            ...item,
            saleId: newSale.id,
          },
        });
      }

      // Descontar inventario
      for (const item of input.items) {
        await inventoryService.createMovement(
          {
            productId: item.productId,
            userId,
            type: MovementType.SALE,
            quantity: item.quantity,
            referenceId: newSale.id,
            referenceType: 'sale',
          },
          tx
        );
      }

      return newSale;
    });

    // Obtener venta completa
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await auditService.log({
      userId,
      action: 'SALE_CREATE',
      entity: 'sale',
      entityId: sale.id,
      newValues: {
        receiptNumber: sale.receiptNumber,
        total: sale.total.toString(),
        itemCount: input.items.length,
      },
      ipAddress,
      description: `Venta #${sale.receiptNumber} por $${sale.total}`,
    });

    return completeSale;
  },

  async voidSale(
    saleId: string,
    reason: string,
    userId: string,
    ipAddress?: string
  ) {
    if (!reason || reason.trim() === '') {
      throw new AppError('El motivo de anulación es obligatorio', 400);
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new AppError('Venta no encontrada', 404);
    }

    if (sale.status === SaleStatus.VOIDED) {
      throw new AppError('La venta ya está anulada', 400);
    }

    await prisma.$transaction(async (tx) => {
      // Anular venta
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: SaleStatus.VOIDED,
          voidReason: reason,
          voidedAt: new Date(),
          voidedBy: userId,
        },
      });

      // Restaurar inventario
      for (const item of sale.items) {
        await inventoryService.createMovement(
          {
            productId: item.productId,
            userId,
            type: MovementType.VOID,
            quantity: item.quantity,
            referenceId: saleId,
            referenceType: 'void',
            reason: `Anulación de venta #${sale.receiptNumber}: ${reason}`,
          },
          tx
        );
      }
    });

    await auditService.log({
      userId,
      action: 'SALE_VOID',
      entity: 'sale',
      entityId: saleId,
      oldValues: { status: SaleStatus.COMPLETED },
      newValues: { status: SaleStatus.VOIDED, reason },
      ipAddress,
      description: `Anulación de venta #${sale.receiptNumber}`,
    });

    return prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
  },

  async createReturn(
    saleId: string,
    items: Array<{ productId: string; quantity: number }>,
    reason: string,
    userId: string,
    ipAddress?: string
  ) {
    if (!reason || reason.trim() === '') {
      throw new AppError('El motivo de devolución es obligatorio', 400);
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });

    if (!sale) {
      throw new AppError('Venta no encontrada', 404);
    }

    if (sale.status === SaleStatus.VOIDED) {
      throw new AppError('No se puede devolver una venta anulada', 400);
    }

    // Validar items
    for (const returnItem of items) {
      const saleItem = sale.items.find(
        (si) => si.productId === returnItem.productId
      );
      if (!saleItem) {
        throw new AppError(
          `El producto ${returnItem.productId} no está en esta venta`,
          400
        );
      }

      const availableQty = saleItem.quantity - saleItem.returnedQty;
      if (returnItem.quantity > availableQty) {
        throw new AppError(
          `Cantidad a devolver excede lo disponible (${availableQty})`,
          400
        );
      }
    }

    const returnRecord = await prisma.$transaction(async (tx) => {
      const returnNumber = await sequenceService.getNextValue(SEQUENCES.RETURN);

      let totalRefund = new Decimal(0);
      const returnItems: Prisma.ReturnItemCreateManyInput[] = [];

      for (const returnItem of items) {
        const saleItem = sale.items.find(
          (si) => si.productId === returnItem.productId
        )!;

        const unitPrice = new Decimal(saleItem.unitPrice.toString());
        const refundAmount = unitPrice.times(returnItem.quantity);
        totalRefund = totalRefund.plus(refundAmount);

        returnItems.push({
          productId: returnItem.productId,
          quantity: returnItem.quantity,
          unitPrice: unitPrice.toDecimalPlaces(2),
          refundAmount: refundAmount.toDecimalPlaces(2),
        });

        // Actualizar cantidad devuelta en el item de venta
        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: { returnedQty: saleItem.returnedQty + returnItem.quantity },
        });

        // Restaurar inventario
        await inventoryService.createMovement(
          {
            productId: returnItem.productId,
            userId,
            type: MovementType.RETURN,
            quantity: returnItem.quantity,
            referenceId: saleId,
            referenceType: 'return',
            reason: `Devolución de venta #${sale.receiptNumber}: ${reason}`,
          },
          tx
        );
      }

      // Crear registro de devolución
      const newReturn = await tx.return.create({
        data: {
          returnNumber,
          saleId,
          userId,
          reason,
          totalRefund: totalRefund.toDecimalPlaces(2),
        },
      });

      // Crear items de devolución
      for (const item of returnItems) {
        await tx.returnItem.create({
          data: {
            ...item,
            returnId: newReturn.id,
          },
        });
      }

      // Actualizar estado de venta si aplica
      const allItemsReturned = sale.items.every((si) => {
        const returnItem = items.find((ri) => ri.productId === si.productId);
        const newReturnedQty =
          si.returnedQty + (returnItem?.quantity || 0);
        return newReturnedQty >= si.quantity;
      });

      if (allItemsReturned) {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: SaleStatus.VOIDED },
        });
      } else {
        await tx.sale.update({
          where: { id: saleId },
          data: { status: SaleStatus.PARTIAL_RETURN },
        });
      }

      return newReturn;
    });

    await auditService.log({
      userId,
      action: 'SALE_RETURN',
      entity: 'sale',
      entityId: saleId,
      newValues: {
        returnId: returnRecord.id,
        returnNumber: returnRecord.returnNumber,
        totalRefund: returnRecord.totalRefund.toString(),
        items,
        reason,
      },
      ipAddress,
      description: `Devolución #${returnRecord.returnNumber} de venta #${sale.receiptNumber}`,
    });

    return prisma.return.findUnique({
      where: { id: returnRecord.id },
      include: { items: true },
    });
  },

  async getSale(id: string) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        returns: {
          include: { items: true },
        },
      },
    });
  },

  async getSaleByReceiptNumber(receiptNumber: number) {
    return prisma.sale.findUnique({
      where: { receiptNumber },
      include: {
        items: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        returns: {
          include: { items: true },
        },
      },
    });
  },

  async getSales(params: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: SaleStatus;
    startDate?: Date;
    endDate?: Date;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleWhereInput = {};

    if (params.userId) where.userId = params.userId;
    if (params.status) where.status = params.status;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.sale.count({ where }),
    ]);

    return {
      data: sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getSalesReport(filters: ReportFilters) {
    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
    };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }
    if (filters.userId) where.userId = filters.userId;
    if (filters.paymentMethod) {
      where.paymentMethod = filters.paymentMethod as PaymentMethod;
    }

    // Obtener ventas
    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calcular métricas
    const totalSales = sales.length;
    const totalRevenue = sales.reduce(
      (sum, s) => sum.plus(new Decimal(s.total.toString())),
      new Decimal(0)
    );
    const avgTicket =
      totalSales > 0 ? totalRevenue.dividedBy(totalSales) : new Decimal(0);

    // Top productos
    const productSales: Record<
      string,
      { name: string; quantity: number; revenue: Decimal }
    > = {};
    // Top categorías
    const categorySales: Record<
      string,
      { name: string; quantity: number; revenue: Decimal }
    > = {};
    // Top vendedores
    const sellerSales: Record<
      string,
      { name: string; sales: number; revenue: Decimal }
    > = {};

    for (const sale of sales) {
      // Vendedores
      const sellerKey = sale.userId;
      if (!sellerSales[sellerKey]) {
        sellerSales[sellerKey] = {
          name: `${sale.user.firstName} ${sale.user.lastName}`,
          sales: 0,
          revenue: new Decimal(0),
        };
      }
      sellerSales[sellerKey].sales++;
      sellerSales[sellerKey].revenue = sellerSales[sellerKey].revenue.plus(
        new Decimal(sale.total.toString())
      );

      for (const item of sale.items) {
        // Productos
        const productKey = item.productId;
        if (!productSales[productKey]) {
          productSales[productKey] = {
            name: item.productName,
            quantity: 0,
            revenue: new Decimal(0),
          };
        }
        productSales[productKey].quantity += item.quantity;
        productSales[productKey].revenue = productSales[productKey].revenue.plus(
          new Decimal(item.total.toString())
        );

        // Categorías
        if (item.product?.category) {
          const categoryKey = item.product.category.id;
          if (!categorySales[categoryKey]) {
            categorySales[categoryKey] = {
              name: item.product.category.name,
              quantity: 0,
              revenue: new Decimal(0),
            };
          }
          categorySales[categoryKey].quantity += item.quantity;
          categorySales[categoryKey].revenue = categorySales[
            categoryKey
          ].revenue.plus(new Decimal(item.total.toString()));
        }
      }
    }

    // Convertir a arrays y ordenar
    const topProducts = Object.entries(productSales)
      .map(([id, data]) => ({
        id,
        ...data,
        revenue: data.revenue.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
      .slice(0, 10);

    const topCategories = Object.entries(categorySales)
      .map(([id, data]) => ({
        id,
        ...data,
        revenue: data.revenue.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
      .slice(0, 10);

    const topSellers = Object.entries(sellerSales)
      .map(([id, data]) => ({
        id,
        ...data,
        revenue: data.revenue.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
      .slice(0, 10);

    return {
      summary: {
        totalSales,
        totalRevenue: totalRevenue.toFixed(2),
        avgTicket: avgTicket.toFixed(2),
      },
      topProducts,
      topCategories,
      topSellers,
      sales: sales.map((s) => ({
        id: s.id,
        receiptNumber: s.receiptNumber,
        total: s.total.toString(),
        createdAt: s.createdAt,
        seller: `${s.user.firstName} ${s.user.lastName}`,
        paymentMethod: s.paymentMethod,
        itemCount: s.items.length,
      })),
    };
  },
};

export default saleService;
