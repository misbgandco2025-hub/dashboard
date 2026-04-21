import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Eye, Trash2, ChevronRight, X, TrendingUp,
  Receipt, IndianRupee, Clock, CheckCircle2, AlertCircle, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import {
  getFees, getFeeById, createFee, updateFee,
  addFeePayment, waiveFee, deleteFee, getFeeAnalytics,
} from '../services/feeService';
import { getClients } from '../services/clientService';
import { getSubsidies } from '../services/subsidyService';
import useAuth from '../hooks/useAuth';
import useDebounce from '../hooks/useDebounce';
import usePageTitle from '../hooks/usePageTitle';

import Table from '../components/common/Table';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import { formatDate, formatCurrency } from '../utils/dateFormat';

// ─── Constants ────────────────────────────────────────────────────────────────

const FEE_TYPES = [
  { value: 'registration-fee',  label: 'Registration Fee' },
  { value: 'documentation-fee', label: 'Documentation Fee' },
  { value: 'processing-fee',    label: 'Processing Fee' },
  { value: 'portal-registration', label: 'Portal Registration' },
  { value: 'consultation-fee',  label: 'Consultation Fee' },
  { value: 'success-fee',       label: 'Success Fee' },
  { value: 'commission',        label: 'Commission' },
  { value: 'miscellaneous',     label: 'Miscellaneous' },
];

const GST_RATES = [0, 5, 12, 18, 28];

