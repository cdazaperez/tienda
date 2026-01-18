import { Router } from 'express';
import { body } from 'express-validator';
import configController, { uploadLogo } from '../controllers/configController.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

// Configuración pública (tema, logo) - sin autenticación
router.get('/public', configController.getPublicConfig);

// Configuración completa (solo admin)
router.get('/', authenticate, adminOnly, configController.getConfig);

// Actualizar configuración (solo admin)
router.put(
  '/',
  authenticate,
  adminOnly,
  [
    body('storeName').optional().isLength({ max: 200 }),
    body('storeNit').optional().isLength({ max: 50 }),
    body('storeAddress').optional().isLength({ max: 300 }),
    body('storePhone').optional().isLength({ max: 50 }),
    body('storeEmail').optional().isEmail(),
    body('primaryColor')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color primario debe ser un código hex válido'),
    body('secondaryColor')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color secundario debe ser un código hex válido'),
    body('accentColor')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color de acento debe ser un código hex válido'),
    body('darkMode').optional().isBoolean(),
    body('allowNegativeStock').optional().isBoolean(),
    body('maxLoginAttempts').optional().isInt({ min: 1, max: 20 }),
    body('lockoutMinutes').optional().isInt({ min: 1, max: 1440 }),
    body('defaultTaxRate').optional().isFloat({ min: 0, max: 1 }),
    body('receiptFooter').optional().isLength({ max: 500 }),
  ],
  validateRequest,
  configController.updateConfig
);

// Subir logo (solo admin)
router.post(
  '/logo',
  authenticate,
  adminOnly,
  uploadLogo,
  configController.uploadStoreLogo
);

export default router;
