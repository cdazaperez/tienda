import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores y refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          useAuthStore.getState().setTokens(accessToken, newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return api(originalRequest);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: (refreshToken?: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Categories
export const categoryApi = {
  getAll: (active?: boolean) =>
    api.get('/categories', { params: { active } }),
  getById: (id: string) => api.get(`/categories/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post('/categories', data),
  update: (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// Products
export const productApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    active?: boolean;
    lowStock?: boolean;
  }) => api.get('/products', { params }),
  search: (q: string) => api.get('/products/search', { params: { q } }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`),
  getLowStock: () => api.get('/products/low-stock'),
  create: (data: Record<string, unknown>) => api.post('/products', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// Inventory
export const inventoryApi = {
  getMovements: (productId: string, params?: {
    startDate?: string;
    endDate?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) => api.get(`/inventory/${productId}/movements`, { params }),
  addEntry: (productId: string, data: {
    quantity: number;
    unitCost?: number;
    reason?: string;
  }) => api.post(`/inventory/${productId}/entry`, data),
  adjustStock: (productId: string, data: {
    newStock: number;
    reason: string;
  }) => api.post(`/inventory/${productId}/adjust`, data),
  getLowStock: () => api.get('/inventory/low-stock'),
  getReport: () => api.get('/inventory/report'),
};

// Sales
export const saleApi = {
  create: (data: {
    items: Array<{ productId: string; quantity: number; discountPercent?: number }>;
    paymentMethod: string;
    amountPaid: number;
    globalDiscountPercent?: number;
    notes?: string;
  }) => api.post('/sales', data),
  getAll: (params?: {
    page?: number;
    limit?: number;
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/sales', { params }),
  getById: (id: string) => api.get(`/sales/${id}`),
  getByReceiptNumber: (receiptNumber: number) =>
    api.get(`/sales/receipt/${receiptNumber}`),
  void: (id: string, reason: string) =>
    api.post(`/sales/${id}/void`, { reason }),
  createReturn: (id: string, data: {
    items: Array<{ productId: string; quantity: number }>;
    reason: string;
  }) => api.post(`/sales/${id}/return`, data),
  getReceiptPDF: (id: string) =>
    api.get(`/sales/${id}/receipt/pdf`, { responseType: 'blob' }),
  getReceiptHTML: (id: string) =>
    api.get(`/sales/${id}/receipt/html`, { responseType: 'text' }),
};

// Reports
export const reportApi = {
  getSales: (params?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    categoryId?: string;
    paymentMethod?: string;
  }) => api.get('/reports/sales', { params }),
  getDaily: (date?: string) =>
    api.get('/reports/sales/daily', { params: { date } }),
  getWeekly: (startDate?: string) =>
    api.get('/reports/sales/weekly', { params: { startDate } }),
  getMonthly: (month?: number, year?: number) =>
    api.get('/reports/sales/monthly', { params: { month, year } }),
  getInventory: () => api.get('/reports/inventory'),
  exportSalesCSV: (params?: Record<string, string>) =>
    api.get('/reports/sales/export/csv', { params, responseType: 'blob' }),
  exportInventoryCSV: () =>
    api.get('/reports/inventory/export/csv', { responseType: 'blob' }),
};

// Users
export const userApi = {
  getAll: (params?: { active?: boolean; role?: string }) =>
    api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) => api.post('/users', data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { newPassword }),
  toggleActive: (id: string) => api.post(`/users/${id}/toggle-active`),
};

// Config
export const configApi = {
  getPublic: () => api.get('/config/public'),
  get: () => api.get('/config'),
  update: (data: Record<string, unknown>) => api.put('/config', data),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/config/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Audit
export const auditApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    entity?: string;
    userId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/audit', { params }),
  getByEntity: (entity: string, entityId: string) =>
    api.get(`/audit/${entity}/${entityId}`),
};

export default api;
