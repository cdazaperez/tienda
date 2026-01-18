import { Router } from 'express';
import { param } from 'express-validator';
import auditController from '../controllers/auditController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Todos los endpoints de auditoría son solo para admin
router.use(authenticate, adminOnly);

// Listar logs de auditoría
router.get('/', auditController.getAll);

// Obtener logs por entidad
router.get(
  '/:entity/:entityId',
  [
    param('entity').notEmpty().withMessage('Entidad requerida'),
    param('entityId').notEmpty().withMessage('ID de entidad requerido'),
  ],
  validateRequest,
  auditController.getByEntity
);

export default router;
