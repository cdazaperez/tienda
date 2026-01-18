import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import storeConfigService from '../services/storeConfigService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

// Configurar multer para uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(config.upload.dir, 'logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, GIF o WebP.'));
  }
};

export const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
}).single('logo');

export const configController = {
  async getConfig(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const storeConfig = await storeConfigService.getConfig();

      res.json({
        success: true,
        data: storeConfig,
      });
    } catch (error) {
      next(error);
    }
  },

  async getPublicConfig(_req: Request, res: Response, next: NextFunction) {
    try {
      const publicConfig = await storeConfigService.getPublicConfig();

      res.json({
        success: true,
        data: publicConfig,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateConfig(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user!.userId;
      const updateData = req.body;

      const updatedConfig = await storeConfigService.updateConfig(
        updateData,
        userId,
        req.clientIp
      );

      res.json({
        success: true,
        data: updatedConfig,
        message: 'Configuración actualizada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadStoreLogo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se proporcionó ningún archivo',
        });
        return;
      }

      const userId = req.user!.userId;
      const logoUrl = `/uploads/logos/${req.file.filename}`;

      const updatedConfig = await storeConfigService.updateConfig(
        { logoUrl },
        userId,
        req.clientIp
      );

      res.json({
        success: true,
        data: {
          logoUrl: updatedConfig.logoUrl,
        },
        message: 'Logo actualizado correctamente',
      });
    } catch (error) {
      next(error);
    }
  },
};

export default configController;
