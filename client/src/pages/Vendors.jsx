import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Trash2, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import { getVendors, createVendor, updateVendor, deleteVendor, getVendorStatistics } from '../services/vendorService';
import useAuth from '../hooks/useAuth';
import useDebounce from '../hooks/useDebounce';
import usePageTitle from '../hooks/usePageTitle';

import Table from '../components/common/Table';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Badge from '../components/common/Badge';
import { formatDate } from '../utils/dateFormat';

const VendorForm = ({ vendor, onSuccess, onClose }) => {
  const qc = useQueryClient();
  const isEdit = !!vendor;

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: vendor ? {
      vendorName: vendor.vendorName,
      vendorCode: vendor.vendorCode,
      contactPerson: vendor.contactPerson,
      mobile: vendor.mobile,
      email: vendor.email,
      address: vendor.address,
      commissionDetails: vendor.commissionDetails,
      agreementDate: vendor.agreementDate?.slice(0, 10),
    } : {},
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateVendor(vendor._id, data) : createVendor(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success(`Vendor ${isEdit ? 'updated' : 'created'} successfully`);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save vendor'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Vendor Name" required error={errors.vendorName?.message} {...register('vendorName', { required: 'Required' })} />
        <Input label="Vendor Code" placeholder="Auto-generated if empty" {...register('vendorCode')} />
        <Input label="Contact Person" required error={errors.contactPerson?.message} {...register('contactPerson', { required: 'Required' })} />
        <Input label="Mobile" type="tel" error={errors.mobile?.message} {...register('mobile', { pattern: { value: /^\d{10}$/, message: '10 digits required' } })} />
        <Input label="Email" type="email" {...register('email')} />
        <Input label="Agreement Date" type="date" {...register('agreementDate')} />
      </div>
      <div>
        <label className="label-base">Address</label>
        <textarea className="input-base resize-none" rows={2} {...register('address')} />
      </div>
      <div>
        <label className="label-base">Commission / Agreement Details</label>
        <textarea className="input-base resize-none" rows={2} {...register('commissionDetails')} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Create Vendor'}</Button>
      </div>
    </form>
  );
};

const Vendors = () => {
  usePageTitle('Vendors');
  const { can } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statsTarget, setStatsTarget] = useState(null);

  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', { search: debouncedSearch, page, limit }],
    queryFn: () => getVendors({ search: debouncedSearch, page, limit }),
    select: (res) => res.data,
  });

  const { data: stats } = useQuery({
    queryKey: ['vendor-stats', statsTarget?._id],
    queryFn: () => getVendorStatistics(statsTarget._id),
    enabled: !!statsTarget,
    select: (res) => res.data.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteVendor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const columns = [
    { key: 'vendorId', label: 'ID', width: '100px' },
    { key: 'vendorName', label: 'Vendor Name' },
    { key: 'vendorCode', label: 'Code', width: '90px' },
    { key: 'contactPerson', label: 'Contact Person' },
    { key: 'mobile', label: 'Mobile' },
    {
      key: 'status', label: 'Status', sortable: false,
      render: (row) => <Badge color={row.status === 'active' ? 'green' : 'gray'}>{row.status}</Badge>,
    },
    { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
    {
      key: 'actions', label: 'Actions', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setStatsTarget(row)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="View Stats">
            <Eye className="h-4 w-4" />
          </button>
          {can('vendors.update') && (
            <button onClick={() => { setSelected(row); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Edit">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {can('vendors.delete') && (
            <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg" title="Delete">
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
        <h1 className="page-title">Vendors</h1>
        {can('vendors.create') && (
          <Button icon={Plus} onClick={() => { setSelected(null); setModalOpen(true); }}>Add Vendor</Button>
        )}
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-base pl-9"
            placeholder="Search by name, code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        pagination={data?.pagination}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No vendors found"
        emptyDescription="Add your first vendor to get started."
        emptyAction={can('vendors.create') ? () => setModalOpen(true) : undefined}
        emptyActionLabel="Add Vendor"
      />

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        title={selected ? 'Edit Vendor' : 'Add New Vendor'}
        size="lg"
      >
        <VendorForm
          vendor={selected}
          onSuccess={() => { setModalOpen(false); setSelected(null); }}
          onClose={() => { setModalOpen(false); setSelected(null); }}
        />
      </Modal>

      {/* Stats Modal */}
      <Modal isOpen={!!statsTarget} onClose={() => setStatsTarget(null)} title="Vendor Statistics" size="md">
        {stats && (
          <div className="space-y-4">
            <div className="font-semibold text-gray-800">{stats.vendor?.vendorName}</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Clients', value: stats.totalClients },
                { label: 'Active Clients', value: stats.activeClients },
                { label: 'Bank Loan Apps', value: stats.totalBankLoanApplications },
                { label: 'Subsidy Apps', value: stats.totalSubsidyApplications },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary-700">{s.value ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        loading={deleteMutation.isPending}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${deleteTarget?.vendorName}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default Vendors;
