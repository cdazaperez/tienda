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
  Package,
  Grid3X3,
  List,
  Receipt,
} from 'lucide-react';
import { productApi, saleApi, categoryApi } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { useConfigStore } from '../store/configStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Product, PaymentMethod, Category } from '../types';

export function POSPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'search'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [applyTax, setApplyTax] = useState<boolean | null>(null); // null = usar config
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { config } = useConfigStore();

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

  // Obtener categorías
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryApi.getAll(true);
      return response.data as Category[];
    },
  });

  // Obtener productos para el grid
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['pos-products', selectedCategory],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: 1,
        page_size: 100,
        active: true,
      };
      if (selectedCategory) {
        params.category_id = selectedCategory;
      }
      const response = await productApi.getAll(params as never);
      return response.data;
    },
  });

  // Búsqueda de productos
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['product-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const response = await productApi.search(searchTerm);
      return response.data as Product[];
    },
    enabled: searchTerm.length >= 2,
  });

  // Calcular si aplicar impuesto
  const shouldApplyTax = applyTax !== null ? applyTax : (config?.tax_enabled ?? true);
  const taxRate = shouldApplyTax ? parseFloat(config?.tax_rate || '0.19') : 0;
  const taxName = config?.tax_name || 'IVA';

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
        apply_tax: applyTax,
        notes: saleNotes || undefined,
      };
      return saleApi.create(saleData);
    },
    onSuccess: async (response) => {
      toast.success('Venta registrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });

      // Obtener el recibo HTML con autenticación
      const saleId = response.data.id;
      try {
        const receiptResponse = await saleApi.getReceiptHTML(saleId);
        setReceiptHtml(receiptResponse.data);
        setShowPaymentModal(false);
        setShowReceiptModal(true);
      } catch {
        // Si falla, mostrar mensaje pero limpiar carrito
        toast.error('Venta registrada pero no se pudo obtener el recibo');
        setShowPaymentModal(false);
      }

      clearCart();
      setAmountPaid('');
      setSaleNotes('');
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
    toast.success(`${product.name} agregado`);
    setSearchTerm('');
  };

  const handleConfirmSale = () => {
    const paid = parseFloat(amountPaid);
    const sub = getSubtotal();
    const discount = sub * (globalDiscountPercent / 100);
    const afterDiscount = sub - discount;
    const tax = shouldApplyTax ? afterDiscount * taxRate : 0;
    const saleTotal = afterDiscount + tax;

    if (paymentMethod === 'CASH' && paid < saleTotal) {
      toast.error('El monto pagado es insuficiente');
      return;
    }

    createSaleMutation.mutate();
  };

  const handlePrintReceipt = () => {
    // Abrir una ventana nueva con el recibo para imprimir
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      // El script en el HTML ya dispara window.print()
    }
  };

  useEffect(() => {
    if (showPaymentModal) {
      const sub = getSubtotal();
      const discount = sub * (globalDiscountPercent / 100);
      const afterDiscount = sub - discount;
      const tax = shouldApplyTax ? afterDiscount * taxRate : 0;
      setAmountPaid((afterDiscount + tax).toFixed(0));
    }
  }, [showPaymentModal, getSubtotal, globalDiscountPercent, shouldApplyTax, taxRate]);

  const subtotal = getSubtotal();
  const globalDiscount = subtotal * (globalDiscountPercent / 100);
  const subtotalAfterDiscount = subtotal - globalDiscount;
  const taxAmount = shouldApplyTax ? subtotalAfterDiscount * taxRate : 0;
  const total = subtotalAfterDiscount + taxAmount;
  const changeAmount =
    paymentMethod === 'CASH' ? Math.max(0, parseFloat(amountPaid || '0') - total) : 0;

  const products = productsData?.items || [];

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4">
      {/* Product Selection Panel */}
      <div className="lg:w-2/3 flex flex-col">
        {/* Search and View Toggle */}
        <div className="card p-4 mb-4">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, SKU o código de barras..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value.length >= 2) {
                    setViewMode('search');
                  }
                }}
                onFocus={() => searchTerm.length >= 2 && setViewMode('search')}
              />
            </div>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => {
                  setViewMode('grid');
                  setSearchTerm('');
                }}
                className={`p-2 rounded ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 shadow'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Vista de grilla"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('search')}
                className={`p-2 rounded ${
                  viewMode === 'search'
                    ? 'bg-white dark:bg-gray-600 shadow'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Vista de búsqueda"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Category Filter - Only in grid mode */}
          {viewMode === 'grid' && categories && categories.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {viewMode === 'search' && searchTerm.length >= 2 && (
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

        {/* Product Grid or Cart based on view mode */}
        {viewMode === 'grid' ? (
          <div className="card flex-1 overflow-hidden flex flex-col">
            <div className="card-header flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos ({products.length})
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingProducts ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Cargando productos...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Package className="w-16 h-16 mb-4" />
                  <p>No hay productos disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((product: Product) => {
                    const inCart = items.find((item) => item.product.id === product.id);
                    const outOfStock = product.current_stock <= 0;
                    const maxReached = inCart && inCart.quantity >= product.current_stock;

                    return (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        disabled={outOfStock || maxReached}
                        className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                          outOfStock || maxReached
                            ? 'border-gray-200 bg-gray-100 dark:bg-gray-800 dark:border-gray-700 opacity-60 cursor-not-allowed'
                            : inCart
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {inCart && (
                          <span className="absolute -top-2 -right-2 w-6 h-6 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {inCart.quantity}
                          </span>
                        )}
                        <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2 mb-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {product.sku}
                        </p>
                        <div className="flex justify-between items-end">
                          <span className="font-bold text-primary-600">
                            {formatCurrency(parseFloat(product.sale_price))}
                          </span>
                          <span className={`text-xs ${
                            product.current_stock <= (product.min_stock || 5)
                              ? 'text-orange-500'
                              : 'text-gray-400'
                          }`}>
                            {product.current_stock} und
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Cart Items in search mode */
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
        )}
      </div>

      {/* Payment Panel */}
      <div className="lg:w-1/3">
        <div className="card h-full flex flex-col">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito ({getItemCount()})
            </h2>
            {items.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          <div className="card-body flex-1 flex flex-col overflow-hidden">
            {/* Cart Items Summary */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Carrito vacío</p>
                </div>
              ) : (
                items.map((item) => {
                  const price = parseFloat(item.product.sale_price);
                  const lineTotal = price * item.quantity * (1 - item.discount_percent / 100);

                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => {
                              if (item.quantity < item.product.current_stock) {
                                updateQuantity(item.product.id, item.quantity + 1);
                              }
                            }}
                            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="truncate">{item.product.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(lineTotal)}</span>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Global Discount */}
            <div className="mb-4">
              <label className="label text-sm">Descuento Global (%)</label>
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

            {/* Tax Toggle */}
            <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">
                  {taxName} ({(taxRate * 100).toFixed(0)}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setApplyTax(prev => prev === null ? !config?.tax_enabled : !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  shouldApplyTax
                    ? 'bg-primary-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    shouldApplyTax ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Totals */}
            <div className="space-y-2 py-4 border-t border-gray-200 dark:border-gray-700">
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

              {shouldApplyTax && taxAmount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{taxName} ({(taxRate * 100).toFixed(0)}%)</span>
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

      {/* Receipt Modal */}
      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Recibo de Venta"
        size="md"
      >
        <div className="space-y-4">
          <div
            className="bg-white p-4 rounded border max-h-96 overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: receiptHtml }}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowReceiptModal(false)}
            >
              Cerrar
            </Button>
            <Button className="flex-1" onClick={handlePrintReceipt}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
