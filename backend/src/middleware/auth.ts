import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import config from '../config/index.js';
import { AuthenticatedRequest, JwtPayload } from '../types/index.js';
import prisma from '../config/database.js';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Token de autenticación no proporcionado',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Verificar que el usuario existe y está activo
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true, role: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Usuario no autorizado o inactivo',
      });
      return;
    }

    req.user = decoded;
    req.clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Token inválido o expirado',
    });
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'No tiene permisos para realizar esta acción',
      });
      return;
    }

    next();
  };
};

export const adminOnly = authorize(UserRole.ADMIN);
export const sellerOrAdmin = authorize(UserRole.ADMIN, UserRole.SELLER);
