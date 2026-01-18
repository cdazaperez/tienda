import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Package, ArrowUp, ArrowDown, AlertTriangle, Search } from 'lucide-react';
import { inventoryApi, productApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Product, InventoryMovement, PaginatedResponse } from '../types';

export function InventoryPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryCost, setEntryCost] = useState('');
  const [entryReason, setEntryReason] = useState('');
  const [adjustStock, setAdjustStock] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchTerm],
    queryFn: async () => {
      const response = await productApi.getAll({
        search: searchTerm || undefined,
        active: true,
        page_size: 100,
      });
      return response.data as PaginatedResponse<Product>;
    },
  });

  const products = productsData?.items || [];

  const { data: lowStock } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const response = await inventoryApi.getLowStock();
      return response.data as Product[];
    },
  });

  const { data: movementsData } = useQuery({
    queryKey: ['movements', selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct) return { items: [] };
      const response = await inventoryApi.getMovements(selectedProduct.id, { page_size: 20 });
      return response.data as { items: InventoryMovement[] };
    },
    enabled: !!selectedProduct,
  });

  const movements = movementsData?.items || [];

  const entryMutation = useMutation({
    mutationFn: () =>
      inventoryApi.addEntry(selectedProduct!.id, {
        quantity: parseInt(entryQuantity),
        reason: entryReason || undefined,
      }),
    onSuccess: () => {
      toast.success('Entrada registrada');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setShowEntryModal(false);
      resetForms();
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al registrar entrada');
    },
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      inventoryApi.adjustStock(selectedProduct!.id, {
        new_stock: parseInt(adjustStock),
        reason: adjustReason,
      }),
    onSuccess: () => {
      toast.success('Ajuste registrado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      setShowAdjustModal(false);
      resetForms();
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al ajustar stock');
    },
  });

  const resetForms = () => {
    setEntryQuantity('');
    setEntryCost('');
    setEntryReason('');
    setAdjustStock('');
    setAdjustReason('');
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'ENTRY':
      case 'RETURN':
      case 'VOID':
        return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'SALE':
        return <ArrowDown className="w-4 h-4 text-red-500" />;
      default:
        return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  const getMovementLabel = (type: string) => {
    const labels: Record<string, string> = {
      ENTRY: 'Entrada',
      SALE: 'Venta',
      ADJUSTMENT: 'Ajuste',
      RETURN: 'Devolución',
      VOID: 'Anulación',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Inventario
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Control de existencias y movimientos
        </p>
      </div>

      {/* Low Stock Alert */}
      {lowStock && lowStock.length > 0 && (
        <div className="card p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-orange-700 dark:text-orange-400">
              {lowStock.length} productos con bajo stock
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-sm"
              >
                {p.name}: {p.current_stock} unid.
              </span>
            ))}
            {lowStock.length > 5 && (
              <span className="text-sm text-orange-600">
                +{lowStock.length - 5} más
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products List */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8">
                      Cargando...
                    </td>
                  </tr>
                ) : products && products.length > 0 ? (
                  products.map((product) => (
                    <tr
                      key={product.id}
                      className={`cursor-pointer ${
                        selectedProduct?.id === product.id
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : ''
                      }`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <td>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.sku}</p>
                      </td>
                      <td>
                        <span
                          className={`font-semibold ${
                            product.current_stock <= product.min_stock
                              ? 'text-red-600'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {product.current_stock}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {' '}
                          / mín: {product.min_stock}
                        </span>
                      </td>
                      <td>
                        {product.current_stock <= product.min_stock ? (
                          <span className="badge badge-warning">Bajo</span>
                        ) : (
                          <span className="badge badge-success">OK</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(product);
                                setShowEntryModal(true);
                              }}
                            >
                              Entrada
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProduct(product);
                                setAdjustStock(product.current_stock.toString());
                                setShowAdjustModal(true);
                              }}
                            >
                              Ajustar
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Movements Panel */}
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Movimientos</h3>
            {selectedProduct && (
              <p className="text-sm text-gray-500">{selectedProduct.name}</p>
            )}
          </div>
          <div className="card-body">
            {!selectedProduct ? (
              <p className="text-center text-gray-500 py-8">
                Selecciona un producto para ver sus movimientos
              </p>
            ) : movements && movements.length > 0 ? (
              <div className="space-y-3">
                {movements.map((mov) => (
                  <div
                    key={mov.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    {getMovementIcon(mov.type)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {getMovementLabel(mov.type)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(mov.created_at).toLocaleString('es-CO')}
                      </p>
                      {mov.reason && (
                        <p className="text-xs text-gray-500 mt-1">
                          {mov.reason}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          mov.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {mov.quantity > 0 ? '+' : ''}
                        {mov.quantity}
                      </p>
                      <p className="text-xs text-gray-500">
                        {mov.previous_stock} → {mov.new_stock}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Sin movimientos registrados
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      <Modal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        title="Registrar Entrada"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Producto: <strong>{selectedProduct?.name}</strong>
          </p>
          <Input
            label="Cantidad *"
            type="number"
            min={1}
            value={entryQuantity}
            onChange={(e) => setEntryQuantity(e.target.value)}
          />
          <Input
            label="Costo Unitario"
            type="number"
            step="100"
            value={entryCost}
            onChange={(e) => setEntryCost(e.target.value)}
          />
          <div>
            <label className="label">Motivo (opcional)</label>
            <textarea
              className="input"
              rows={2}
              value={entryReason}
              onChange={(e) => setEntryReason(e.target.value)}
              placeholder="Compra, reabastecimiento, etc."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowEntryModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => entryMutation.mutate()}
              isLoading={entryMutation.isPending}
              disabled={!entryQuantity || parseInt(entryQuantity) <= 0}
            >
              Registrar Entrada
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Modal */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Ajustar Inventario"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Producto: <strong>{selectedProduct?.name}</strong>
          </p>
          <p className="text-gray-600">
            Stock actual: <strong>{selectedProduct?.current_stock}</strong>
          </p>
          <Input
            label="Nuevo Stock *"
            type="number"
            min={0}
            value={adjustStock}
            onChange={(e) => setAdjustStock(e.target.value)}
          />
          <div>
            <label className="label">Motivo *</label>
            <textarea
              className="input"
              rows={2}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Inventario físico, pérdida, error, etc."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAdjustModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => adjustMutation.mutate()}
              isLoading={adjustMutation.isPending}
              disabled={!adjustStock || !adjustReason}
            >
              Ajustar Stock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
