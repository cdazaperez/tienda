import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, TrendingUp, Package, Users } from 'lucide-react';
import { reportApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { SalesReport } from '../types';

export function ReportsPage() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', period, startDate],
    queryFn: async () => {
      let response;
      switch (period) {
        case 'daily':
          response = await reportApi.getDaily(startDate);
          break;
        case 'weekly':
          response = await reportApi.getWeekly(startDate);
          break;
        case 'monthly':
          const date = new Date(startDate);
          response = await reportApi.getMonthly(
            date.getMonth() + 1,
            date.getFullYear()
          );
          break;
      }
      return response.data.data as SalesReport;
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

  const handleExportCSV = async () => {
    try {
      const response = await reportApi.exportSalesCSV({ startDate });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${startDate}.csv`;
      a.click();
    } catch (error) {
      console.error('Error al exportar:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reportes
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Análisis de ventas y rendimiento
          </p>
        </div>
        <Button variant="secondary" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-white dark:bg-gray-600 shadow'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {p === 'daily' ? 'Diario' : p === 'weekly' ? 'Semanal' : 'Mensual'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Cargando reporte...</div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(report.summary.totalRevenue)}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transacciones</p>
                  <p className="text-2xl font-bold">{report.summary.totalSales}</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                  <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ticket Promedio</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(report.summary.avgTicket)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Products */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Top Productos</h3>
              </div>
              <div className="card-body">
                {report.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {report.topProducts.map((product, i) => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full text-sm font-medium">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            <p className="text-xs text-gray-500">
                              {product.quantity} vendidos
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-sm text-green-600">
                          {formatCurrency(product.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">Sin datos</p>
                )}
              </div>
            </div>

            {/* Top Categories */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Top Categorías</h3>
              </div>
              <div className="card-body">
                {report.topCategories.length > 0 ? (
                  <div className="space-y-3">
                    {report.topCategories.map((cat, i) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{cat.name}</p>
                            <p className="text-xs text-gray-500">
                              {cat.quantity} unidades
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-sm text-green-600">
                          {formatCurrency(cat.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">Sin datos</p>
                )}
              </div>
            </div>

            {/* Top Sellers */}
            <div className="card">
              <div className="card-header">
                <h3 className="font-semibold">Top Vendedores</h3>
              </div>
              <div className="card-body">
                {report.topSellers.length > 0 ? (
                  <div className="space-y-3">
                    {report.topSellers.map((seller, i) => (
                      <div
                        key={seller.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-600 rounded-full text-sm font-medium">
                            {i + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{seller.name}</p>
                            <p className="text-xs text-gray-500">
                              {seller.sales} ventas
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-sm text-green-600">
                          {formatCurrency(seller.revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">Sin datos</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No hay datos para el período seleccionado
        </div>
      )}
    </div>
  );
}
