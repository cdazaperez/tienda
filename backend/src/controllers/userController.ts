import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { AuthenticatedRequest } from '../types/index.js';
import auditService from '../services/auditService.js';
import { UserRole } from '@prisma/client';

export const userController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { active, role } = req.query;

      const where: { isActive?: boolean; role?: UserRole } = {};
      if (active === 'true') where.isActive = true;
      if (active === 'false') where.isActive = false;
      if (role) where.role = role as UserRole;

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { firstName: 'asc' },
      });

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          _count: {
            select: { sales: true },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user!.userId;
      const { email, username, password, firstName, lastName, role } = req.body;

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          role: role || UserRole.SELLER,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await auditService.log({
        userId: currentUserId,
        action: 'CREATE',
        entity: 'user',
        entityId: user.id,
        newValues: { email, username, firstName, lastName, role },
        ipAddress: req.clientIp,
        description: `Usuario creado: ${firstName} ${lastName} (${email})`,
      });

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.userId;
      const { email, username, firstName, lastName, role, isActive } = req.body;

      const current = await prisma.user.findUnique({ where: { id } });

      if (!current) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          email,
          username,
          firstName,
          lastName,
          role,
          isActive,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await auditService.log({
        userId: currentUserId,
        action: 'UPDATE',
        entity: 'user',
        entityId: id,
        oldValues: {
          email: current.email,
          firstName: current.firstName,
          lastName: current.lastName,
          role: current.role,
          isActive: current.isActive,
        },
        newValues: { email, username, firstName, lastName, role, isActive },
        ipAddress: req.clientIp,
        description: `Usuario actualizado: ${firstName} ${lastName}`,
      });

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.userId;
      const { newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id },
        data: {
          passwordHash: hashedPassword,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // Invalidar todos los refresh tokens del usuario
      await prisma.refreshToken.deleteMany({ where: { userId: id } });

      await auditService.log({
        userId: currentUserId,
        action: 'PASSWORD_RESET',
        entity: 'user',
        entityId: id,
        ipAddress: req.clientIp,
        description: `Contraseña reseteada por admin para: ${user.firstName} ${user.lastName}`,
      });

      res.json({
        success: true,
        message: 'Contraseña reseteada correctamente',
      });
    } catch (error) {
      next(error);
    }
  },

  async toggleActive(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.userId;

      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      // No permitir desactivar el propio usuario
      if (id === currentUserId) {
        res.status(400).json({
          success: false,
          message: 'No puede desactivar su propia cuenta',
        });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      });

      // Si se desactiva, invalidar tokens
      if (!updatedUser.isActive) {
        await prisma.refreshToken.deleteMany({ where: { userId: id } });
      }

      await auditService.log({
        userId: currentUserId,
        action: updatedUser.isActive ? 'ACTIVATE' : 'DEACTIVATE',
        entity: 'user',
        entityId: id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: updatedUser.isActive },
        ipAddress: req.clientIp,
        description: `Usuario ${updatedUser.isActive ? 'activado' : 'desactivado'}: ${user.firstName} ${user.lastName}`,
      });

      res.json({
        success: true,
        data: updatedUser,
        message: `Usuario ${updatedUser.isActive ? 'activado' : 'desactivado'} correctamente`,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default userController;
