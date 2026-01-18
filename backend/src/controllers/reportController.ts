import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ReportFilters } from '../types/index.js';
import saleService from '../services/saleService.js';
import inventoryService from '../services/inventoryService.js';

export const reportController = {
  async getSalesReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { startDate, endDate, userId, categoryId, paymentMethod } =
        req.query;

      const filters: ReportFilters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId: userId as string | undefined,
        categoryId: categoryId as string | undefined,
        paymentMethod: paymentMethod as string | undefined,
      };

      const report = await saleService.getSalesReport(filters);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  },

  async getDailySalesReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { date } = req.query;

      const targetDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const report = await saleService.getSalesReport({
        startDate: startOfDay,
        endDate: endOfDay,
      });

      res.json({
        success: true,
        data: {
          date: targetDate.toISOString().split('T')[0],
          ...report,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getWeeklySalesReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { startDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date();
      // Ajustar al inicio de la semana (lunes)
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const report = await saleService.getSalesReport({
        startDate: start,
        endDate: end,
      });

      res.json({
        success: true,
        data: {
          weekStart: start.toISOString().split('T')[0],
          weekEnd: end.toISOString().split('T')[0],
          ...report,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getMonthlySalesReport(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { month, year } = req.query;

      const now = new Date();
      const targetMonth = month ? parseInt(month as string, 10) - 1 : now.getMonth();
      const targetYear = year ? parseInt(year as string, 10) : now.getFullYear();

      const startOfMonth = new Date(targetYear, targetMonth, 1);
      const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      const report = await saleService.getSalesReport({
        startDate: startOfMonth,
        endDate: endOfMonth,
      });

      res.json({
        success: true,
        data: {
          month: targetMonth + 1,
          year: targetYear,
          ...report,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async getInventoryReport(
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

  async exportSalesCSV(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { startDate, endDate, userId, categoryId, paymentMethod } =
        req.query;

      const filters: ReportFilters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        userId: userId as string | undefined,
        categoryId: categoryId as string | undefined,
        paymentMethod: paymentMethod as string | undefined,
      };

      const report = await saleService.getSalesReport(filters);

      // Generar CSV
      const headers = [
        'Recibo',
        'Fecha',
        'Vendedor',
        'Total',
        'Método de Pago',
        'Items',
      ];

      const rows = report.sales.map((sale) => [
        sale.receiptNumber,
        new Date(sale.createdAt).toLocaleString('es-CO'),
        sale.seller,
        sale.total,
        sale.paymentMethod,
        sale.itemCount,
      ]);

      let csv = headers.join(',') + '\n';
      for (const row of rows) {
        csv += row.map((v) => `"${v}"`).join(',') + '\n';
      }

      // Agregar resumen
      csv += '\n';
      csv += `"Total Ventas",${report.summary.totalSales}\n`;
      csv += `"Ingresos Totales",${report.summary.totalRevenue}\n`;
      csv += `"Ticket Promedio",${report.summary.avgTicket}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=reporte-ventas.csv'
      );
      res.send('\uFEFF' + csv); // BOM para Excel
    } catch (error) {
      next(error);
    }
  },

  async exportInventoryCSV(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const report = await inventoryService.getStockReport();

      const headers = [
        'SKU',
        'Producto',
        'Categoría',
        'Stock Actual',
        'Stock Mínimo',
        'Precio Venta',
        'Costo',
        'Estado',
      ];

      const rows = report.products.map((p) => [
        p.sku,
        p.name,
        p.category?.name || 'Sin categoría',
        p.currentStock,
        p.minStock,
        p.salePrice.toString(),
        p.costPrice?.toString() || '',
        p.currentStock <= p.minStock ? 'BAJO STOCK' : 'OK',
      ]);

      let csv = headers.join(',') + '\n';
      for (const row of rows) {
        csv += row.map((v) => `"${v}"`).join(',') + '\n';
      }

      csv += '\n';
      csv += `"Total Productos",${report.summary.totalProducts}\n`;
      csv += `"Productos Bajo Stock",${report.summary.lowStockCount}\n`;
      csv += `"Valor Total Inventario",${report.summary.totalInventoryValue}\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=reporte-inventario.csv'
      );
      res.send('\uFEFF' + csv);
    } catch (error) {
      next(error);
    }
  },
};

export default reportController;
