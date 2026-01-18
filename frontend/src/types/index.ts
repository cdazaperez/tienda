export type UserRole = 'ADMIN' | 'SELLER';

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active?: boolean;
  last_login?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category_id: string;
  category?: Category;
  brand?: string;
  size?: string;
  color?: string;
  sale_price: string;
  cost_price?: string;
  tax_rate: string;
  unit: string;
  image_url?: string;
  min_stock: number;
  current_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_id: string;
  user_id: string;
  type: 'ENTRY' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'VOID';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_cost?: string;
  reason?: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
  user_name?: string;
  product_name?: string;
  product_sku?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: string;
  discount_percent: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  subtotal: string;
  total: string;
  returned_qty: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
export type SaleStatus = 'COMPLETED' | 'VOIDED' | 'PARTIAL_RETURN';

export interface Sale {
  id: string;
  receipt_number: string;
  user_id: string;
  user_name?: string;
  status: SaleStatus;
  subtotal: string;
  discount_amount: string;
  discount_percent: string;
  tax_amount: string;
  total: string;
  payment_method: PaymentMethod;
  amount_paid: string;
  change_amount: string;
  notes?: string;
  void_reason?: string;
  voided_at?: string;
  voided_by_id?: string;
  created_at: string;
  updated_at: string;
  items: SaleItem[];
}

export interface Return {
  id: string;
  sale_id: string;
  user_id: string;
  reason: string;
  total_refund: string;
  created_at: string;
  items: ReturnItem[];
}

export interface ReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  quantity: number;
  refund_amount: string;
}

export interface StoreConfig {
  id: string;
  store_name: string;
  store_rut?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  dark_mode_default: boolean;
  allow_negative_stock: boolean;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  low_stock_threshold?: number;
  receipt_header?: string;
  receipt_footer?: string;
  currency_symbol?: string;
  currency_code?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity: string;
  entity_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  description?: string;
  created_at: string;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount_percent: number;
}

export interface SalesReport {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_sales: number;
    completed_sales: number;
    voided_sales: number;
    total_revenue: number;
    total_cost: number;
    gross_profit: number;
    profit_margin: number;
    total_tax: number;
    avg_sale: number;
  };
  by_payment_method: Record<string, { count: number; total: number }>;
  by_category: Array<{
    category_id: string;
    category_name: string;
    quantity_sold: number;
    revenue: number;
  }>;
  top_products: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    quantity_sold: number;
    revenue: number;
  }>;
  by_seller: Array<{
    user_id: string;
    user_name: string;
    total_sales: number;
    total_revenue: number;
  }>;
}
