import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Download, FileText, TrendingUp, Package, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi } from '../services/api';
import { Button } from '../components/ui/Button';

interface ReportData {
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
      return response.data as ReportData;
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

  // Map frontend period to backend period
  const getBackendPeriod = () => {
    switch (period) {
      case 'daily':
        return 'custom';
      case 'weekly':
        return 'week';
      case 'monthly':
        return 'month';
      default:
        return 'today';
    }
  };

  const handleExportCSV = async () => {
    try {
      const backendPeriod = getBackendPeriod();
      const response = await reportApi.exportSalesCSV({
        period: backendPeriod,
        start_date: startDate,
        end_date: startDate,
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-ventas-${startDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exportado correctamente');
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      toast.error('Error al exportar CSV');
    }
  };

  const handleExportPDF = async () => {
    if (!report) {
      toast.error('No hay datos para exportar');
      return;
    }

    try {
      // Generate PDF content as HTML
      const periodLabel = period === 'daily' ? 'Diario' : period === 'weekly' ? 'Semanal' : 'Mensual';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Reporte de Ventas - ${startDate}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            h2 { color: #374151; margin-top: 30px; }
            .summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .summary-card { background: #f3f4f6; padding: 15px 20px; border-radius: 8px; min-width: 150px; }
            .summary-card .label { color: #6b7280; font-size: 12px; }
            .summary-card .value { font-size: 24px; font-weight: bold; color: #059669; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f9fafb; font-weight: 600; }
            .revenue { color: #059669; font-weight: 600; }
            .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Reporte de Ventas - ${periodLabel}</h1>
          <p>Período: ${report.start_date} al ${report.end_date}</p>

          <div class="summary">
            <div class="summary-card">
              <div class="label">Ingresos Totales</div>
              <div class="value">${formatCurrency(report.summary.total_revenue)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Transacciones</div>
              <div class="value" style="color: #3b82f6;">${report.summary.total_sales}</div>
            </div>
            <div class="summary-card">
              <div class="label">Ticket Promedio</div>
              <div class="value" style="color: #8b5cf6;">${formatCurrency(report.summary.average_ticket)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Impuestos</div>
              <div class="value" style="color: #f59e0b;">${formatCurrency(report.summary.total_tax)}</div>
            </div>
          </div>

          <h2>Top Productos</h2>
          <table>
            <thead>
              <tr><th>#</th><th>Producto</th><th>Cantidad</th><th>Ingresos</th></tr>
            </thead>
            <tbody>
              ${report.top_products?.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.name}</td>
                  <td>${p.quantity_sold}</td>
                  <td class="revenue">${formatCurrency(p.revenue)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
            </tbody>
          </table>

          <h2>Top Categorías</h2>
          <table>
            <thead>
              <tr><th>#</th><th>Categoría</th><th>Cantidad</th><th>Ingresos</th></tr>
            </thead>
            <tbody>
              ${report.top_categories?.map((c, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${c.name}</td>
                  <td>${c.quantity_sold}</td>
                  <td class="revenue">${formatCurrency(c.revenue)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
            </tbody>
          </table>

          <h2>Top Vendedores</h2>
          <table>
            <thead>
              <tr><th>#</th><th>Vendedor</th><th>Ventas</th><th>Ingresos</th></tr>
            </thead>
            <tbody>
              ${report.top_sellers?.map((s, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${s.name}</td>
                  <td>${s.sales_count}</td>
                  <td class="revenue">${formatCurrency(s.revenue)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
            </tbody>
          </table>

          <div class="footer">
            Generado el ${new Date().toLocaleString('es-CO')}
          </div>
        </body>
        </html>
      `;

      // Open print dialog
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
        toast.success('PDF listo para imprimir/guardar');
      } else {
        toast.error('No se pudo abrir la ventana de impresión');
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      toast.error('Error al generar PDF');
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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="secondary" onClick={handleExportPDF}>
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
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
                    {formatCurrency(report.summary.total_revenue)}
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
                  <p className="text-2xl font-bold">{report.summary.total_sales}</p>
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
                    {formatCurrency(report.summary.average_ticket)}
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
                {report.top_products && report.top_products.length > 0 ? (
                  <div className="space-y-3">
                    {report.top_products.map((product, i) => (
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
                              {product.quantity_sold} vendidos
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
                {report.top_categories && report.top_categories.length > 0 ? (
                  <div className="space-y-3">
                    {report.top_categories.map((cat, i) => (
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
                              {cat.quantity_sold} unidades
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
                {report.top_sellers && report.top_sellers.length > 0 ? (
                  <div className="space-y-3">
                    {report.top_sellers.map((seller, i) => (
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
                              {seller.sales_count} ventas
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
