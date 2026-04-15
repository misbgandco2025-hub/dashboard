import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Eye, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import { getClients, createClient, updateClient, deleteClient, checkDuplicate } from '../services/clientService';
import { getVendors } from '../services/vendorService';
import useAuth from '../hooks/useAuth';
import useDebounce from '../hooks/useDebounce';
import usePageTitle from '../hooks/usePageTitle';

import Table from '../components/common/Table';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Badge from '../components/common/Badge';
import { StatusBadge } from '../components/common/Badge';
import { formatDate } from '../utils/dateFormat';
import { CLIENT_TYPE_COLORS, COMMON_BANKS, SOURCE_TYPES, CLIENT_TYPES } from '../utils/constants';

const ClientForm = ({ client, onSuccess, onClose }) => {
  const qc = useQueryClient();
  const isEdit = !!client;
  const [sourceType, setSourceType] = useState(client?.sourceType || 'direct');

  const { data: vendorsData } = useQuery({
    queryKey: ['vendors', { limit: 100 }],
    queryFn: () => getVendors({ limit: 100 }),
    select: (res) => res.data.data,
  });

  const { register, handleSubmit, formState: { errors }, setError } = useForm({
    defaultValues: client ? {
      name: client.name, email: client.email, mobile: client.mobile,
      alternateMobile: client.alternateMobile, address: client.address,
      businessName: client.businessName, bankName: client.bankName,
      branchName: client.branchName, ifscCode: client.ifscCode,
      accountNumber: client.accountNumber, bankContactPerson: client.bankContactPerson,
      bankContactMobile: client.bankContactMobile, bankContactEmail: client.bankContactEmail,
      bankContactDesignation: client.bankContactDesignation,
      sourceType: client.sourceType, vendorId: client.vendorId?._id || client.vendorId || '',
      clientType: client.clientType,
    } : { sourceType: 'direct', clientType: 'bank-loan' },
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (!isEdit) {
        const dupRes = await checkDuplicate({ email: data.email, mobile: data.mobile });
        if (dupRes.data.data.isDuplicate) {
          throw new Error('A client with this mobile or email already exists.');
        }
      }
      return isEdit ? updateClient(client._id, data) : createClient(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(`Client ${isEdit ? 'updated' : 'created'} successfully`);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || e.message || 'Failed to save client'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, sourceType }))} className="space-y-5">
      {/* Personal Info */}
      <div>
        <h4 className="form-section-title">Personal Information</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" required error={errors.name?.message} {...register('name', { required: 'Required' })} />
          <Input label="Email" type="email" required error={errors.email?.message} {...register('email', { required: 'Required' })} />
          <Input label="Mobile" type="tel" required error={errors.mobile?.message} {...register('mobile', { required: 'Required', pattern: { value: /^\d{10}$/, message: '10 digits' } })} />
          <Input label="Alternate Mobile" type="tel" error={errors.alternateMobile?.message} {...register('alternateMobile', { pattern: { value: /^\d{10}$/, message: '10 digits' } })} />
          <Input label="Business / Project Name" required error={errors.businessName?.message} {...register('businessName', { required: 'Required' })} />
          <div className="sm:col-span-2">
            <label className="label-base">Address<span className="text-danger-500 ml-0.5">*</span></label>
            <textarea className={`input-base resize-none ${errors.address ? 'input-error' : ''}`} rows={2} {...register('address', { required: 'Required' })} />
            {errors.address && <p className="mt-1 text-xs text-danger-600">{errors.address.message}</p>}
          </div>
        </div>
      </div>

      {/* Bank Info */}
      <div>
        <h4 className="form-section-title">Bank Information</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-base">Bank Name<span className="text-danger-500 ml-0.5">*</span></label>
            <select className="input-base" {...register('bankName', { required: 'Required' })}>
              <option value="">Select bank...</option>
              {COMMON_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <Input label="Branch Name" required error={errors.branchName?.message} {...register('branchName', { required: 'Required' })} />
          <Input label="IFSC Code" placeholder="SBIN0001234" error={errors.ifscCode?.message} {...register('ifscCode', { pattern: { value: /^[A-Z]{4}0[A-Z0-9]{6}$/, message: 'Invalid IFSC' } })} />
          <Input label="Account Number" {...register('accountNumber')} />
        </div>
      </div>

      {/* Bank Contact */}
      <div>
        <h4 className="form-section-title">Bank Contact Person</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Contact Person Name" required error={errors.bankContactPerson?.message} {...register('bankContactPerson', { required: 'Required' })} />
          <Input label="Designation" {...register('bankContactDesignation')} />
          <Input label="Mobile" type="tel" error={errors.bankContactMobile?.message} {...register('bankContactMobile', { pattern: { value: /^\d{10}$/, message: '10 digits' } })} />
          <Input label="Email" type="email" {...register('bankContactEmail')} />
        </div>
      </div>

      {/* Source & Type */}
      <div>
        <h4 className="form-section-title">Source & Application Type</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-base">Source Type<span className="text-danger-500 ml-0.5">*</span></label>
            <div className="flex gap-4 mt-2">
              {SOURCE_TYPES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sourceType" value={s.value} checked={sourceType === s.value} onChange={() => setSourceType(s.value)} className="text-primary-600" />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          {sourceType === 'vendor' && (
            <div>
              <label className="label-base">Vendor<span className="text-danger-500 ml-0.5">*</span></label>
              <select className="input-base" {...register('vendorId', { required: sourceType === 'vendor' ? 'Required' : false })}>
                <option value="">Select vendor...</option>
                {(vendorsData ?? []).map((v) => <option key={v._id} value={v._id}>{v.vendorName}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label-base">Application Type<span className="text-danger-500 ml-0.5">*</span></label>
            <select className="input-base" {...register('clientType', { required: 'Required' })}>
              {CLIENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Create Client'}</Button>
      </div>
    </form>
  );
};

const Clients = () => {
  usePageTitle('Clients');
  const { can } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const debounced = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search: debounced, page, limit }],
    queryFn: () => getClients({ search: debounced, page, limit }),
    select: (res) => res.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const columns = [
    { key: 'clientId', label: 'Client ID', width: '130px' },
    { key: 'name', label: 'Name' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'bankName', label: 'Bank' },
    {
      key: 'sourceType', label: 'Source', sortable: false,
      render: (row) => (
        <Badge color={row.sourceType === 'vendor' ? 'blue' : 'purple'} dot>
          {row.sourceType === 'vendor' ? (row.vendorId?.vendorName || 'Vendor') : 'Direct'}
        </Badge>
      ),
    },
    {
      key: 'clientType', label: 'Type', sortable: false,
      render: (row) => <Badge color={CLIENT_TYPE_COLORS[row.clientType] || 'gray'}>{row.clientType}</Badge>,
    },
    { key: 'registrationDate', label: 'Registered', render: (row) => formatDate(row.registrationDate) },
    {
      key: 'status', label: 'Status', sortable: false,
      render: (row) => <Badge color={row.status === 'active' ? 'green' : 'gray'}>{row.status}</Badge>,
    },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          {can('clients.update') && (
            <button onClick={() => { setSelected(row); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {can('clients.delete') && (
            <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        {can('clients.create') && (
          <Button icon={Plus} onClick={() => { setSelected(null); setModalOpen(true); }}>Add Client</Button>
        )}
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-base pl-9" placeholder="Search by name, mobile, email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Table
        columns={columns} data={data?.data ?? []} loading={isLoading}
        pagination={data?.pagination} onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No clients found" emptyDescription="Add your first client."
        emptyAction={can('clients.create') ? () => setModalOpen(true) : undefined}
        emptyActionLabel="Add Client"
      />

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }}
        title={selected ? 'Edit Client' : 'Add New Client'} size="xl">
        <ClientForm vendor={selected} client={selected}
          onSuccess={() => { setModalOpen(false); setSelected(null); }}
          onClose={() => { setModalOpen(false); setSelected(null); }} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        loading={deleteMutation.isPending}
        title="Delete Client"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </div>
  );
};

export default Clients;