const PAYMENT_MODES = [
  { value: 'cash',   label: 'Cash' },
  { value: 'upi',    label: 'UPI' },
  { value: 'neft',   label: 'NEFT' },
  { value: 'rtgs',   label: 'RTGS' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card',   label: 'Card' },
];

const STATUS_COLORS = {
  pending:   'yellow',
  partial:   'orange',
  paid:      'green',
  waived:    'blue',
  cancelled: 'gray',
};

const FEE_TYPE_LABELS = Object.fromEntries(FEE_TYPES.map((t) => [t.value, t.label]));

// ─── Helper: is overdue ────────────────────────────────────────────────────────
const isOverdue = (fee) =>
  fee.dueDate &&
  new Date(fee.dueDate) < new Date() &&
  !['paid', 'waived', 'cancelled'].includes(fee.status);

// ─── Analytics Banner ─────────────────────────────────────────────────────────
const AnalyticsBanner = ({ period, onPeriodChange }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['fee-analytics', period],
    queryFn: () => getFeeAnalytics(period),
    select: (res) => res.data.data,
  });

  const cards = [
    {
      label: 'Total Invoiced',
      value: formatCurrency(data?.summary?.totalFees ?? 0),
      icon: Receipt,
      color: 'text-blue-600 bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Collected',
      value: formatCurrency(data?.summary?.totalPaid ?? 0),
      icon: CheckCircle2,
      color: 'text-green-600 bg-green-50',
      border: 'border-green-200',
    },
    {
      label: 'Pending',
      value: formatCurrency(data?.summary?.totalPending ?? 0),
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Overdue',
      value: data?.overdueCount ?? 0,
      suffix: ' entries',
      icon: AlertCircle,
      color: 'text-red-600 bg-red-50',
      border: 'border-red-200',
    },
    {
      label: 'Collection Rate',
      value: `${data?.collectionRate ?? 0}%`,
      icon: TrendingUp,
      color: 'text-purple-600 bg-purple-50',
      border: 'border-purple-200',
    },
  ];

  return (
    <div className="mb-6">
      {/* Period selector */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600">Fee Analytics</p>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[{ key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'all', label: 'All' }].map((p) => (
            <button
              key={p.key}
              onClick={() => onPeriodChange(p.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                period === p.key ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`card p-4 border ${c.border}`}>
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.color} mb-2`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-xs text-gray-500 font-medium">{c.label}</p>
              <p className={`text-lg font-bold ${c.color.split(' ')[0]} mt-0.5`}>
                {isLoading ? '…' : c.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fee type breakdown */}
      {data?.feeTypeBreakdown?.length > 0 && (
        <div className="mt-3 card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Fee Type Breakdown</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {data.feeTypeBreakdown.slice(0, 4).map((t) => {
              const pct = t.totalAmount > 0 ? Math.round((t.paidAmount / t.totalAmount) * 100) : 0;
              return (
                <div key={t._id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 truncate">{FEE_TYPE_LABELS[t._id] ?? t._id}</span>
                    <span className="text-xs font-medium text-gray-700">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{formatCurrency(t.totalAmount)} total · {t.count} entries</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Create Fee Modal ─────────────────────────────────────────────────────────
const CreateFeeModal = ({ isOpen, onClose, onSuccess }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: { gstRate: 18, feeType: 'processing-fee' },
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { limit: 200 }],
    queryFn: () => getClients({ limit: 200 }),
    enabled: isOpen,
    select: (res) => res.data.data,
  });

  const selectedClient = watch('clientId');

  const { data: appsData } = useQuery({
    queryKey: ['subsidies', { limit: 100, clientId: selectedClient }],
    queryFn: () => getSubsidies({ limit: 100, clientId: selectedClient }),
    enabled: isOpen && !!selectedClient,
    select: (res) => res.data.data,
  });

  const baseAmount = parseFloat(watch('baseAmount') || 0);
  const gstRate = parseFloat(watch('gstRate') || 0);
  const gstAmount = Math.round(baseAmount * (gstRate / 100) * 100) / 100;
  const totalAmount = baseAmount + gstAmount;

  const mutation = useMutation({
    mutationFn: (data) => createFee(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Fee created successfully');
      reset();
      onSuccess?.();
    },
    onError: (e) => {
      const apiErrors = e.response?.data?.errors;
      if (apiErrors?.length) {
        apiErrors.forEach((err) => toast.error(`${err.field ? err.field + ': ' : ''}${err.message}`, { duration: 5000 }));
      } else {
        toast.error(e.response?.data?.message || 'Failed to create fee');
      }
    },
  });

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Fee" size="xl">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

        {/* Client + Application */}
        <div>
          <h4 className="form-section-title">Client & Application</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">Client<span className="text-danger-500 ml-0.5">*</span></label>
              <select className={`input-base ${errors.clientId ? 'input-error' : ''}`}
                {...register('clientId', { required: 'Client is required' })}>
                <option value="">Select client…</option>
                {(clientsData ?? []).map((c) => (
                  <option key={c._id} value={c._id}>{c.name} — {c.clientId}</option>
                ))}
              </select>
              {errors.clientId && <p className="mt-1 text-xs text-danger-600">{errors.clientId.message}</p>}
            </div>
            <div>
              <label className="label-base">Application <span className="text-gray-400 font-normal">(optional)</span></label>
              <select className="input-base" {...register('applicationId')}
                disabled={!selectedClient}>
                <option value="">No application linked</option>
                {(appsData ?? []).map((a) => (
                  <option key={a._id} value={a._id}>{a.applicationId} — {a.schemeName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fee Details */}
        <div>
          <h4 className="form-section-title">Fee Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-base">Description<span className="text-danger-500 ml-0.5">*</span></label>
              <input
                className={`input-base ${errors.description ? 'input-error' : ''}`}
                placeholder="e.g. Processing Fee for NHB Application"
                {...register('description', { required: 'Description is required' })}
              />
              {errors.description && <p className="mt-1 text-xs text-danger-600">{errors.description.message}</p>}
            </div>
            <div>
              <label className="label-base">Fee Type<span className="text-danger-500 ml-0.5">*</span></label>
              <select className={`input-base ${errors.feeType ? 'input-error' : ''}`}
                {...register('feeType', { required: 'Fee type is required' })}>
                {FEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.feeType && <p className="mt-1 text-xs text-danger-600">{errors.feeType.message}</p>}
            </div>
            <div>
              <label className="label-base">Due Date<span className="text-danger-500 ml-0.5">*</span></label>
              <input type="date" className={`input-base ${errors.dueDate ? 'input-error' : ''}`}
                {...register('dueDate', { required: 'Due date is required' })} />
              {errors.dueDate && <p className="mt-1 text-xs text-danger-600">{errors.dueDate.message}</p>}
            </div>
          </div>
        </div>

        {/* Amount + GST */}
        <div>
          <h4 className="form-section-title">Amount & GST</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label-base">Base Amount (₹)<span className="text-danger-500 ml-0.5">*</span></label>
              <input type="number" step="any" min="0" className={`input-base ${errors.baseAmount ? 'input-error' : ''}`}
                placeholder="0"
                {...register('baseAmount', { required: 'Base amount is required', min: { value: 0.01, message: 'Must be > 0' } })} />
              {errors.baseAmount && <p className="mt-1 text-xs text-danger-600">{errors.baseAmount.message}</p>}
            </div>
            <div>
              <label className="label-base">GST Rate (%)</label>
              <select className="input-base" {...register('gstRate')}>
                {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Total Amount</label>
              <div className="input-base bg-gray-50 font-semibold text-gray-700">
                {totalAmount > 0 ? formatCurrency(totalAmount) : '—'}
                {gstAmount > 0 && (
                  <span className="text-xs text-gray-400 font-normal ml-2">(GST: {formatCurrency(gstAmount)})</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="label-base">Remarks</label>
          <textarea className="input-base resize-none" rows={2} placeholder="Optional notes…" {...register('remarks')} />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Fee</Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Add Payment Modal ────────────────────────────────────────────────────────
const AddPaymentModal = ({ isOpen, onClose, fee }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { paymentMode: 'upi', paidDate: new Date().toISOString().slice(0, 10) },
  });

  const mutation = useMutation({
    mutationFn: (data) => addFeePayment(fee._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee', fee._id] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Payment recorded');
      reset();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record payment'),
  });

  if (!isOpen || !fee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Record Payment — ${fee.feeId}`} size="md">
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: formatCurrency(fee.totalAmount), cls: 'text-gray-700' },
          { label: 'Paid', value: formatCurrency(fee.paidAmount), cls: 'text-green-600' },
          { label: 'Pending', value: formatCurrency(fee.pendingAmount), cls: 'text-red-600 font-bold' },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-sm font-semibold mt-0.5 ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, amount: parseFloat(d.amount) }))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Amount (₹)<span className="text-danger-500 ml-0.5">*</span></label>
            <input type="number" step="any" min="0.01" className={`input-base ${errors.amount ? 'input-error' : ''}`}
              placeholder={`Max: ${fee.pendingAmount}`}
              {...register('amount', {
                required: 'Amount is required',
                min: { value: 0.01, message: 'Must be > 0' },
                max: { value: fee.pendingAmount, message: `Cannot exceed ₹${fee.pendingAmount}` },
              })} />
            {errors.amount && <p className="mt-1 text-xs text-danger-600">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="label-base">Payment Date<span className="text-danger-500 ml-0.5">*</span></label>
            <input type="date" className={`input-base ${errors.paidDate ? 'input-error' : ''}`}
              {...register('paidDate', { required: 'Date is required' })} />
            {errors.paidDate && <p className="mt-1 text-xs text-danger-600">{errors.paidDate.message}</p>}
          </div>
          <div>
            <label className="label-base">Payment Mode<span className="text-danger-500 ml-0.5">*</span></label>
            <select className="input-base" {...register('paymentMode', { required: true })}>
              {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Reference No.</label>
            <input className="input-base font-mono" placeholder="UPI Ref / Cheque No / TXN ID"
              {...register('reference')} />
          </div>
        </div>
        <div>
          <label className="label-base">Remarks</label>
          <textarea className="input-base resize-none" rows={2} {...register('remarks')} />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Record Payment</Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Waive Fee Modal ──────────────────────────────────────────────────────────
const WaiveFeeModal = ({ isOpen, onClose, fee }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => waiveFee(fee._id, { ...data, waivedAmount: parseFloat(data.waivedAmount) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee', fee._id] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Fee waived');
      reset();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to waive fee'),
  });

  if (!isOpen || !fee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Waive Fee — ${fee.feeId}`} size="sm">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="label-base">Waived Amount (₹)<span className="text-danger-500 ml-0.5">*</span></label>
          <input type="number" step="any" min="0.01" className={`input-base ${errors.waivedAmount ? 'input-error' : ''}`}
            placeholder={`Max: ${fee.pendingAmount}`}
            {...register('waivedAmount', {
              required: 'Amount is required',
              min: { value: 0.01, message: 'Must be > 0' },
              max: { value: fee.pendingAmount, message: `Cannot exceed ₹${fee.pendingAmount}` },
            })} />
          {errors.waivedAmount && <p className="mt-1 text-xs text-danger-600">{errors.waivedAmount.message}</p>}
        </div>
        <div>
          <label className="label-base">Reason<span className="text-danger-500 ml-0.5">*</span></label>
          <textarea className={`input-base resize-none ${errors.waiverReason ? 'input-error' : ''}`} rows={3}
            placeholder="Reason for waiver…"
            {...register('waiverReason', { required: 'Reason is required' })} />
          {errors.waiverReason && <p className="mt-1 text-xs text-danger-600">{errors.waiverReason.message}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending} variant="danger">Confirm Waiver</Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Fee Detail View ──────────────────────────────────────────────────────────
const FeeDetail = ({ fee: listFee, onBack }) => {
  const qc = useQueryClient();
  const [paymentModal, setPaymentModal] = useState(false);
  const [waiveModal, setWaiveModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: freshFee } = useQuery({
    queryKey: ['fee', listFee._id],
    queryFn: () => getFeeById(listFee._id),
    select: (res) => res.data.data,
    staleTime: 0,
  });

  const fee = freshFee ?? listFee;
  const overdue = isOverdue(fee);

  const deleteMutation = useMutation({
    mutationFn: () => deleteFee(fee._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Fee deleted');
      onBack();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const paidPct = fee.totalAmount > 0
    ? Math.min(100, Math.round((fee.paidAmount / fee.totalAmount) * 100))
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{fee.feeId}</h1>
          <p className="text-sm text-gray-500">
            {fee.invoiceNumber} · {fee.clientId?.name ?? '—'} · {FEE_TYPE_LABELS[fee.feeType] ?? fee.feeType}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={overdue ? 'red' : (STATUS_COLORS[fee.status] || 'gray')}>
            {overdue ? 'Overdue' : fee.status}
          </Badge>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Base Amount', value: formatCurrency(fee.baseAmount) },
          { label: `GST (${fee.gstRate}%)`, value: formatCurrency(fee.gstAmount) },
          { label: 'Total Amount', value: formatCurrency(fee.totalAmount), bold: true },
          { label: 'Due Date', value: formatDate(fee.dueDate), red: overdue },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-sm font-semibold mt-1 ${s.red ? 'text-red-600' : 'text-gray-800'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <Card header="Payment Progress">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              <span className="font-semibold text-green-600">{formatCurrency(fee.paidAmount)}</span> paid of {formatCurrency(fee.totalAmount)}
            </span>
            <span className="font-bold text-primary-600">{paidPct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${paidPct === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
              style={{ width: `${paidPct}%` }}
            />
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">Paid: {formatCurrency(fee.paidAmount)}</span>
            <span className="text-red-600 font-medium">Pending: {formatCurrency(fee.pendingAmount)}</span>
            {fee.waivedAmount > 0 && (
              <span className="text-blue-600 font-medium">Waived: {formatCurrency(fee.waivedAmount)}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {!['paid', 'waived', 'cancelled'].includes(fee.status) && (
            <>
              <Button size="sm" icon={IndianRupee} onClick={() => setPaymentModal(true)}>
                Add Payment
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setWaiveModal(true)}>
                Waive
              </Button>
            </>
          )}
          {!['paid', 'waived', 'cancelled'].includes(fee.status) && (
            <Button size="sm" variant="secondary" onClick={() => setEditModal(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(true)}>
            Delete
          </Button>
        </div>
      </Card>

      {/* Fee Information */}
      <Card header="Fee Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {[
            ['Client', `${fee.clientId?.name ?? '—'} (${fee.clientId?.clientId ?? ''})`],
            ['Application', fee.applicationId?.applicationId ?? 'Not linked'],
            ['Description', fee.description],
            ['Fee Type', FEE_TYPE_LABELS[fee.feeType] ?? fee.feeType],
            ['Invoice Number', fee.invoiceNumber],
            ['Invoice Date', formatDate(fee.invoiceDate)],
            ['Created By', fee.createdBy?.fullName ?? '—'],
            ['Remarks', fee.remarks || 'None'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <span className="text-gray-800">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment History */}
      <Card header={`Payment History (${fee.payments?.length ?? 0})`}>
        {!fee.payments?.length ? (
          <p className="text-sm text-gray-400 text-center py-6">No payments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Receipt No.', 'Amount', 'Date', 'Mode', 'Reference', 'Recorded By'].map((h) => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fee.payments.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-td font-mono text-xs">{p.receiptNumber}</td>
                    <td className="table-td font-semibold text-green-600">{formatCurrency(p.amount)}</td>
                    <td className="table-td">{formatDate(p.paidDate)}</td>
                    <td className="table-td capitalize">{p.paymentMode}</td>
                    <td className="table-td font-mono text-xs">{p.reference || '—'}</td>
                    <td className="table-td">{p.recordedBy?.fullName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Waiver info */}
      {fee.status === 'waived' && (
        <Card header="Waiver Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Waived Amount</span>
              <span className="text-blue-600 font-semibold">{formatCurrency(fee.waivedAmount)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Waived By</span>
              <span className="text-gray-800">{fee.waivedBy?.fullName ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Waived Date</span>
              <span className="text-gray-800">{formatDate(fee.waivedDate)}</span>
            </div>
            <div className="sm:col-span-3 flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Reason</span>
              <span className="text-gray-800">{fee.waiverReason || '—'}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Modals */}
      <AddPaymentModal isOpen={paymentModal} onClose={() => setPaymentModal(false)} fee={fee} />
      <WaiveFeeModal isOpen={waiveModal} onClose={() => setWaiveModal(false)} fee={fee} />
      <EditFeeModal isOpen={editModal} onClose={() => setEditModal(false)} fee={fee} />
      <ConfirmDialog
        isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete Fee"
        message={`Delete fee "${fee.feeId}"? This cannot be undone.`}
      />
    </div>
  );
};

// ─── Edit Fee Modal ────────────────────────────────────────────────────────────
const EditFeeModal = ({ isOpen, onClose, fee }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

  useEffect(() => {
    if (fee && isOpen) {
      reset({
        description: fee.description,
        feeType: fee.feeType,
        baseAmount: fee.baseAmount,
        gstRate: fee.gstRate,
        dueDate: fee.dueDate ? new Date(fee.dueDate).toISOString().slice(0, 10) : '',
        remarks: fee.remarks || '',
      });
    }
  }, [fee, isOpen, reset]);

  const baseAmount = parseFloat(watch('baseAmount') || 0);
  const gstRate = parseFloat(watch('gstRate') || 0);
  const gstAmount = Math.round(baseAmount * (gstRate / 100) * 100) / 100;
  const totalAmount = baseAmount + gstAmount;

  const mutation = useMutation({
    mutationFn: (data) => updateFee(fee._id, { ...data, baseAmount: parseFloat(data.baseAmount), gstRate: parseFloat(data.gstRate) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee', fee._id] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Fee updated');
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  if (!isOpen || !fee) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Fee — ${fee.feeId}`} size="lg">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <label className="label-base">Description<span className="text-danger-500 ml-0.5">*</span></label>
          <input className={`input-base ${errors.description ? 'input-error' : ''}`}
            {...register('description', { required: 'Required' })} />
          {errors.description && <p className="mt-1 text-xs text-danger-600">{errors.description.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Fee Type<span className="text-danger-500 ml-0.5">*</span></label>
            <select className="input-base" {...register('feeType', { required: true })}>
              {FEE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Due Date<span className="text-danger-500 ml-0.5">*</span></label>
            <input type="date" className={`input-base ${errors.dueDate ? 'input-error' : ''}`}
              {...register('dueDate', { required: 'Required' })} />
            {errors.dueDate && <p className="mt-1 text-xs text-danger-600">{errors.dueDate.message}</p>}
          </div>
          <div>
            <label className="label-base">Base Amount (₹)<span className="text-danger-500 ml-0.5">*</span></label>
            <input type="number" step="any" min="0" className={`input-base ${errors.baseAmount ? 'input-error' : ''}`}
              {...register('baseAmount', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
            {errors.baseAmount && <p className="mt-1 text-xs text-danger-600">{errors.baseAmount.message}</p>}
          </div>
          <div>
            <label className="label-base">GST Rate (%)</label>
            <select className="input-base" {...register('gstRate')}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
        </div>
        <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
          Total: <span className="font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
          {gstAmount > 0 && <span className="text-gray-400 ml-2">(Base {formatCurrency(baseAmount)} + GST {formatCurrency(gstAmount)})</span>}
        </div>
        <div>
          <label className="label-base">Remarks</label>
          <textarea className="input-base resize-none" rows={2} {...register('remarks')} />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
};

// ─── Main Fees Page ───────────────────────────────────────────────────────────
const Fees = () => {
  usePageTitle('Fees');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailFee, setDetailFee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('month');
  const [filterOpen, setFilterOpen] = useState(false);

  const debounced = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ['fees', { search: debounced, page, limit, status: statusFilter, overdue: overdueOnly }],
    queryFn: () => getFees({ search: debounced, page, limit, status: statusFilter || undefined, overdue: overdueOnly || undefined }),
    select: (res) => res.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteFee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fees'] });
      qc.invalidateQueries({ queryKey: ['fee-analytics'] });
      toast.success('Fee deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  if (detailFee) {
    return <FeeDetail fee={detailFee} onBack={() => setDetailFee(null)} />;
  }

  const hasFilters = statusFilter || overdueOnly;

  const columns = [
    {
      key: 'feeId', label: 'Fee ID / Invoice', width: '150px',
      render: (row) => (
        <div>
          <p className="font-mono text-xs font-semibold text-gray-800">{row.feeId}</p>
          <p className="text-[10px] text-gray-400 font-mono">{row.invoiceNumber}</p>
        </div>
      ),
    },
    {
      key: 'client', label: 'Client',
      render: (row) => (
        <div>
          <p className="font-medium text-sm text-gray-800">{row.clientId?.name ?? '—'}</p>
          <p className="text-xs text-gray-400">{row.clientId?.clientId ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'description', label: 'Description',
      render: (row) => (
        <div>
          <p className="text-sm text-gray-800 line-clamp-1">{row.description}</p>
          <p className="text-xs text-gray-400">{FEE_TYPE_LABELS[row.feeType] ?? row.feeType}</p>
        </div>
      ),
    },
    {
      key: 'totalAmount', label: 'Total',
      render: (row) => (
        <div>
          <p className="font-semibold text-sm">{formatCurrency(row.totalAmount)}</p>
          <p className="text-[10px] text-gray-400">Base {formatCurrency(row.baseAmount)} + GST {row.gstRate}%</p>
        </div>
      ),
    },
    {
      key: 'paidAmount', label: 'Paid',
      render: (row) => (
        <span className="text-sm font-semibold text-green-600">{formatCurrency(row.paidAmount)}</span>
      ),
    },
    {
      key: 'pendingAmount', label: 'Pending',
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <div>
            <span className={`text-sm font-semibold ${overdue ? 'text-red-600' : 'text-gray-700'}`}>
              {formatCurrency(row.pendingAmount)}
            </span>
            {overdue && <p className="text-[10px] text-red-500 font-medium">Overdue</p>}
          </div>
        );
      },
    },
    {
      key: 'dueDate', label: 'Due Date',
      render: (row) => {
        const overdue = isOverdue(row);
        return (
          <span className={`text-sm ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'status', label: 'Status',
      render: (row) => (
        <Badge color={isOverdue(row) ? 'red' : (STATUS_COLORS[row.status] || 'gray')}>
          {isOverdue(row) ? 'Overdue' : row.status}
        </Badge>
      ),
    },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setDetailFee(row)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="View">
            <Eye className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteTarget(row)}
            className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Fees Management</h1>
        <Button icon={Plus} onClick={() => setCreateModal(true)}>New Fee</Button>
      </div>

      {/* Analytics */}
      <AnalyticsBanner period={analyticsPeriod} onPeriodChange={setAnalyticsPeriod} />

      {/* Search + Filter bar */}
      <div className="card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-base pl-9"
            placeholder="Search fee ID, invoice, description…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        {/* Filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              hasFilters
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasFilters && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
                {[statusFilter, overdueOnly].filter(Boolean).length}
              </span>
            )}
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-800">Filters</p>
                <button onClick={() => setFilterOpen(false)}><X className="h-4 w-4 text-gray-400" /></button>
              </div>
              <div>
                <label className="label-base">Status</label>
                <select className="input-base" value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                  <option value="waived">Waived</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={overdueOnly}
                  onChange={(e) => { setOverdueOnly(e.target.checked); setPage(1); }}
                  className="rounded text-primary-600" />
                <span className="text-sm text-gray-700">Overdue only</span>
              </label>
              {hasFilters && (
                <button
                  onClick={() => { setStatusFilter(''); setOverdueOnly(false); setPage(1); setFilterOpen(false); }}
                  className="w-full text-sm text-danger-600 hover:text-danger-700 font-medium pt-1"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        pagination={data?.pagination}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No fees found"
        emptyDescription="Create a new fee entry to start tracking."
        emptyAction={() => setCreateModal(true)}
        emptyActionLabel="New Fee"
        onRowClick={(row) => setDetailFee(row)}
      />

      <CreateFeeModal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        onSuccess={() => setCreateModal(false)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
        loading={deleteMutation.isPending}
        title="Delete Fee"
        message={`Delete "${deleteTarget?.feeId}"? This cannot be undone.`}
      />
    </div>
  );
};

export default Fees;
