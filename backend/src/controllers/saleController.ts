import { Response, NextFunction } from 'express';
import { SaleStatus } from '@prisma/client';
import { AuthenticatedRequest, CreateSaleInput } from '../types/index.js';
import saleService from '../services/saleService.js';
import receiptService from '../services/receiptService.js';

export const saleController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const saleInput: CreateSaleInput = req.body;

      const sale = await saleService.createSale(
        saleInput,
        userId,
        req.clientIp
      );

      res.status(201).json({
        success: true,
        data: sale,
        message: `Venta #${sale?.receiptNumber} creada exitosamente`,
      });
    } catch (error) {
      next(error);
    }
  },

  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, userId, status, startDate, endDate } = req.query;

      // Vendedores solo pueden ver sus propias ventas
      const filterUserId =
        req.user!.role === 'SELLER' ? req.user!.userId : (userId as string);

      const result = await saleService.getSales({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        userId: filterUserId,
        status: status as SaleStatus | undefined,
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

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const sale = await saleService.getSale(id);

      if (!sale) {
        res.status(404).json({
          success: false,
          message: 'Venta no encontrada',
        });
        return;
      }

      // Vendedores solo pueden ver sus propias ventas
      if (req.user!.role === 'SELLER' && sale.userId !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'No tiene permiso para ver esta venta',
        });
        return;
      }

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },

  async getByReceiptNumber(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { receiptNumber } = req.params;

      const sale = await saleService.getSaleByReceiptNumber(
        parseInt(receiptNumber, 10)
      );

      if (!sale) {
        res.status(404).json({
          success: false,
          message: 'Venta no encontrada',
        });
        return;
      }

      res.json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  },

  async void(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { reason } = req.body;

      const sale = await saleService.voidSale(
        id,
        reason,
        userId,
        req.clientIp
      );

      res.json({
        success: true,
        data: sale,
        message: 'Venta anulada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async createReturn(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { items, reason } = req.body;

      const returnRecord = await saleService.createReturn(
        id,
        items,
        reason,
        userId,
        req.clientIp
      );

      res.status(201).json({
        success: true,
        data: returnRecord,
        message: `Devolución #${returnRecord?.returnNumber} registrada correctamente`,
      });
    } catch (error) {
      next(error);
    }
  },

  async getReceiptPDF(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const pdfBuffer = await receiptService.generatePDF(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=recibo-${id}.pdf`
      );
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },

  async getReceiptHTML(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;

      const { sale, storeConfig } = await receiptService.getReceiptData(id);
      const html = receiptService.generateHTMLReceipt(sale, storeConfig);

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      next(error);
    }
  },
};

export default saleController;
