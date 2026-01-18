import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Filter,
} from 'lucide-react';
import { productApi, categoryApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Product, Category } from '../types';

interface ProductForm {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId: string;
  brand?: string;
  size?: string;
  color?: string;
  salePrice: number;
  costPrice?: number;
  taxRate?: number;
  unit: string;
  minStock: number;
  currentStock: number;
}

export function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const { register, handleSubmit, reset, setValue, formState: { errors } } =
    useForm<ProductForm>();

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', searchTerm, categoryFilter],
    queryFn: async () => {
      const response = await productApi.getAll({
        search: searchTerm || undefined,
        categoryId: categoryFilter || undefined,
        limit: 100,
      });
      return response.data.data as Product[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryApi.getAll(true);
      return response.data.data as Category[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ProductForm) => productApi.create(data),
    onSuccess: () => {
      toast.success('Producto creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al crear producto');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductForm> }) =>
      productApi.update(id, data),
    onSuccess: () => {
      toast.success('Producto actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al actualizar producto');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      toast.success('Producto desactivado');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al eliminar producto');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    reset();
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setValue('sku', product.sku);
    setValue('barcode', product.barcode || '');
    setValue('name', product.name);
    setValue('description', product.description || '');
    setValue('categoryId', product.categoryId);
    setValue('brand', product.brand || '');
    setValue('size', product.size || '');
    setValue('color', product.color || '');
    setValue('salePrice', parseFloat(product.salePrice));
    setValue('costPrice', product.costPrice ? parseFloat(product.costPrice) : undefined);
    setValue('taxRate', parseFloat(product.taxRate));
    setValue('unit', product.unit);
    setValue('minStock', product.minStock);
    setValue('currentStock', product.currentStock);
    setShowModal(true);
  };

  const onSubmit = (data: ProductForm) => {
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Productos
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gestiona el catálogo de productos
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : products && products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </p>
                          {product.brand && (
                            <p className="text-sm text-gray-500">{product.brand}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm">{product.sku}</td>
                    <td>{product.category?.name || '-'}</td>
                    <td className="font-semibold">
                      {formatCurrency(product.salePrice)}
                    </td>
                    <td>
                      <span
                        className={`font-medium ${
                          product.currentStock <= product.minStock
                            ? 'text-red-600'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {product.currentStock}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {' '}
                        / mín: {product.minStock}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          product.isActive ? 'badge-success' : 'badge-danger'
                        }`}
                      >
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  '¿Está seguro de desactivar este producto?'
                                )
                              ) {
                                deleteMutation.mutate(product.id);
                              }
                            }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No se encontraron productos
          </div>
        )}
      </div>

      {/* Product Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="SKU *"
              error={errors.sku?.message}
              {...register('sku', { required: 'SKU requerido' })}
            />
            <Input
              label="Código de Barras"
              {...register('barcode')}
            />
          </div>

          <Input
            label="Nombre *"
            error={errors.name?.message}
            {...register('name', { required: 'Nombre requerido' })}
          />

          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input"
              rows={2}
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Categoría *</label>
              <select
                className="input"
                {...register('categoryId', { required: 'Categoría requerida' })}
              >
                <option value="">Seleccionar...</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Marca"
              {...register('brand')}
            />
            <Input
              label="Unidad"
              defaultValue="unidad"
              {...register('unit')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Talla"
              {...register('size')}
            />
            <Input
              label="Color"
              {...register('color')}
            />
            <Input
              label="Tasa de Impuesto"
              type="number"
              step="0.01"
              defaultValue={0.19}
              {...register('taxRate', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Precio de Venta *"
              type="number"
              step="100"
              error={errors.salePrice?.message}
              {...register('salePrice', {
                required: 'Precio requerido',
                valueAsNumber: true,
              })}
            />
            <Input
              label="Precio de Costo"
              type="number"
              step="100"
              {...register('costPrice', { valueAsNumber: true })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Stock Mínimo"
              type="number"
              defaultValue={0}
              {...register('minStock', { valueAsNumber: true })}
            />
            {!editingProduct && (
              <Input
                label="Stock Inicial"
                type="number"
                defaultValue={0}
                {...register('currentStock', { valueAsNumber: true })}
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingProduct ? 'Actualizar' : 'Crear'} Producto
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
