import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import { reportApi, inventoryApi, saleApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Product, Sale, PaginatedResponse } from '../types';

interface DailyReport {
  period: string;
  start_date: string;
  end_date: string;
  summary: {
    total_sales: number;
    total_revenue: number;
    total_tax: number;
    total_discount: number;
    average_ticket: number;
  };
  payment_methods: Record<string, { count: number; total: number }>;
  top_products: Array<{
    id: string;
    name: string;
    sku: string;
    quantity_sold: number;
    revenue: number;
  }>;
  top_sellers: Array<{
    id: string;
    name: string;
    sales_count: number;
    revenue: number;
  }>;
  top_categories: Array<{
    id: string;
    name: string;
    quantity_sold: number;
    revenue: number;
  }>;
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: dailyReport } = useQuery({
    queryKey: ['daily-report'],
    queryFn: async () => {
      const response = await reportApi.getDaily();
      return response.data as DailyReport;
    },
    enabled: isAdmin,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const response = await inventoryApi.getLowStock();
      return response.data as Product[];
    },
    enabled: isAdmin,
  });

  // Ventas del vendedor (para sellers)
  const { data: mySales } = useQuery({
    queryKey: ['my-sales-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await saleApi.getAll({
        start_date: today,
        end_date: today,
        page_size: 50,
      });
      return response.data as PaginatedResponse<Sale>;
    },
    enabled: !isAdmin,
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  // Calcular estadísticas del vendedor
  const sellerStats = {
    totalSales: mySales?.items?.length || 0,
    totalRevenue: mySales?.items?.reduce((sum, sale) => sum + parseFloat(sale.total), 0) || 0,
    avgTicket: mySales?.items?.length
      ? (mySales.items.reduce((sum, sale) => sum + parseFloat(sale.total), 0) / mySales.items.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ¡Bienvenido, {user?.first_name}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {isAdmin
            ? 'Aquí tienes un resumen de tu negocio hoy'
            : 'Resumen de tus ventas del día'}
        </p>
      </div>

      {isAdmin ? (
        <>
          {/* Admin Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Ventas de Hoy"
              value={formatCurrency(dailyReport?.summary?.total_revenue || 0)}
              icon={DollarSign}
              color="bg-green-500"
            />
            <StatCard
              title="Transacciones"
              value={dailyReport?.summary?.total_sales || 0}
              icon={ShoppingCart}
              color="bg-blue-500"
            />
            <StatCard
              title="Ticket Promedio"
              value={formatCurrency(dailyReport?.summary?.average_ticket || 0)}
              icon={TrendingUp}
              color="bg-purple-500"
            />
            <StatCard
              title="Productos Bajo Stock"
              value={lowStock?.length || 0}
              icon={AlertTriangle}
              color="bg-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Top Productos del Día
                </h2>
              </div>
              <div className="card-body">
                {dailyReport?.top_products && dailyReport.top_products.length > 0 ? (
                  <div className="space-y-3">
                    {dailyReport.top_products.slice(0, 5).map((product, index) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full text-sm font-medium">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {product.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {product.quantity_sold} vendidos
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(product.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No hay ventas registradas hoy
                  </p>
                )}
              </div>
            </div>

            {/* Low Stock Alert */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Alertas de Stock Bajo
                </h2>
              </div>
              <div className="card-body">
                {lowStock && lowStock.length > 0 ? (
                  <div className="space-y-3">
                    {lowStock.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            SKU: {product.sku}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600 dark:text-orange-400">
                            {product.current_stock} unidades
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Mín: {product.min_stock}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No hay productos con stock bajo
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        // Seller view - Muestra sus ventas del día
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              title="Mis Ventas Hoy"
              value={formatCurrency(sellerStats.totalRevenue)}
              icon={DollarSign}
              color="bg-green-500"
            />
            <StatCard
              title="Transacciones"
              value={sellerStats.totalSales}
              icon={ShoppingCart}
              color="bg-blue-500"
            />
            <StatCard
              title="Ticket Promedio"
              value={formatCurrency(sellerStats.avgTicket)}
              icon={TrendingUp}
              color="bg-purple-500"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Sales */}
            <div className="card">
              <div className="card-header flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Mis Ventas Recientes
                </h2>
                <a
                  href="/sales"
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Ver todas
                </a>
              </div>
              <div className="card-body">
                {mySales?.items && mySales.items.length > 0 ? (
                  <div className="space-y-3">
                    {mySales.items.slice(0, 5).map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            #{sale.receipt_number}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(sale.created_at).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' - '}
                            {sale.items?.length || 0} items
                          </p>
                        </div>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(sale.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No has registrado ventas hoy
                  </p>
                )}
              </div>
            </div>

            {/* Quick Access */}
            <div className="card">
              <div className="card-header">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Acceso Rápido
                </h2>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-2 gap-4">
                  <a
                    href="/pos"
                    className="flex flex-col items-center justify-center p-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                  >
                    <ShoppingCart className="w-10 h-10 text-primary-600 mb-2" />
                    <span className="font-medium text-primary-700 dark:text-primary-400">
                      Ir al POS
                    </span>
                  </a>
                  <a
                    href="/sales"
                    className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <DollarSign className="w-10 h-10 text-green-600 mb-2" />
                    <span className="font-medium text-green-700 dark:text-green-400">
                      Mis Ventas
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
