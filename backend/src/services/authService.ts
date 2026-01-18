import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database.js';
import config from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import auditService from './auditService.js';
import { JwtPayload } from '../types/index.js';

export const authService = {
  async login(
    emailOrUsername: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    // Buscar usuario por email o username
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
      },
    });

    if (!user) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Obtener configuración de tienda
    const storeConfig = await prisma.storeConfig.findUnique({
      where: { id: 'store_config' },
    });

    const maxAttempts = storeConfig?.maxLoginAttempts || 5;
    const lockoutMinutes = storeConfig?.lockoutMinutes || 15;

    // Verificar si está bloqueado
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new AppError(
        `Cuenta bloqueada. Intente en ${remainingMinutes} minutos`,
        423
      );
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      // Incrementar intentos fallidos
      const newAttempts = user.failedAttempts + 1;
      const updateData: {
        failedAttempts: number;
        lockedUntil?: Date | null;
      } = {
        failedAttempts: newAttempts,
      };

      if (newAttempts >= maxAttempts) {
        updateData.lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      await auditService.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'user',
        entityId: user.id,
        ipAddress,
        userAgent,
        description: `Intento de login fallido (${newAttempts}/${maxAttempts})`,
      });

      if (newAttempts >= maxAttempts) {
        throw new AppError(
          `Cuenta bloqueada por ${lockoutMinutes} minutos`,
          423
        );
      }

      throw new AppError('Credenciales inválidas', 401);
    }

    // Verificar si usuario está activo
    if (!user.isActive) {
      throw new AppError('Cuenta desactivada. Contacte al administrador', 403);
    }

    // Reset intentos y actualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    });

    // Generar tokens
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 días

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    await auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
      description: 'Inicio de sesión exitoso',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  },

  async refreshToken(refreshToken: string) {
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      throw new AppError('Token de refresco inválido o expirado', 401);
    }

    if (!storedToken.user.isActive) {
      throw new AppError('Cuenta desactivada', 403);
    }

    // Eliminar token usado
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Generar nuevos tokens
    const payload: JwtPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const newRefreshToken = uuidv4();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  },

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    } else {
      // Eliminar todos los tokens del usuario
      await prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }

    await auditService.log({
      userId,
      action: 'LOGOUT',
      entity: 'user',
      entityId: userId,
      description: 'Cierre de sesión',
    });
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new AppError('Usuario no encontrado', 404);
    }

    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isValidPassword) {
      throw new AppError('Contraseña actual incorrecta', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Invalidar todos los refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    await auditService.log({
      userId,
      action: 'PASSWORD_CHANGE',
      entity: 'user',
      entityId: userId,
      description: 'Cambio de contraseña',
    });
  },
};

export default authService;
