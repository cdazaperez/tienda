import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Store,
  Palette,
  Shield,
  Upload,
  Image,
  Receipt,
} from 'lucide-react';
import { configApi } from '../services/api';
import { useConfigStore } from '../store/configStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StoreConfig } from '../types';

interface ConfigForm {
  store_name: string;
  store_rut?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  tax_enabled: boolean;
  tax_rate: number;
  tax_name: string;
  dark_mode_default: boolean;
  allow_negative_stock: boolean;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  low_stock_threshold: number;
  receipt_footer?: string;
  currency_symbol: string;
  currency_code: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { setConfig } = useConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await configApi.get();
      return response.data as StoreConfig;
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ConfigForm>({
    values: config
      ? {
          store_name: config.store_name,
          store_rut: config.store_rut || '',
          store_address: config.store_address || '',
          store_phone: config.store_phone || '',
          store_email: config.store_email || '',
          primary_color: config.primary_color,
          secondary_color: config.secondary_color,
          accent_color: config.accent_color,
          tax_enabled: config.tax_enabled ?? true,
          tax_rate: (parseFloat(config.tax_rate) || 0.19) * 100,  // Mostrar como porcentaje
          tax_name: config.tax_name || 'IVA',
          dark_mode_default: config.dark_mode_default,
          allow_negative_stock: config.allow_negative_stock,
          max_failed_attempts: config.max_failed_attempts,
          lockout_duration_minutes: config.lockout_duration_minutes,
          low_stock_threshold: config.low_stock_threshold || 10,
          receipt_footer: config.receipt_footer || '',
          currency_symbol: config.currency_symbol || '$',
          currency_code: config.currency_code || 'COP',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ConfigForm) => configApi.update(data),
    onSuccess: (response) => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setConfig(response.data);
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al guardar');
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => configApi.uploadLogo(file),
    onSuccess: (response) => {
      toast.success('Logo actualizado');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setConfig({ logo_url: response.data.logo_url });
    },
    onError: (error: { response?: { data?: { detail?: string } } }) => {
      toast.error(error.response?.data?.detail || 'Error al subir logo');
    },
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo es muy grande (máx 5MB)');
        return;
      }
      uploadLogoMutation.mutate(file);
    }
  };

  const onSubmit = (data: ConfigForm) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Configuración
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Personaliza la apariencia y comportamiento de tu tienda
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Store Info */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Store className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Información de la Tienda</h2>
          </div>
          <div className="card-body space-y-4">
            {/* Logo Upload */}
            <div>
              <label className="label">Logo de la Tienda</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center overflow-hidden">
                  {config?.logo_url ? (
                    <img
                      src={config.logo_url}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={uploadLogoMutation.isPending}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Subir Logo
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG, GIF o WebP. Máx 5MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre de la Tienda"
                error={errors.store_name?.message}
                {...register('store_name', { required: 'Nombre requerido' })}
              />
              <Input
                label="NIT / RUT / Identificación"
                {...register('store_rut')}
              />
            </div>

            <Input
              label="Dirección"
              {...register('store_address')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                {...register('store_phone')}
              />
              <Input
                label="Email"
                type="email"
                {...register('store_email')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Símbolo de Moneda"
                {...register('currency_symbol')}
              />
              <Input
                label="Código de Moneda"
                placeholder="COP, USD, etc."
                {...register('currency_code')}
              />
            </div>

            <div>
              <label className="label">Texto del pie del recibo</label>
              <textarea
                className="input"
                rows={2}
                placeholder="¡Gracias por su compra!"
                {...register('receipt_footer')}
              />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Apariencia</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Color Primario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer"
                    {...register('primary_color')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('primary_color')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Color Secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer"
                    {...register('secondary_color')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('secondary_color')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Color de Acento</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer"
                    {...register('accent_color')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('accent_color')}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="darkMode"
                className="w-4 h-4 rounded"
                {...register('dark_mode_default')}
              />
              <label htmlFor="darkMode" className="text-sm">
                Modo Oscuro por defecto
              </label>
            </div>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Configuración de Impuestos</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input
                type="checkbox"
                id="taxEnabled"
                className="w-4 h-4 rounded"
                {...register('tax_enabled')}
              />
              <label htmlFor="taxEnabled" className="text-sm font-medium">
                Aplicar impuestos por defecto en ventas
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nombre del Impuesto"
                placeholder="Ej: IVA, IGV, ISV"
                {...register('tax_name')}
              />
              <div>
                <label className="label">Tasa de Impuesto (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="input"
                  {...register('tax_rate', {
                    valueAsNumber: true,
                    setValueAs: (v) => v / 100  // Convertir porcentaje a decimal
                  })}
                  placeholder="19"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ingrese el porcentaje (ej: 19 para 19%)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Business */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Seguridad e Inventario</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Intentos máximos de login"
                type="number"
                min={1}
                max={20}
                {...register('max_failed_attempts', { valueAsNumber: true })}
              />
              <Input
                label="Minutos de bloqueo"
                type="number"
                min={1}
                max={1440}
                {...register('lockout_duration_minutes', { valueAsNumber: true })}
              />
              <Input
                label="Umbral de stock bajo"
                type="number"
                min={0}
                {...register('low_stock_threshold', { valueAsNumber: true })}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="allowNegativeStock"
                className="w-4 h-4 rounded"
                {...register('allow_negative_stock')}
              />
              <label htmlFor="allowNegativeStock" className="text-sm">
                Permitir stock negativo (solo admins)
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end">
          <Button type="submit" isLoading={updateMutation.isPending}>
            Guardar Cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
