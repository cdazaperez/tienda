import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, AlertTriangle, User, Package, ShoppingCart, Settings } from 'lucide-react';
import { auditApi } from '../services/api';
import { AuditLog } from '../types';

export function AuditPage() {
  const [filters, setFilters] = useState({
    entity: '',
    action: '',
  });

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: async () => {
      const response = await auditApi.getAll({
        ...filters,
        entity: filters.entity || undefined,
        action: filters.action || undefined,
        limit: 100,
      });
      return response.data;
    },
  });

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'product':
        return <Package className="w-4 h-4" />;
      case 'sale':
        return <ShoppingCart className="w-4 h-4" />;
      case 'store_config':
        return <Settings className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('LOGIN'))
      return 'text-green-600 bg-green-50 dark:bg-green-900/20';
    if (action.includes('UPDATE') || action.includes('CHANGE'))
      return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
    if (action.includes('DELETE') || action.includes('VOID'))
      return 'text-red-600 bg-red-50 dark:bg-red-900/20';
    return 'text-gray-600 bg-gray-50 dark:bg-gray-700';
  };

  const logs = auditData?.data as AuditLog[] | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Auditoría
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Registro de actividades del sistema
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <select
            className="input w-auto"
            value={filters.entity}
            onChange={(e) => setFilters({ ...filters, entity: e.target.value })}
          >
            <option value="">Todas las entidades</option>
            <option value="user">Usuarios</option>
            <option value="product">Productos</option>
            <option value="sale">Ventas</option>
            <option value="category">Categorías</option>
            <option value="store_config">Configuración</option>
          </select>
          <select
            className="input w-auto"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">Todas las acciones</option>
            <option value="CREATE">Crear</option>
            <option value="UPDATE">Actualizar</option>
            <option value="DELETE">Eliminar</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="SALE_CREATE">Venta</option>
            <option value="SALE_VOID">Anulación</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Descripción</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    Cargando...
                  </td>
                </tr>
              ) : logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">
                      <div>
                        <p className="font-medium">
                          {new Date(log.createdAt).toLocaleDateString('es-CO')}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleTimeString('es-CO')}
                        </p>
                      </div>
                    </td>
                    <td>
                      {log.user ? (
                        <div>
                          <p className="font-medium">
                            {log.user.firstName} {log.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sistema</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {getEntityIcon(log.entity)}
                        <span className="capitalize">{log.entity}</span>
                      </div>
                    </td>
                    <td>
                      <p className="max-w-xs truncate" title={log.description || ''}>
                        {log.description || '-'}
                      </p>
                    </td>
                    <td className="text-sm text-gray-500">
                      {log.ipAddress || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No hay registros de auditoría
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
