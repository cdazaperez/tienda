import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { Plus, Edit, UserCheck, UserX, Key, Users } from 'lucide-react';
import { userApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { User } from '../types';

interface UserForm {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'SELLER';
}

export function UsersPage() {
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, formState: { errors } } =
    useForm<UserForm>();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await userApi.getAll();
      return response.data.data as User[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: UserForm) => userApi.create(data),
    onSuccess: () => {
      toast.success('Usuario creado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al crear usuario');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserForm> }) =>
      userApi.update(id, data),
    onSuccess: () => {
      toast.success('Usuario actualizado');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      closeModal();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al actualizar');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => userApi.toggleActive(id),
    onSuccess: (response) => {
      toast.success(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => userApi.resetPassword(selectedUser!.id, newPassword),
    onSuccess: () => {
      toast.success('Contraseña reseteada');
      setShowPasswordModal(false);
      setNewPassword('');
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Error al resetear');
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    reset();
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setValue('email', user.email);
    setValue('username', user.username);
    setValue('firstName', user.firstName);
    setValue('lastName', user.lastName);
    setValue('role', user.role);
    setShowModal(true);
  };

  const onSubmit = (data: UserForm) => {
    if (editingUser) {
      const { password, ...updateData } = data;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Usuarios
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Gestión de usuarios del sistema
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Último Acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    Cargando...
                  </td>
                </tr>
              ) : users && users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          user.role === 'ADMIN' ? 'badge-info' : 'badge-success'
                        }`}
                      >
                        {user.role === 'ADMIN' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>
                    <td>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString('es-CO')
                        : 'Nunca'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          user.isActive ? 'badge-success' : 'badge-danger'
                        }`}
                      >
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowPasswordModal(true);
                          }}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Resetear contraseña"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate(user.id)}
                          className={`p-1.5 rounded ${
                            user.isActive
                              ? 'hover:bg-red-50 text-red-500'
                              : 'hover:bg-green-50 text-green-500'
                          }`}
                          title={user.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {user.isActive ? (
                            <UserX className="w-4 h-4" />
                          ) : (
                            <UserCheck className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No hay usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nombre *"
              error={errors.firstName?.message}
              {...register('firstName', { required: 'Requerido' })}
            />
            <Input
              label="Apellido *"
              error={errors.lastName?.message}
              {...register('lastName', { required: 'Requerido' })}
            />
          </div>
          <Input
            label="Email *"
            type="email"
            error={errors.email?.message}
            {...register('email', { required: 'Requerido' })}
          />
          <Input
            label="Usuario *"
            error={errors.username?.message}
            {...register('username', { required: 'Requerido' })}
          />
          {!editingUser && (
            <Input
              label="Contraseña *"
              type="password"
              error={errors.password?.message}
              {...register('password', {
                required: 'Requerido',
                minLength: { value: 8, message: 'Mínimo 8 caracteres' },
              })}
            />
          )}
          <div>
            <label className="label">Rol *</label>
            <select className="input" {...register('role', { required: true })}>
              <option value="SELLER">Vendedor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Resetear Contraseña"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Usuario: <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong>
          </p>
          <Input
            label="Nueva Contraseña *"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              isLoading={resetPasswordMutation.isPending}
              disabled={newPassword.length < 8}
            >
              Resetear
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
