import { Router } from 'express';
import { body, param } from 'express-validator';
import userController from '../controllers/userController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Todas las rutas de usuarios son solo para admin
router.use(authenticate, adminOnly);

router.get('/', userController.getAll);

router.get(
  '/:id',
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  userController.getById
);

router.post(
  '/',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('username')
      .notEmpty()
      .withMessage('Usuario requerido')
      .isLength({ min: 3, max: 50 })
      .withMessage('Usuario debe tener entre 3 y 50 caracteres'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Contraseña debe tener al menos 8 caracteres'),
    body('firstName')
      .notEmpty()
      .withMessage('Nombre requerido')
      .isLength({ max: 100 }),
    body('lastName')
      .notEmpty()
      .withMessage('Apellido requerido')
      .isLength({ max: 100 }),
    body('role')
      .optional()
      .isIn(['ADMIN', 'SELLER'])
      .withMessage('Rol inválido'),
  ],
  validateRequest,
  userController.create
);

router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('email').optional().isEmail(),
    body('username').optional().isLength({ min: 3, max: 50 }),
    body('firstName').optional().isLength({ max: 100 }),
    body('lastName').optional().isLength({ max: 100 }),
    body('role').optional().isIn(['ADMIN', 'SELLER']),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  userController.update
);

router.post(
  '/:id/reset-password',
  [
    param('id').isUUID().withMessage('ID inválido'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Contraseña debe tener al menos 8 caracteres'),
  ],
  validateRequest,
  userController.resetPassword
);

router.post(
  '/:id/toggle-active',
  [param('id').isUUID().withMessage('ID inválido')],
  validateRequest,
  userController.toggleActive
);

export default router;
