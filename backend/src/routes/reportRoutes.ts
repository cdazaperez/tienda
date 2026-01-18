import { Router } from 'express';
import reportController from '../controllers/reportController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();

// Todos los reportes son solo para admin
router.use(authenticate, adminOnly);

// Reporte general de ventas
router.get('/sales', reportController.getSalesReport);

// Reporte diario
router.get('/sales/daily', reportController.getDailySalesReport);

// Reporte semanal
router.get('/sales/weekly', reportController.getWeeklySalesReport);

// Reporte mensual
router.get('/sales/monthly', reportController.getMonthlySalesReport);

// Reporte de inventario
router.get('/inventory', reportController.getInventoryReport);

// Exportar ventas a CSV
router.get('/sales/export/csv', reportController.exportSalesCSV);

// Exportar inventario a CSV
router.get('/inventory/export/csv', reportController.exportInventoryCSV);

export default router;
