import { Router } from 'express';
import { body, param } from 'express-validator';
import categoryController from '../controllers/categoryController.js';
import { authenticate, adminOnly, sellerOrAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Todos los usuarios autenticados pueden ver categorías
router.get('/', authenticate, sellerOrAdmin, categoryController.getAll);

router.get(
  '/:id',
  authenticate,
  sellerOrAdmin,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  categoryController.getById
);

// Solo admin puede crear, editar, eliminar
router.post(
  '/',
  authenticate,
  adminOnly,
  [
    body('name')
      .notEmpty()
      .withMessage('Nombre requerido')
      .isLength({ max: 100 })
      .withMessage('Máximo 100 caracteres'),
    body('description').optional().isLength({ max: 500 }),
  ],
  validateRequest,
  categoryController.create
);

router.put(
  '/:id',
  authenticate,
  adminOnly,
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('name').optional().isLength({ max: 100 }),
    body('description').optional().isLength({ max: 500 }),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  categoryController.update
);

router.delete(
  '/:id',
  authenticate,
  adminOnly,
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  categoryController.delete
);

export default router;
