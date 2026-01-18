import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  clientIp?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

export interface SaleItemInput {
  productId: string;
  quantity: number;
  discountPercent?: number;
}

export interface CreateSaleInput {
  items: SaleItemInput[];
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
  amountPaid: number;
  globalDiscountPercent?: number;
  notes?: string;
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  categoryId?: string;
  paymentMethod?: string;
}
