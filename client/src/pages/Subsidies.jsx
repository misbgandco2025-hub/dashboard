import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import {
  getBankLoans, getBankLoanById, createBankLoan, updateBankLoan, deleteBankLoan,
  updateBankLoanStatus, updateDocumentChecklist, addQuery, updateQuery,
  addTimelineEntry, updateAifCredentials, updateLoanPreparation, updateLoanSanction,
} from '../services/bankLoanService';
import { getClients } from '../services/clientService';
import useAuth from '../hooks/useAuth';
import useDebounce from '../hooks/useDebounce';
import usePageTitle from '../hooks/usePageTitle';
import useConfigStore from '../store/configStore';

import Table from '../components/common/Table';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Card from '../components/common/Card';
import { StatusBadge } from '../components/common/Badge';
import Badge from '../components/common/Badge';
import Loader from '../components/common/Loader';
import { formatDate, formatDateTime, daysAgo } from '../utils/dateFormat';
import {
  PRIORITIES, PRIORITY_COLORS, DOCUMENT_STATUSES,
  DOCUMENT_STATUS_COLORS, QUERY_STATUSES, QUERY_STATUS_COLORS,
  QUERY_CATEGORIES, PORTAL_NAMES, REGISTRATION_STATUSES, APPROVAL_STATUSES,
} from '../utils/constants';

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatusUpdateModal = ({ isOpen, onClose, application, statuses, type = 'bank-loan' }) => {
  const qc = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const mutation = useMutation({
    mutationFn: (data) => updateBankLoanStatus(application._id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', application._id] });
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Status updated');
      reset();
      onClose();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update status'),
  });

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Status" size="md"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button form="status-form" type="submit" loading={mutation.isPending}>Update Status</Button>
      </>}
    >
      <form id="status-form" onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div>
          <p className="text-sm text-gray-500 mb-3">Current: <StatusBadge status={application?.currentStatus} /></p>
          <label className="label-base">New Status<span className="text-danger-500 ml-0.5">*</span></label>
          <select className="input-base" {...register('status', { required: true })}>
            <option value="">Select new status...</option>
            {statuses.map((s) => <option key={s._id} value={s.label}>{s.label}</option>)}
          </select>
        </div>
        <Input label="Date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} {...register('date')} />
        <div>
          <label className="label-base">Remarks<span className="text-danger-500 ml-0.5">*</span></label>
          <textarea className="input-base resize-none" rows={3} placeholder="Reason for status change..." {...register('remarks', { required: true })} />
        </div>
      </form>
    </Modal>
  );
};

