import { Router } from 'express';
import { body, param } from 'express-validator';
import inventoryController from '../controllers/inventoryController.js';
import { authenticate, adminOnly, sellerOrAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Ver productos con bajo stock (todos)
router.get('/low-stock', authenticate, sellerOrAdmin, inventoryController.getLowStock);

// Reporte de inventario
router.get('/report', authenticate, sellerOrAdmin, inventoryController.getStockReport);

// Ver movimientos de un producto (todos pueden ver)
router.get(
  '/:productId/movements',
  authenticate,
  sellerOrAdmin,
  [param('productId').isUUID().withMessage('ID de producto inválido')],
  validateRequest,
  inventoryController.getMovements
);

// Agregar entrada de inventario (solo admin)
router.post(
  '/:productId/entry',
  authenticate,
  adminOnly,
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('quantity')
      .isInt({ min: 1 })
      .withMessage('Cantidad debe ser mayor a 0'),
    body('unitCost')
      .optional()
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Costo unitario inválido'),
    body('reason').optional().isLength({ max: 500 }),
  ],
  validateRequest,
  inventoryController.addEntry
);

// Ajustar inventario (solo admin)
router.post(
  '/:productId/adjust',
  authenticate,
  adminOnly,
  [
    param('productId').isUUID().withMessage('ID de producto inválido'),
    body('newStock')
      .isInt({ min: 0 })
      .withMessage('Stock debe ser >= 0'),
    body('reason')
      .notEmpty()
      .withMessage('Motivo de ajuste requerido')
      .isLength({ max: 500 }),
  ],
  validateRequest,
  inventoryController.adjustStock
);

export default router;
