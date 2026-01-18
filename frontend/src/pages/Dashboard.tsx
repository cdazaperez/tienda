import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { reportApi, inventoryApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { SalesReport, Product } from '../types';

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
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
          {trend && trendValue && (
            <div className="flex items-center mt-2">
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}
              >
                {trendValue}
              </span>
            </div>
          )}
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
      return response.data.data as SalesReport & { date: string };
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const response = await inventoryApi.getLowStock();
      return response.data.data as Product[];
    },
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          ¡Bienvenido, {user?.firstName}!
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Aquí tienes un resumen de tu negocio hoy
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Ventas de Hoy"
          value={formatCurrency(dailyReport?.summary.totalRevenue || 0)}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Transacciones"
          value={dailyReport?.summary.totalSales || 0}
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <StatCard
          title="Ticket Promedio"
          value={formatCurrency(dailyReport?.summary.avgTicket || 0)}
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
            {dailyReport?.topProducts && dailyReport.topProducts.length > 0 ? (
              <div className="space-y-3">
                {dailyReport.topProducts.slice(0, 5).map((product, index) => (
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
                          {product.quantity} vendidos
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
                        {product.currentStock} unidades
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Mín: {product.minStock}
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

      {/* Recent Sales */}
      {isAdmin && dailyReport?.sales && dailyReport.sales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Ventas Recientes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Recibo</th>
                  <th>Vendedor</th>
                  <th>Items</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Hora</th>
                </tr>
              </thead>
              <tbody>
                {dailyReport.sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id}>
                    <td className="font-medium">#{sale.receiptNumber}</td>
                    <td>{sale.seller}</td>
                    <td>{sale.itemCount}</td>
                    <td>
                      <span className="badge badge-info">
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="font-semibold text-green-600">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="text-gray-500">
                      {new Date(sale.createdAt).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
