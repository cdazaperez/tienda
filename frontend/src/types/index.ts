export type UserRole = 'ADMIN' | 'SELLER';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  category?: Category;
  brand?: string;
  size?: string;
  color?: string;
  salePrice: string;
  costPrice?: string;
  taxRate: string;
  unit: string;
  imageUrl?: string;
  minStock: number;
  currentStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  userId: string;
  type: 'ENTRY' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'VOID';
  quantity: number;
  previousStock: number;
  newStock: number;
  unitCost?: string;
  reason?: string;
  referenceId?: string;
  referenceType?: string;
  createdAt: string;
  user?: {
    firstName: string;
    lastName: string;
  };
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  discountAmount: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
  total: string;
  returnedQty: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'PARTIAL_RETURN';

export interface Sale {
  id: string;
  receiptNumber: number;
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: SaleStatus;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  paymentMethod: PaymentMethod;
  amountPaid: string;
  changeAmount: string;
  notes?: string;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  createdAt: string;
  items: SaleItem[];
  returns?: Return[];
}

export interface Return {
  id: string;
  returnNumber: number;
  saleId: string;
  userId: string;
  reason: string;
  totalRefund: string;
  createdAt: string;
  items: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  returnId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  refundAmount: string;
}

export interface StoreConfig {
  id: string;
  storeName: string;
  storeNit?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkMode: boolean;
  allowNegativeStock: boolean;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  defaultTaxRate: string;
  receiptFooter?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: string;
  entity: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  description?: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
  pagination?: Pagination;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

export interface SalesReport {
  summary: {
    totalSales: number;
    totalRevenue: string;
    avgTicket: string;
  };
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: string;
  }>;
  topCategories: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: string;
  }>;
  topSellers: Array<{
    id: string;
    name: string;
    sales: number;
    revenue: string;
  }>;
  sales: Array<{
    id: string;
    receiptNumber: number;
    total: string;
    createdAt: string;
    seller: string;
    paymentMethod: string;
    itemCount: number;
  }>;
}
