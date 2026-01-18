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
} from 'lucide-react';
import { configApi } from '../services/api';
import { useConfigStore } from '../store/configStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StoreConfig } from '../types';

interface ConfigForm {
  storeName: string;
  storeNit?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  darkMode: boolean;
  allowNegativeStock: boolean;
  maxLoginAttempts: number;
  lockoutMinutes: number;
  defaultTaxRate: number;
  receiptFooter?: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { setConfig } = useConfigStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await configApi.get();
      return response.data.data as StoreConfig;
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ConfigForm>({
    values: config
      ? {
          storeName: config.storeName,
          storeNit: config.storeNit || '',
          storeAddress: config.storeAddress || '',
          storePhone: config.storePhone || '',
          storeEmail: config.storeEmail || '',
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          accentColor: config.accentColor,
          darkMode: config.darkMode,
          allowNegativeStock: config.allowNegativeStock,
          maxLoginAttempts: config.maxLoginAttempts,
          lockoutMinutes: config.lockoutMinutes,
          defaultTaxRate: parseFloat(config.defaultTaxRate),
          receiptFooter: config.receiptFooter || '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ConfigForm) => configApi.update(data),
    onSuccess: (response) => {
      toast.success('Configuración guardada');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setConfig(response.data.data);
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al guardar');
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => configApi.uploadLogo(file),
    onSuccess: (response) => {
      toast.success('Logo actualizado');
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setConfig({ logoUrl: response.data.data.logoUrl });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al subir logo');
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
                  {config?.logoUrl ? (
                    <img
                      src={config.logoUrl}
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
                error={errors.storeName?.message}
                {...register('storeName', { required: 'Nombre requerido' })}
              />
              <Input
                label="NIT / Identificación"
                {...register('storeNit')}
              />
            </div>

            <Input
              label="Dirección"
              {...register('storeAddress')}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Teléfono"
                {...register('storePhone')}
              />
              <Input
                label="Email"
                type="email"
                {...register('storeEmail')}
              />
            </div>

            <div>
              <label className="label">Texto del pie del recibo</label>
              <textarea
                className="input"
                rows={2}
                placeholder="¡Gracias por su compra!"
                {...register('receiptFooter')}
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
                    {...register('primaryColor')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('primaryColor')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Color Secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer"
                    {...register('secondaryColor')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('secondaryColor')}
                  />
                </div>
              </div>
              <div>
                <label className="label">Color de Acento</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-10 rounded cursor-pointer"
                    {...register('accentColor')}
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    {...register('accentColor')}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="darkMode"
                className="w-4 h-4 rounded"
                {...register('darkMode')}
              />
              <label htmlFor="darkMode" className="text-sm">
                Modo Oscuro
              </label>
            </div>
          </div>
        </div>

        {/* Security & Business */}
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            <h2 className="font-semibold">Seguridad y Negocio</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Intentos máximos de login"
                type="number"
                min={1}
                max={20}
                {...register('maxLoginAttempts', { valueAsNumber: true })}
              />
              <Input
                label="Minutos de bloqueo"
                type="number"
                min={1}
                max={1440}
                {...register('lockoutMinutes', { valueAsNumber: true })}
              />
              <Input
                label="Tasa de impuesto por defecto"
                type="number"
                step="0.01"
                min={0}
                max={1}
                {...register('defaultTaxRate', { valueAsNumber: true })}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="allowNegativeStock"
                className="w-4 h-4 rounded"
                {...register('allowNegativeStock')}
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
