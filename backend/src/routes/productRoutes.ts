import { Router } from 'express';
import { body, param, query } from 'express-validator';
import productController from '../controllers/productController.js';
import { authenticate, adminOnly, sellerOrAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Búsqueda rápida para POS (todos pueden buscar)
router.get(
  '/search',
  authenticate,
  sellerOrAdmin,
  [query('q').optional().isLength({ min: 2 })],
  validateRequest,
  productController.search
);

// Productos con bajo stock
router.get('/low-stock', authenticate, sellerOrAdmin, productController.getLowStock);

// Buscar por código de barras
router.get(
  '/barcode/:barcode',
  authenticate,
  sellerOrAdmin,
  productController.getByBarcode
);

// Listar productos
router.get('/', authenticate, sellerOrAdmin, productController.getAll);

// Obtener producto por ID
router.get(
  '/:id',
  authenticate,
  sellerOrAdmin,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  productController.getById
);

// Solo admin puede crear productos
router.post(
  '/',
  authenticate,
  adminOnly,
  [
    body('sku')
      .notEmpty()
      .withMessage('SKU requerido')
      .isLength({ max: 50 })
      .withMessage('SKU máximo 50 caracteres'),
    body('name')
      .notEmpty()
      .withMessage('Nombre requerido')
      .isLength({ max: 200 })
      .withMessage('Nombre máximo 200 caracteres'),
    body('categoryId').isUUID().withMessage('Categoría inválida'),
    body('salePrice')
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Precio de venta inválido'),
    body('costPrice')
      .optional()
      .isDecimal({ decimal_digits: '0,2' })
      .withMessage('Precio de costo inválido'),
    body('taxRate')
      .optional()
      .isDecimal({ decimal_digits: '0,4' })
      .withMessage('Tasa de impuesto inválida'),
    body('minStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Stock mínimo debe ser >= 0'),
    body('currentStock')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Stock actual debe ser >= 0'),
  ],
  validateRequest,
  productController.create
);

// Solo admin puede editar productos
router.put(
  '/:id',
  authenticate,
  adminOnly,
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('sku').optional().isLength({ max: 50 }),
    body('name').optional().isLength({ max: 200 }),
    body('categoryId').optional().isUUID(),
    body('salePrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('costPrice').optional().isDecimal({ decimal_digits: '0,2' }),
    body('taxRate').optional().isDecimal({ decimal_digits: '0,4' }),
    body('minStock').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  productController.update
);

// Solo admin puede eliminar productos
router.delete(
  '/:id',
  authenticate,
  adminOnly,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  productController.delete
);

export default router;
