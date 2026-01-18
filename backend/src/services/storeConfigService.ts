import prisma from '../config/database.js';
import { Prisma } from '@prisma/client';
import auditService from './auditService.js';

interface UpdateConfigInput {
  storeName?: string;
  storeNit?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  darkMode?: boolean;
  allowNegativeStock?: boolean;
  maxLoginAttempts?: number;
  lockoutMinutes?: number;
  defaultTaxRate?: number;
  receiptFooter?: string;
}

export const storeConfigService = {
  async getConfig() {
    let config = await prisma.storeConfig.findUnique({
      where: { id: 'store_config' },
    });

    // Crear configuración por defecto si no existe
    if (!config) {
      config = await prisma.storeConfig.create({
        data: { id: 'store_config' },
      });
    }

    return config;
  },

  async updateConfig(
    data: UpdateConfigInput,
    userId: string,
    ipAddress?: string
  ) {
    const currentConfig = await this.getConfig();

    // Preparar datos para actualizar
    const updateData: Prisma.StoreConfigUpdateInput = {};

    if (data.storeName !== undefined) updateData.storeName = data.storeName;
    if (data.storeNit !== undefined) updateData.storeNit = data.storeNit;
    if (data.storeAddress !== undefined)
      updateData.storeAddress = data.storeAddress;
    if (data.storePhone !== undefined) updateData.storePhone = data.storePhone;
    if (data.storeEmail !== undefined) updateData.storeEmail = data.storeEmail;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.primaryColor !== undefined)
      updateData.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined)
      updateData.secondaryColor = data.secondaryColor;
    if (data.accentColor !== undefined)
      updateData.accentColor = data.accentColor;
    if (data.darkMode !== undefined) updateData.darkMode = data.darkMode;
    if (data.allowNegativeStock !== undefined)
      updateData.allowNegativeStock = data.allowNegativeStock;
    if (data.maxLoginAttempts !== undefined)
      updateData.maxLoginAttempts = data.maxLoginAttempts;
    if (data.lockoutMinutes !== undefined)
      updateData.lockoutMinutes = data.lockoutMinutes;
    if (data.defaultTaxRate !== undefined)
      updateData.defaultTaxRate = data.defaultTaxRate;
    if (data.receiptFooter !== undefined)
      updateData.receiptFooter = data.receiptFooter;

    const updatedConfig = await prisma.storeConfig.update({
      where: { id: 'store_config' },
      data: updateData,
    });

    // Registrar cambios en auditoría
    const changedFields: Record<string, { old: unknown; new: unknown }> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const oldValue = currentConfig[key as keyof typeof currentConfig];
        if (oldValue !== value) {
          changedFields[key] = { old: oldValue, new: value };
        }
      }
    }

    if (Object.keys(changedFields).length > 0) {
      await auditService.log({
        userId,
        action: 'CONFIG_UPDATE',
        entity: 'store_config',
        entityId: 'store_config',
        oldValues: changedFields,
        newValues: data,
        ipAddress,
        description: `Configuración actualizada: ${Object.keys(changedFields).join(', ')}`,
      });
    }

    return updatedConfig;
  },

  async getPublicConfig() {
    const config = await this.getConfig();

    // Retornar solo campos públicos (sin secretos)
    return {
      storeName: config.storeName,
      logoUrl: config.logoUrl,
      primaryColor: config.primaryColor,
      secondaryColor: config.secondaryColor,
      accentColor: config.accentColor,
      darkMode: config.darkMode,
    };
  },

  async getReceiptConfig() {
    const config = await this.getConfig();

    return {
      storeName: config.storeName,
      storeNit: config.storeNit,
      storeAddress: config.storeAddress,
      storePhone: config.storePhone,
      storeEmail: config.storeEmail,
      logoUrl: config.logoUrl,
      receiptFooter: config.receiptFooter,
    };
  },
};

export default storeConfigService;
