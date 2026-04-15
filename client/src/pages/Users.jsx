import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Key, ToggleLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import { getUsers, createUser, updateUser, deactivateUser, resetPassword, changeRole } from '../services/userService';
import usePageTitle from '../hooks/usePageTitle';
import Table from '../components/common/Table';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Badge from '../components/common/Badge';
import { ROLES_OPTIONS, ROLE_COLORS } from '../utils/constants';
import { formatDate } from '../utils/dateFormat';

const UserForm = ({ user, onSuccess, onClose }) => {
  const qc = useQueryClient();
  const isEdit = !!user;

  const { register, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: user ? { fullName: user.fullName, email: user.email, mobile: user.mobile, username: user.username, role: user.role, status: user.status } : { role: 'data-entry', status: 'active' },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateUser(user._id, data) : createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(`User ${isEdit ? 'updated' : 'created'}`);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save user'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Full Name" required error={errors.fullName?.message} {...register('fullName', { required: 'Required' })} />
        <Input label="Username" required error={errors.username?.message} {...register('username', { required: 'Required' })} />
        <Input label="Email" type="email" required error={errors.email?.message} {...register('email', { required: 'Required' })} />
        <Input label="Mobile" type="tel" error={errors.mobile?.message} {...register('mobile', { pattern: { value: /^\d{10}$/, message: '10 digits' } })} />
        {!isEdit && (
          <Input label="Password" type="password" required placeholder="Min 8 characters"
            error={errors.password?.message}
            {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
        )}
        <div>
          <label className="label-base">Role<span className="text-danger-500 ml-0.5">*</span></label>
          <select className="input-base" {...register('role', { required: 'Required' })}>
            {ROLES_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Status</label>
          <select className="input-base" {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Create User'}</Button>
      </div>
    </form>
  );
};

const Users = () => {
  usePageTitle('Users');
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, page, limit }],
    queryFn: () => getUsers({ search, page, limit }),
    select: (res) => res.data,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); setDeactivateTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const { register: regReset, handleSubmit: hsReset, reset: resetPwdForm, formState: { errors: resetErrors }, watch: watchReset } = useForm();
  const resetMutation = useMutation({
    mutationFn: ({ id, data }) => resetPassword(id, data),
    onSuccess: () => { toast.success('Password reset successfully'); setResetTarget(null); resetPwdForm(); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const columns = [
    { key: 'username', label: 'Username' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'role', label: 'Role', render: (row) => <Badge color={ROLE_COLORS[row.role] || 'gray'} className="capitalize">{row.role?.replace('-', ' ')}</Badge> },
    { key: 'status', label: 'Status', render: (row) => <Badge color={row.status === 'active' ? 'green' : 'gray'}>{row.status}</Badge> },
    { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => { setSelected(row); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={() => setResetTarget(row)} className="p-1.5 text-gray-400 hover:text-warning-600 hover:bg-warning-50 rounded-lg" title="Reset Password">
            <Key className="h-4 w-4" />
          </button>
          <button onClick={() => setDeactivateTarget(row)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg" title="Deactivate">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <Button icon={Plus} onClick={() => { setSelected(null); setModalOpen(true); }}>Add User</Button>
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-base pl-9" placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Table columns={columns} data={data?.data ?? []} loading={isLoading}
        pagination={data?.pagination} onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No users found"
      />

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }}
        title={selected ? 'Edit User' : 'Add New User'} size="lg">
        <UserForm user={selected} onSuccess={() => { setModalOpen(false); setSelected(null); }} onClose={() => { setModalOpen(false); setSelected(null); }} />
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={!!resetTarget} onClose={() => { setResetTarget(null); resetPwdForm(); }} title={`Reset Password — ${resetTarget?.username}`} size="sm">
        <form onSubmit={hsReset((d) => resetMutation.mutate({ id: resetTarget._id, data: d }))} className="space-y-4">
          <Input label="New Password" type="password" required error={resetErrors.newPassword?.message}
            {...regReset('newPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
          <Input label="Confirm Password" type="password" required error={resetErrors.confirmPassword?.message}
            {...regReset('confirmPassword', { required: 'Required', validate: (val) => val === watchReset('newPassword') || 'Passwords do not match' })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetTarget(null)} type="button">Cancel</Button>
            <Button type="submit" loading={resetMutation.isPending}>Reset Password</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deactivateTarget} onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateMutation.mutate(deactivateTarget._id)} loading={deactivateMutation.isPending}
        title="Deactivate User" message={`Deactivate "${deactivateTarget?.fullName}"?`} />
    </div>
  );
};

export default Users;
