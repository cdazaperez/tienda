import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Building2,
  ShoppingCart,
  Percent,
  Printer,
} from 'lucide-react';
import { productApi, saleApi } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Product, PaymentMethod } from '../types';

export function POSPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const {
    items,
    globalDiscountPercent,
    addItem,
    removeItem,
    updateQuantity,
    updateDiscount,
    setGlobalDiscount,
    clearCart,
    getSubtotal,
    getTaxAmount,
    getTotal,
    getItemCount,
  } = useCartStore();

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['product-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const response = await productApi.search(searchTerm);
      return response.data as Product[];
    },
    enabled: searchTerm.length >= 2,
  });

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const saleData = {
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          discount_percent: item.discount_percent,
        })),
        payment_method: paymentMethod,
        amount_paid: parseFloat(amountPaid),
        discount_percent: globalDiscountPercent,
        notes: saleNotes || undefined,
      };
      return saleApi.create(saleData);
    },
    onSuccess: async (response) => {
      toast.success('Venta registrada exitosamente');
      clearCart();
      setShowPaymentModal(false);
      setAmountPaid('');
      setSaleNotes('');
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });

      // Abrir recibo en nueva ventana
      const saleId = response.data.id;
      window.open(`/api/sales/${saleId}/receipt/html?print=true`, '_blank');
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al procesar la venta');
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleAddProduct = (product: Product) => {
    if (product.current_stock <= 0) {
      toast.error('Producto sin stock disponible');
      return;
    }

    const existingItem = items.find((item) => item.product.id === product.id);
    if (existingItem && existingItem.quantity >= product.current_stock) {
      toast.error(`Solo hay ${product.current_stock} unidades disponibles`);
      return;
    }

    addItem(product);
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  const handleConfirmSale = () => {
    const total = getTotal();
    const paid = parseFloat(amountPaid);

    if (paymentMethod === 'CASH' && paid < total) {
      toast.error('El monto pagado es insuficiente');
      return;
    }

    createSaleMutation.mutate();
  };

  useEffect(() => {
    if (showPaymentModal) {
      setAmountPaid(getTotal().toFixed(0));
    }
  }, [showPaymentModal, getTotal]);

  const subtotal = getSubtotal();
  const taxAmount = getTaxAmount();
  const total = getTotal();
  const globalDiscount = subtotal * (globalDiscountPercent / 100);
  const changeAmount =
    paymentMethod === 'CASH' ? Math.max(0, parseFloat(amountPaid || '0') - total) : 0;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4">
      {/* Product Search Panel */}
      <div className="lg:w-2/3 flex flex-col">
        {/* Search */}
        <div className="card p-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por nombre, SKU o código de barras..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {/* Search Results */}
          {searchTerm.length >= 2 && (
            <div className="mt-4 max-h-60 overflow-y-auto">
              {isSearching ? (
                <p className="text-center text-gray-500 py-4">Buscando...</p>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          SKU: {product.sku} | Stock: {product.current_stock}
                        </p>
                      </div>
                      <span className="font-semibold text-primary-600">
                        {formatCurrency(parseFloat(product.sale_price))}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No se encontraron productos
                </p>
              )}
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div className="card flex-1 overflow-hidden flex flex-col">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito ({getItemCount()} items)
            </h2>
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="w-4 h-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-4" />
                <p>El carrito está vacío</p>
                <p className="text-sm">Busca productos para agregar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const price = parseFloat(item.product.sale_price);
                  const lineTotal =
                    price * item.quantity * (1 - item.discount_percent / 100);

                  return (
                    <div
                      key={item.product.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatCurrency(price)} c/u
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.product.id, item.quantity - 1)
                            }
                            className="p-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              if (item.quantity < item.product.current_stock) {
                                updateQuantity(item.product.id, item.quantity + 1);
                              } else {
                                toast.error('Stock insuficiente');
                              }
                            }}
                            className="p-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Discount */}
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-gray-400" />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount_percent || ''}
                            onChange={(e) =>
                              updateDiscount(
                                item.product.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-16 px-2 py-1 text-sm border rounded"
                            placeholder="0"
                          />
                        </div>

                        <span className="font-semibold text-primary-600">
                          {formatCurrency(lineTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Panel */}
      <div className="lg:w-1/3">
        <div className="card h-full flex flex-col">
          <div className="card-header">
            <h2 className="font-semibold">Resumen de Venta</h2>
          </div>

          <div className="card-body flex-1 flex flex-col">
            {/* Global Discount */}
            <div className="mb-4">
              <label className="label">Descuento Global (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={globalDiscountPercent || ''}
                onChange={(e) =>
                  setGlobalDiscount(parseFloat(e.target.value) || 0)
                }
                className="input"
                placeholder="0"
              />
            </div>

            {/* Totals */}
            <div className="space-y-3 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              {globalDiscount > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Descuento ({globalDiscountPercent}%)</span>
                  <span>-{formatCurrency(globalDiscount)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Impuestos</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}

              <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white pt-3 border-t border-gray-200 dark:border-gray-700">
                <span>TOTAL</span>
                <span className="text-primary-600">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Button */}
            <div className="mt-auto">
              <Button
                className="w-full"
                size="lg"
                onClick={() => setShowPaymentModal(true)}
                disabled={items.length === 0}
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Procesar Pago
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Procesar Pago"
        size="md"
      >
        <div className="space-y-6">
          {/* Payment Method */}
          <div>
            <label className="label">Método de Pago</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPaymentMethod('CASH')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                  paymentMethod === 'CASH'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Banknote className="w-6 h-6" />
                <span className="text-sm font-medium">Efectivo</span>
              </button>
              <button
                onClick={() => setPaymentMethod('CARD')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                  paymentMethod === 'CARD'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span className="text-sm font-medium">Tarjeta</span>
              </button>
              <button
                onClick={() => setPaymentMethod('TRANSFER')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
                  paymentMethod === 'TRANSFER'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Building2 className="w-6 h-6" />
                <span className="text-sm font-medium">Transferencia</span>
              </button>
            </div>
          </div>

          {/* Amount Paid */}
          <div>
            <Input
              label="Monto Recibido"
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              min={total}
              step="100"
            />
          </div>

          {/* Change */}
          {paymentMethod === 'CASH' && changeAmount > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Cambio</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(changeAmount)}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              className="input"
              rows={2}
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="Agregar notas a la venta..."
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span>Total a Pagar</span>
              <span className="text-primary-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowPaymentModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmSale}
              isLoading={createSaleMutation.isPending}
            >
              <Printer className="w-4 h-4 mr-2" />
              Confirmar Venta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
