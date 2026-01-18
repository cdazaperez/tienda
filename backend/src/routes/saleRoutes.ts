import { Router } from 'express';
import { body, param } from 'express-validator';
import saleController from '../controllers/saleController.js';
import { authenticate, adminOnly, sellerOrAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Crear venta (vendedor y admin)
router.post(
  '/',
  authenticate,
  sellerOrAdmin,
  [
    body('items')
      .isArray({ min: 1 })
      .withMessage('Debe incluir al menos un producto'),
    body('items.*.productId').isUUID().withMessage('ID de producto inválido'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Cantidad debe ser mayor a 0'),
    body('items.*.discountPercent')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Descuento debe estar entre 0 y 100'),
    body('paymentMethod')
      .isIn(['CASH', 'CARD', 'TRANSFER', 'MIXED'])
      .withMessage('Método de pago inválido'),
    body('amountPaid')
      .isFloat({ min: 0 })
      .withMessage('Monto pagado inválido'),
    body('globalDiscountPercent')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('Descuento global debe estar entre 0 y 100'),
  ],
  validateRequest,
  saleController.create
);

// Listar ventas
router.get('/', authenticate, sellerOrAdmin, saleController.getAll);

// Obtener venta por número de recibo
router.get(
  '/receipt/:receiptNumber',
  authenticate,
  sellerOrAdmin,
  saleController.getByReceiptNumber
);

// Obtener venta por ID
router.get(
  '/:id',
  authenticate,
  sellerOrAdmin,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  saleController.getById
);

// Anular venta (solo admin)
router.post(
  '/:id/void',
  authenticate,
  adminOnly,
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('reason')
      .notEmpty()
      .withMessage('Motivo de anulación requerido')
      .isLength({ max: 500 }),
  ],
  validateRequest,
  saleController.void
);

// Crear devolución (admin, o seller con permisos)
router.post(
  '/:id/return',
  authenticate,
  adminOnly, // Por ahora solo admin, podría configurarse
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Debe incluir al menos un producto'),
    body('items.*.productId').isUUID().withMessage('ID de producto inválido'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Cantidad debe ser mayor a 0'),
    body('reason')
      .notEmpty()
      .withMessage('Motivo de devolución requerido')
      .isLength({ max: 500 }),
  ],
  validateRequest,
  saleController.createReturn
);

// Obtener recibo en PDF
router.get(
  '/:id/receipt/pdf',
  authenticate,
  sellerOrAdmin,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  saleController.getReceiptPDF
);

// Obtener recibo en HTML
router.get(
  '/:id/receipt/html',
  authenticate,
  sellerOrAdmin,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  saleController.getReceiptHTML
);

export default router;
