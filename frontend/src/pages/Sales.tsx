import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Search, Eye, XCircle, Printer } from 'lucide-react';
import { saleApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Sale, PaginatedResponse } from '../types';

export function SalesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await saleApi.getAll({ page_size: 100 });
      return response.data as PaginatedResponse<Sale>;
    },
  });

  const voidMutation = useMutation({
    mutationFn: () => saleApi.void(selectedSale!.id, voidReason),
    onSuccess: () => {
      toast.success('Venta anulada');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      setShowVoidModal(false);
      setVoidReason('');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al anular venta');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="badge badge-success">Completada</span>;
      case 'VOIDED':
        return <span className="badge badge-danger">Anulada</span>;
      case 'PARTIALLY_RETURNED':
        return <span className="badge badge-warning">Devolución Parcial</span>;
      case 'FULLY_RETURNED':
        return <span className="badge badge-info">Devuelta</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      MIXED: 'Mixto',
    };
    return methods[method] || method;
  };

  const handlePrint = async (saleId: string) => {
    try {
      const response = await saleApi.getReceiptHTML(saleId);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(response.data);
        printWindow.document.close();
        printWindow.focus();
      }
    } catch {
      toast.error('Error al obtener el recibo');
    }
  };

  const sales = salesData?.items || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {isAdmin ? 'Ventas' : 'Mis Ventas'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Historial de transacciones
        </p>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por # de recibo..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Recibo</th>
                <th>Fecha</th>
                <th>Vendedor</th>
                <th>Items</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    Cargando...
                  </td>
                </tr>
              ) : sales && sales.length > 0 ? (
                sales
                  .filter((s) =>
                    searchTerm
                      ? s.receipt_number.toString().includes(searchTerm)
                      : true
                  )
                  .map((sale) => (
                    <tr key={sale.id}>
                      <td className="font-semibold">#{sale.receipt_number}</td>
                      <td>
                        {new Date(sale.created_at).toLocaleDateString('es-CO')}{' '}
                        <span className="text-gray-500">
                          {new Date(sale.created_at).toLocaleTimeString('es-CO', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td>{sale.user_name || 'N/A'}</td>
                      <td>{sale.items?.length || 0}</td>
                      <td className="font-semibold text-green-600">
                        {formatCurrency(sale.total)}
                      </td>
                      <td>{getPaymentMethod(sale.payment_method)}</td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedSale(sale);
                              setShowDetailModal(true);
                            }}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Ver detalle"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrint(sale.id)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Imprimir"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {isAdmin && sale.status === 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setSelectedSale(sale);
                                setShowVoidModal(true);
                              }}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded"
                              title="Anular"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No hay ventas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Venta #${selectedSale?.receipt_number}`}
        size="lg"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Fecha</p>
                <p className="font-medium">
                  {new Date(selectedSale.created_at).toLocaleString('es-CO')}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Vendedor</p>
                <p className="font-medium">
                  {selectedSale.user_name || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Estado</p>
                {getStatusBadge(selectedSale.status)}
              </div>
              <div>
                <p className="text-gray-500">Método de Pago</p>
                <p className="font-medium">
                  {getPaymentMethod(selectedSale.payment_method)}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Items</h4>
              <div className="space-y-2">
                {selectedSale.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    <div>
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                        {parseFloat(item.discount_percent) > 0 &&
                          ` (-${item.discount_percent}%)`}
                      </p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedSale.subtotal)}</span>
              </div>
              {parseFloat(selectedSale.discount_amount) > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Descuento</span>
                  <span>-{formatCurrency(selectedSale.discount_amount)}</span>
                </div>
              )}
              {parseFloat(selectedSale.tax_amount) > 0 && (
                <div className="flex justify-between">
                  <span>Impuestos</span>
                  <span>{formatCurrency(selectedSale.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total</span>
                <span className="text-green-600">
                  {formatCurrency(selectedSale.total)}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span>Monto Pagado</span>
                <span>{formatCurrency(selectedSale.amount_paid)}</span>
              </div>
              {parseFloat(selectedSale.change_amount) > 0 && (
                <div className="flex justify-between">
                  <span>Cambio</span>
                  <span>{formatCurrency(selectedSale.change_amount)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => handlePrint(selectedSale.id)}
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        title="Anular Venta"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Está seguro de anular la venta <strong>#{selectedSale?.receipt_number}</strong>?
          </p>
          <p className="text-gray-600">
            Total: <strong>{selectedSale && formatCurrency(selectedSale.total)}</strong>
          </p>
          <div>
            <label className="label">Motivo de anulación *</label>
            <textarea
              className="input"
              rows={3}
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Indique el motivo de la anulación..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowVoidModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => voidMutation.mutate()}
              isLoading={voidMutation.isPending}
              disabled={!voidReason}
            >
              Anular Venta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