const DocumentChecklist = ({ applicationId, checklist }) => {
  const qc = useQueryClient();
  const [localChecklist, setLocalChecklist] = useState(checklist ?? []);
  const [updating, setUpdating] = useState(null);
  const [docStatus, setDocStatus] = useState('received');
  const [docDate, setDocDate] = useState('');
  const [docRemarks, setDocRemarks] = useState('');

  // Sync local state when prop changes (e.g. navigation or refetch)
  useEffect(() => {
    setLocalChecklist(checklist ?? []);
  }, [checklist]);

  const today = new Date().toISOString().slice(0, 10);

  const openUpdate = (doc) => {
    setUpdating(doc);
    setDocStatus(doc.status === 'received' ? 'received' : 'received'); // default action is mark as received
    setDocDate(today); // default to today
    setDocRemarks(doc.remarks || '');
  };

  const updateMutation = useMutation({
    mutationFn: (data) => updateDocumentChecklist(applicationId, data),
    onSuccess: (_, variables) => {
      // Update local state immediately — no waiting for refetch
      setLocalChecklist(prev =>
        prev.map(doc =>
          doc._id === variables.documentId
            ? { ...doc, status: variables.status, remarks: variables.remarks ?? doc.remarks, receivedDate: variables.receivedDate }
            : doc
        )
      );
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Document updated');
      setUpdating(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const receivedCount = localChecklist.filter((d) => d.status === 'received').length;
  const total = localChecklist.length;
  const pct = total ? Math.round((receivedCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Document Completion</span>
          <span className="text-sm font-bold text-primary-600">{receivedCount}/{total} received ({pct}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {localChecklist.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm font-medium">No documents in checklist</p>
            <p className="text-xs mt-1">
              Go to <span className="font-semibold text-primary-600">Configuration → Document Types</span> to add documents for Bank Loans.
            </p>
          </div>
        )}
        {localChecklist.map((doc) => (
          <div key={doc._id} className={`border rounded-xl p-4 transition-colors ${
            doc.status === 'received' ? 'border-green-200 bg-green-50/40' : 'border-red-100 bg-red-50/30'
          }`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {doc.status === 'received'
                    ? <span className="text-green-500 text-base">✔</span>
                    : <span className="text-red-400 text-base">○</span>}
                  {doc.documentName}
                  {doc.isRequired && <span className="text-[10px] text-danger-500 font-semibold bg-danger-50 px-1.5 py-0.5 rounded">Required</span>}
                </p>
                {doc.remarks && <p className="text-xs text-gray-400 mt-0.5 ml-6">{doc.remarks}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge color={DOCUMENT_STATUS_COLORS[doc.status] || 'gray'}>
                  {DOCUMENT_STATUSES.find((s) => s.value === doc.status)?.label || doc.status}
                </Badge>
                {doc.status !== 'received' && (
                  <button
                    onClick={() => openUpdate(doc)}
                    className="text-xs text-primary-600 hover:underline font-medium"
                  >Mark Received</button>
                )}
                {doc.status === 'received' && (
                  <button
                    onClick={() => openUpdate(doc)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                  >Edit</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Update modal */}
      <Modal isOpen={!!updating} onClose={() => setUpdating(null)} title={`Update: ${updating?.documentName}`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label-base">Status</label>
            <select className="input-base" value={docStatus} onChange={(e) => setDocStatus(e.target.value)}>
              {DOCUMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Received Date</label>
            <input type="date" className="input-base" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>
          <div>
            <label className="label-base">Remarks</label>
            <textarea className="input-base resize-none" rows={2} value={docRemarks} onChange={(e) => setDocRemarks(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setUpdating(null)}>Cancel</Button>
            <Button size="sm" loading={updateMutation.isPending}
              onClick={() => updateMutation.mutate({
                documentId: updating._id,
                status: docStatus,
                receivedDate: docDate || undefined,
                remarks: docRemarks || undefined,
              })}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const QueryManager = ({ applicationId, queries, readonly }) => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [newQueryOpen, setNewQueryOpen] = useState(false);
  const [editQuery, setEditQuery] = useState(null);

  const { register: regNew, handleSubmit: hsNew, reset: resetNew } = useForm();
  const { register: regEdit, handleSubmit: hsEdit, reset: resetEdit } = useForm();

  const addMutation = useMutation({
    mutationFn: (data) => addQuery(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      toast.success('Query added');
      resetNew();
      setNewQueryOpen(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add query'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ queryId, data }) => updateQuery(applicationId, queryId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      toast.success('Query updated');
      setEditQuery(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  return (
    <div className="space-y-4">
      {!readonly && can('bankLoans.update') && (
        <div className="flex justify-end">
          <Button size="sm" icon={Plus} onClick={() => setNewQueryOpen(true)}>Add Query</Button>
        </div>
      )}

      {(queries ?? []).length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">No queries raised yet.</div>
      )}

      {(queries ?? []).map((q) => (
        <div key={q._id} className="border border-gray-100 rounded-xl p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-mono text-gray-400">{q.queryNumber}</span>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{q.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge color={QUERY_STATUS_COLORS[q.status] || 'gray'}>{q.status}</Badge>
              <Badge color={PRIORITY_COLORS[q.priority] || 'gray'}>{q.priority}</Badge>
              {!readonly && can('bankLoans.update') && (
                <button onClick={() => { setEditQuery(q); resetEdit({ status: q.status, response: q.response, resolutionRemarks: q.resolutionRemarks, resolutionDate: q.resolutionDate?.slice(0, 10) }); }}
                  className="text-xs text-primary-600 hover:underline">Update</button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            <span>Raised: {formatDate(q.queryRaisedDate)}</span>
            <span>By: {q.queryRaisedBy}</span>
            {q.category && <span>Category: {q.category}</span>}
          </div>
          {q.response && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">Response: {q.response}</p>}
        </div>
      ))}

      {/* Add Query Modal */}
      <Modal isOpen={newQueryOpen} onClose={() => setNewQueryOpen(false)} title="Add New Query" size="md">
        <form onSubmit={hsNew((d) => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label-base">Description<span className="text-danger-500 ml-0.5">*</span></label>
            <textarea className="input-base resize-none" rows={3} {...regNew('description', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Category</label>
              <select className="input-base" {...regNew('category')}>
                {QUERY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Priority</label>
              <select className="input-base" {...regNew('priority')}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <Input label="Raised By" {...regNew('queryRaisedBy')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewQueryOpen(false)} type="button">Cancel</Button>
            <Button type="submit" loading={addMutation.isPending}>Add Query</Button>
          </div>
        </form>
      </Modal>

      {/* Update Query Modal */}
      <Modal isOpen={!!editQuery} onClose={() => setEditQuery(null)} title="Update Query" size="md">
        <form onSubmit={hsEdit((d) => updateMutation.mutate({ queryId: editQuery._id, data: d }))} className="space-y-4">
          <div>
            <label className="label-base">Status</label>
            <select className="input-base" {...regEdit('status')}>
              {QUERY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Response</label>
            <textarea className="input-base resize-none" rows={2} {...regEdit('response')} />
          </div>
          <div>
            <label className="label-base">Resolution Remarks</label>
            <textarea className="input-base resize-none" rows={2} {...regEdit('resolutionRemarks')} />
          </div>
          <Input label="Resolution Date" type="date" {...regEdit('resolutionDate')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditQuery(null)} type="button">Cancel</Button>
            <Button type="submit" loading={updateMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const TimelineView = ({ applicationId, timeline, readonly }) => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [noteOpen, setNoteOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const addNote = useMutation({
    mutationFn: (data) => addTimelineEntry(applicationId, { ...data, activityType: 'note' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      toast.success('Note added');
      reset();
      setNoteOpen(false);
    },
  });

  const typeIcons = { 'status-change': '🔄', 'document-update': '📄', query: '❓', note: '📝', 'portal-update': '🌐', assignment: '👤' };

  return (
    <div className="space-y-4">
      {!readonly && can('bankLoans.update') && (
        <div className="flex justify-end">
          <Button size="sm" icon={Plus} onClick={() => setNoteOpen(true)}>Add Note</Button>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
        <div className="space-y-4">
          {(timeline ?? []).map((entry, i) => (
            <div key={entry._id || i} className="flex gap-4 relative">
              <div className="relative z-10 shrink-0 h-10 w-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-base">
                {typeIcons[entry.activityType] || '📌'}
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl p-3 min-w-0">
                <p className="text-sm font-medium text-gray-800">{entry.activity}</p>
                {entry.statusChange && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <StatusBadge status={entry.statusChange.from} /> → <StatusBadge status={entry.statusChange.to} />
                  </p>
                )}
                {entry.remarks && <p className="text-xs text-gray-500 mt-1 italic">"{entry.remarks}"</p>}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                  <span>{formatDateTime(entry.activityDate)}</span>
                  {entry.performedBy?.fullName && <span>· {entry.performedBy.fullName}</span>}
                </div>
              </div>
            </div>
          ))}
          {(timeline ?? []).length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8 pl-10">No activity recorded yet.</p>
          )}
        </div>
      </div>

      <Modal isOpen={noteOpen} onClose={() => setNoteOpen(false)} title="Add Manual Note" size="sm">
        <form onSubmit={handleSubmit((d) => addNote.mutate(d))} className="space-y-4">
          <div>
            <label className="label-base">Note<span className="text-danger-500 ml-0.5">*</span></label>
            <textarea className="input-base resize-none" rows={3} {...register('activity', { required: true })} />
          </div>
          <div>
            <label className="label-base">Remarks</label>
            <textarea className="input-base resize-none" rows={2} {...register('remarks')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteOpen(false)} type="button">Cancel</Button>
            <Button type="submit" loading={addNote.isPending}>Add Note</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ─── AIF Credentials Panel ────────────────────────────────────────────────────

const AifCredentialsPanel = ({ applicationId, credentials }) => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    email: credentials?.email ?? '',
    mobile: credentials?.mobile ?? '',
    password: '',
  });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    setForm({ email: credentials?.email ?? '', mobile: credentials?.mobile ?? '', password: '' });
  }, [credentials]);

  const mutation = useMutation({
    mutationFn: (data) => updateAifCredentials(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('AIF credentials saved');
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('bankLoans.update');

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Agri Infrastructure Fund (AIF)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Portal login credentials for the AIF application</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-4">
          {[['Email ID', credentials?.email], ['Mobile No.', credentials?.mobile], ['Password', credentials?._passwordEncrypted ? '••••••••' : null]].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <span className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value || 'Not set'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-100">
          <div>
            <label className="label-base">Email ID</label>
            <input
              type="email"
              className="input-base"
              placeholder="email@example.com"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-base">Mobile No.</label>
            <input
              type="tel"
              className="input-base"
              placeholder="10-digit mobile number"
              value={form.mobile}
              onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-base">Password {credentials?._passwordEncrypted && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input-base pr-16"
                placeholder={credentials?._passwordEncrypted ? 'Enter new password to change' : 'Set password'}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium"
                onClick={() => setShowPass(v => !v)}
              >{showPass ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate(form)}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Loan Preparation Panel ────────────────────────────────────────────────────

const LOAN_PREP_META = {
  'not-started': { label: 'Not Started', color: 'gray'   },
  'in-progress':  { label: 'In Progress', color: 'yellow' },
  ready:          { label: 'Ready',       color: 'green'  },
};

const LoanPreparationPanel = ({ applicationId, loanPreparation }) => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    preparationStatus: 'not-started',
    preparationStartDate: '',
    preparationCompletedDate: '',
    loanAmountCalculated: '',
  });

  useEffect(() => {
    setForm({
      preparationStatus:        loanPreparation?.preparationStatus ?? 'not-started',
      preparationStartDate:     loanPreparation?.preparationStartDate ? new Date(loanPreparation.preparationStartDate).toISOString().slice(0, 10) : '',
      preparationCompletedDate: loanPreparation?.preparationCompletedDate ? new Date(loanPreparation.preparationCompletedDate).toISOString().slice(0, 10) : '',
      loanAmountCalculated:     loanPreparation?.loanAmountCalculated ?? '',
    });
  }, [loanPreparation]);

  const mutation = useMutation({
    mutationFn: (data) => updateLoanPreparation(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Loan preparation saved');
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('bankLoans.update');
  const prepMeta = LOAN_PREP_META[loanPreparation?.preparationStatus] || LOAN_PREP_META['not-started'];

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Loan Preparation</h3>
          <p className="text-xs text-gray-400 mt-0.5">Track preparation status before bank submission</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Status</span>
            <Badge color={prepMeta.color}>{prepMeta.label}</Badge>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Loan Amount Calculated</span>
            <span className="text-gray-800">{loanPreparation?.loanAmountCalculated ? `₹${Number(loanPreparation.loanAmountCalculated).toLocaleString('en-IN')}` : <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Start Date</span>
            <span className="text-gray-800">{loanPreparation?.preparationStartDate ? new Date(loanPreparation.preparationStartDate).toLocaleDateString('en-IN') : <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Completed Date</span>
            <span className="text-gray-800">{loanPreparation?.preparationCompletedDate ? new Date(loanPreparation.preparationCompletedDate).toLocaleDateString('en-IN') : <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Status</label>
              <select className="input-base" value={form.preparationStatus} onChange={e => setForm(f => ({ ...f, preparationStatus: e.target.value }))}>
                {Object.entries(LOAN_PREP_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Loan Amount Calculated (₹)</label>
              <input type="number" className="input-base" placeholder="0"
                value={form.loanAmountCalculated} onChange={e => setForm(f => ({ ...f, loanAmountCalculated: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Start Date</label>
              <input type="date" className="input-base"
                value={form.preparationStartDate} onChange={e => setForm(f => ({ ...f, preparationStartDate: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Completed Date</label>
              <input type="date" className="input-base"
                value={form.preparationCompletedDate} onChange={e => setForm(f => ({ ...f, preparationCompletedDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({
              ...form,
              preparationStartDate:     form.preparationStartDate || undefined,
              preparationCompletedDate: form.preparationCompletedDate || undefined,
              loanAmountCalculated:     form.loanAmountCalculated || undefined,
            })}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Loan Sanction Panel ────────────────────────────────────────────────────────

const SANCTION_META = {
  pending:    { label: 'Pending',    color: 'yellow' },
  sanctioned: { label: 'Sanctioned', color: 'green'  },
  rejected:   { label: 'Rejected',   color: 'red'    },
};

const LoanSanctionPanel = ({ applicationId, loanSanction }) => {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    sanctionStatus: 'pending',
    sanctionDate: '',
    sanctionedAmount: '',
    sanctionLetterNumber: '',
    sanctionConditions: '',
    rejectionReason: '',
  });

  useEffect(() => {
    setForm({
      sanctionStatus:       loanSanction?.sanctionStatus ?? 'pending',
      sanctionDate:         loanSanction?.sanctionDate ? new Date(loanSanction.sanctionDate).toISOString().slice(0, 10) : '',
      sanctionedAmount:     loanSanction?.sanctionedAmount ?? '',
      sanctionLetterNumber: loanSanction?.sanctionLetterNumber ?? '',
      sanctionConditions:   loanSanction?.sanctionConditions ?? '',
      rejectionReason:      loanSanction?.rejectionReason ?? '',
    });
  }, [loanSanction]);

  const mutation = useMutation({
    mutationFn: (data) => updateLoanSanction(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Loan sanction saved');
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('bankLoans.update');
  const meta = SANCTION_META[loanSanction?.sanctionStatus] || SANCTION_META.pending;

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Loan Sanction</h3>
          <p className="text-xs text-gray-400 mt-0.5">Bank loan sanction / rejection outcome</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
        )}
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        loanSanction?.sanctionStatus === 'sanctioned' ? 'bg-green-50 border-green-200' :
        loanSanction?.sanctionStatus === 'rejected'   ? 'bg-red-50 border-red-200' :
        'bg-yellow-50 border-yellow-200'
      }`}>
        <span className="text-2xl">
          {loanSanction?.sanctionStatus === 'sanctioned' ? '✅' : loanSanction?.sanctionStatus === 'rejected' ? '❌' : '⏳'}
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
          {loanSanction?.sanctionedAmount && loanSanction?.sanctionStatus === 'sanctioned' && (
            <p className="text-xs text-gray-500">₹{Number(loanSanction.sanctionedAmount).toLocaleString('en-IN')} sanctioned</p>
          )}
          {loanSanction?.rejectionReason && loanSanction?.sanctionStatus === 'rejected' && (
            <p className="text-xs text-red-600">{loanSanction.rejectionReason}</p>
          )}
        </div>
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Sanction Date</span>
            <span className="text-gray-800">{loanSanction?.sanctionDate ? new Date(loanSanction.sanctionDate).toLocaleDateString('en-IN') : <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Sanctioned Amount</span>
            <span className="text-gray-800">{loanSanction?.sanctionedAmount ? `₹${Number(loanSanction.sanctionedAmount).toLocaleString('en-IN')}` : <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Letter Number</span>
            <span className="text-gray-800 font-mono">{loanSanction?.sanctionLetterNumber || <span className="text-gray-300 italic">Not set</span>}</span>
          </div>
          {loanSanction?.sanctionConditions && (
            <div className="col-span-2 flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Conditions</span>
              <span className="text-gray-800">{loanSanction.sanctionConditions}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Sanction Status</label>
              <select className="input-base" value={form.sanctionStatus} onChange={e => setForm(f => ({ ...f, sanctionStatus: e.target.value }))}>
                {Object.entries(SANCTION_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Sanction Date</label>
              <input type="date" className="input-base"
                value={form.sanctionDate} onChange={e => setForm(f => ({ ...f, sanctionDate: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Sanctioned Amount (₹)</label>
              <input type="number" className="input-base"
                value={form.sanctionedAmount} onChange={e => setForm(f => ({ ...f, sanctionedAmount: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Sanction Letter No.</label>
              <input className="input-base font-mono"
                value={form.sanctionLetterNumber} onChange={e => setForm(f => ({ ...f, sanctionLetterNumber: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label-base">Conditions</label>
              <textarea className="input-base resize-none" rows={2}
                value={form.sanctionConditions} onChange={e => setForm(f => ({ ...f, sanctionConditions: e.target.value }))} />
            </div>
            {form.sanctionStatus === 'rejected' && (
              <div className="col-span-2">
                <label className="label-base">Rejection Reason <span className="text-danger-500">*</span></label>
                <textarea className="input-base resize-none" rows={2} placeholder="Why was the loan rejected?"
                  value={form.rejectionReason} onChange={e => setForm(f => ({ ...f, rejectionReason: e.target.value }))} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate({
              ...form,
              sanctionDate:     form.sanctionDate || undefined,
              sanctionedAmount: form.sanctionedAmount || undefined,
            })}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Application Info Panel (Editable) ────────────────────────────────────────

const ApplicationInfoPanel = ({ applicationId, app, qc, can }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    loanAmount: '', loanScheme: '', loanType: '',
    bankRefNumber: '', applicationDate: '', priority: 'medium',
  });

  useEffect(() => {
    setForm({
      loanAmount:      app?.loanAmount ?? '',
      loanScheme:      app?.loanScheme ?? '',
      loanType:        app?.loanType ?? '',
      bankRefNumber:   app?.bankRefNumber ?? '',
      applicationDate: app?.applicationDate ? new Date(app.applicationDate).toISOString().slice(0, 10) : '',
      priority:        app?.priority ?? 'medium',
    });
  }, [app]);

  const mutation = useMutation({
    mutationFn: (data) => updateBankLoan(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loan', applicationId] });
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Application details updated');
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('bankLoans.update');

  return (
    <div className="space-y-6">
      {/* Editable section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Application Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">Loan amount, scheme, type and other core details</p>
          </div>
          {canEdit && !editing && (
            <button className="text-sm text-primary-600 font-medium hover:underline" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {[
              ['Application ID',   app?.applicationId],
              ['Loan Amount',      app?.loanAmount ? `₹${Number(app.loanAmount).toLocaleString('en-IN')}` : null],
              ['Loan Scheme',      app?.loanScheme],
              ['Loan Type',        app?.loanType],
              ['Bank Ref No.',     app?.bankRefNumber],
              ['Application Date', formatDate(app?.applicationDate)],
              ['Priority',         app?.priority],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-400 font-medium">{label}</span>
                <span className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value || 'Not set'}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-base">Loan Amount (₹) <span className="text-danger-500">*</span></label>
                <input type="number" className="input-base" placeholder="e.g. 5000000"
                  value={form.loanAmount} onChange={e => setForm(f => ({ ...f, loanAmount: e.target.value }))} />
              </div>
              <div>
                <label className="label-base">Application Date</label>
                <input type="date" className="input-base"
                  value={form.applicationDate} onChange={e => setForm(f => ({ ...f, applicationDate: e.target.value }))} />
              </div>
              <div>
                <label className="label-base">Loan Scheme</label>
                <input className="input-base" placeholder="e.g. AIF, PMEGP"
                  value={form.loanScheme} onChange={e => setForm(f => ({ ...f, loanScheme: e.target.value }))} />
              </div>
              <div>
                <label className="label-base">Loan Type</label>
                <input className="input-base" placeholder="e.g. Term Loan, Working Capital"
                  value={form.loanType} onChange={e => setForm(f => ({ ...f, loanType: e.target.value }))} />
              </div>
              <div>
                <label className="label-base">Bank Reference No.</label>
                <input className="input-base font-mono" placeholder="Bank ref number"
                  value={form.bankRefNumber} onChange={e => setForm(f => ({ ...f, bankRefNumber: e.target.value }))} />
              </div>
              <div>
                <label className="label-base">Priority</label>
                <select className="input-base" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" loading={mutation.isPending}
                onClick={() => mutation.mutate({
                  ...form,
                  loanAmount:      form.loanAmount      ? Number(form.loanAmount) : undefined,
                  applicationDate: form.applicationDate || undefined,
                })}>
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Client details (read-only) */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Information</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            ['Client Name',   app?.clientId?.name],
            ['Client Mobile', app?.clientId?.mobile],
            ['Business',      app?.clientId?.businessName],
            ['Bank Name',     app?.clientId?.bankName],
            ['Branch',        app?.clientId?.branchName],
            ['Bank Contact',  app?.clientId?.bankContactPerson],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">{label}</span>
              <span className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Application Detail Page ────────────────────────────────────────────────────

const BankLoanDetail = ({ application, onBack, initialTab = 'info' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [statusModal, setStatusModal] = useState(false);
  const qc = useQueryClient();
  const { can } = useAuth();
  const statuses = useConfigStore((s) => s.bankLoanStatuses);

  // Fetch full application data in background for documents/queries/timeline
  // Use list-row data immediately so there's no blocking spinner
  const { data: freshApp, isLoading: detailLoading, isError: detailError } = useQuery({
    queryKey: ['bank-loan', application._id],
    queryFn: () => getBankLoanById(application._id),
    select: (res) => res.data?.data ?? res.data,
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  // Show immediately from list data; upgrade to fresh data when ready
  const app = freshApp ?? application;
  const days = daysAgo(app.applicationDate);
  const tabs = [
    { id: 'info',          label: 'Application Info' },
    { id: 'loan-prep',     label: 'Loan Prep' },
    { id: 'loan-sanction', label: 'Loan Sanction' },
    { id: 'documents',    label: `Documents (${app.documentChecklist?.length ?? '…'})` },
    { id: 'queries',      label: `Queries (${app.queries?.length ?? 0})` },
    { id: 'timeline',     label: 'Timeline' },
    { id: 'status',       label: 'Status' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{app.applicationId}</h1>
          <p className="text-sm text-gray-500">{app.clientId?.name ?? 'N/A'} · Bank Loan</p>
        </div>
        <div className="flex items-center gap-2">
          {detailLoading && (
            <div className="animate-spin h-4 w-4 border-2 border-primary-400 border-t-transparent rounded-full" title="Loading full details..." />
          )}
          <StatusBadge status={app.currentStatus} size="lg" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Loan Amount', value: app.loanAmount ? `₹${Number(app.loanAmount).toLocaleString('en-IN')}` : '—' },
          { label: 'Days in Process', value: `${days} days` },
          { label: 'Priority', value: <Badge color={PRIORITY_COLORS[app.priority] || 'gray'}>{app.priority || 'normal'}</Badge> },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'loan-prep' && (
          <LoanPreparationPanel
            applicationId={app._id ?? application._id}
            loanPreparation={app.loanPreparation}
          />
        )}

        {activeTab === 'loan-sanction' && (
          <LoanSanctionPanel
            applicationId={app._id ?? application._id}
            loanSanction={app.loanSanction}
          />
        )}

        {activeTab === 'info' && (
          <ApplicationInfoPanel
            applicationId={app._id ?? application._id}
            app={app}
            qc={qc}
            can={can}
          />
        )}

        {activeTab === 'documents' && (
          detailLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
              <div className="animate-spin h-7 w-7 border-4 border-primary-500 border-t-transparent rounded-full" />
              <p className="text-sm">Loading document checklist...</p>
            </div>
          ) : (
            <DocumentChecklist applicationId={app._id ?? application._id} checklist={app.documentChecklist ?? application.documentChecklist} />
          )
        )}

        {activeTab === 'queries' && (
          <QueryManager applicationId={app._id} queries={app.queries} readonly={!can('bankLoans.update')} />
        )}

        {activeTab === 'timeline' && (
          <TimelineView applicationId={app._id} timeline={app.timeline} readonly={!can('bankLoans.update')} />
        )}

        {activeTab === 'status' && (
          <div className="space-y-4">
            <Card header="Change Status">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Current Status</p>
                  <StatusBadge status={app.currentStatus} size="lg" />
                  <p className="text-xs text-gray-400 mt-2">{days} days since application</p>
                </div>
                {can('bankLoans.update') && (
                  <Button onClick={() => setStatusModal(true)}>Change Status</Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      <StatusUpdateModal isOpen={statusModal} onClose={() => setStatusModal(false)} application={app} statuses={statuses} />
    </div>
  );
};



const BankLoans = () => {
  usePageTitle('Bank Loans');
  const { can } = useAuth();
  const qc = useQueryClient();
  const configStore = useConfigStore();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [detailApp, setDetailApp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const navigate  = useNavigate();
  const location   = useLocation();

  // Auto-open an application passed from the Dashboard drill-down
  useEffect(() => {
    if (location.state?.openApp) {
      setDetailApp({ app: location.state.openApp, initialTab: location.state.initialTab ?? 'info' });
      // Clear the state so back-navigation doesn't re-open it
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);


  const debounced = useDebounce(search);
  useEffect(() => { configStore.fetchConfigurations(); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['bank-loans', { search: debounced, page, limit }],
    queryFn: () => getBankLoans({ search: debounced, page, limit }),
    select: (res) => res.data,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { limit: 200 }],
    queryFn: () => getClients({ limit: 200 }),
    enabled: formOpen,
    select: (res) => res.data.data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteBankLoan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Application deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const { register, handleSubmit, reset, formState: { errors: createErrors } } = useForm();

  const createMutation = useMutation({
    mutationFn: (data) => createBankLoan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bank-loans'] });
      toast.success('Bank loan application created');
      reset();
      setFormOpen(false);
    },
    onError: (e) => {
      const apiErrors = e.response?.data?.errors;
      if (apiErrors && apiErrors.length > 0) {
        apiErrors.forEach(err => toast.error(`${err.field ? err.field + ': ' : ''}${err.message}`, { duration: 5000 }));
      } else {
        toast.error(e.response?.data?.message || 'Create failed');
      }
    },
  });

  if (detailApp) {
    const application = detailApp?.app ?? detailApp;
    const initialTab  = detailApp?.initialTab ?? 'info';
    return <BankLoanDetail application={application} onBack={() => setDetailApp(null)} initialTab={initialTab} />;
  }

  const columns = [
    { key: 'applicationId', label: 'Application ID', width: '140px' },
    { key: 'client', label: 'Client', render: (row) => row.clientId?.name ?? '—' },
    { key: 'loanAmount', label: 'Loan Amount', render: (row) => row.loanAmount ? `₹${Number(row.loanAmount).toLocaleString('en-IN')}` : '—' },
    { key: 'currentStatus', label: 'Status', render: (row) => <StatusBadge status={row.currentStatus} /> },
    { key: 'priority', label: 'Priority', render: (row) => <Badge color={PRIORITY_COLORS[row.priority] || 'gray'}>{row.priority || 'normal'}</Badge> },
    { key: 'applicationDate', label: 'Date', render: (row) => formatDate(row.applicationDate) },
    { key: 'days', label: 'Days', render: (row) => `${daysAgo(row.applicationDate)}d` },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          {can('bankLoans.delete') && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
              className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"
              title="Delete"
            >
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
        <h1 className="page-title">Bank Loan Applications</h1>
        {can('bankLoans.create') && <Button icon={Plus} onClick={() => setFormOpen(true)}>New Application</Button>}
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-base pl-9" placeholder="Search applications..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Table columns={columns} data={data?.data ?? []} loading={isLoading}
        pagination={data?.pagination} onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No bank loan applications" emptyDescription="Create a new application to get started."
        emptyAction={can('bankLoans.create') ? () => setFormOpen(true) : undefined}
        emptyActionLabel="New Application"
        onRowClick={(row) => setDetailApp(row)}
      />

      {/* Create Form Modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Bank Loan Application" size="lg">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label-base">Client<span className="text-danger-500 ml-0.5">*</span></label>
            <select className={`input-base ${createErrors.clientId ? 'input-error' : ''}`} {...register('clientId', { required: 'Client is required' })}>
              <option value="">Select client...</option>
              {(clientsData ?? []).filter(c => c.clientType === 'bank-loan' || c.clientType === 'both').map((c) => <option key={c._id} value={c._id}>{c.name} — {c.clientId}</option>)}
            </select>
            {createErrors.clientId && <p className="mt-1 text-xs text-danger-600">{createErrors.clientId.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Loan Amount (₹)<span className="text-danger-500 ml-0.5">*</span></label>
              <input type="number" className={`input-base ${createErrors.loanAmount ? 'input-error' : ''}`} placeholder="5000000"
                {...register('loanAmount', { required: 'Loan amount is required', min: { value: 0, message: 'Amount must be positive' } })} />
              {createErrors.loanAmount && <p className="mt-1 text-xs text-danger-600">{createErrors.loanAmount.message}</p>}
            </div>
            <Input label="Loan Scheme / Type" {...register('loanScheme')} />
            <div>
              <label className="label-base">Application Date</label>
              <input type="date" className={`input-base ${createErrors.applicationDate ? 'input-error' : ''}`}
                defaultValue={new Date().toISOString().slice(0, 10)}
                {...register('applicationDate', { validate: v => !v || !isNaN(Date.parse(v)) || 'Enter a valid date (YYYY-MM-DD)' })} />
              {createErrors.applicationDate && <p className="mt-1 text-xs text-danger-600">{createErrors.applicationDate.message}</p>}
            </div>
            <div>
              <label className="label-base">Priority</label>
              <select className="input-base" {...register('priority')}>
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFormOpen(false)} type="button">Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create Application</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)} loading={deleteMutation.isPending}
        title="Delete Application" message={`Delete "${deleteTarget?.applicationId}"? This cannot be undone.`} />
    </div>
  );
};

export default BankLoans;
