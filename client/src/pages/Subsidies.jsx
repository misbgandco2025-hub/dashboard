import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Trash2, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import {
  getSubsidies, getSubsidyById, createSubsidy, deleteSubsidy,
  updateSubsidyStatus, updateSubsidyDocumentChecklist,
  addSubsidyQuery, updateSubsidyQuery, addSubsidyTimelineEntry,
  updateGocCredentials,
} from '../services/subsidyService';
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
import { formatDate, daysAgo } from '../utils/dateFormat';
import { PRIORITIES, PRIORITY_COLORS } from '../utils/constants';

// ─── GOC Credentials Panel ────────────────────────────────────────────────────

const GocCredentialsPanel = ({ applicationId, credentials, qc, can }) => {
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
    mutationFn: (data) => updateGocCredentials(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subsidies'] });
      toast.success('GOC credentials saved');
      setEditing(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('subsidies.update');

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">General Officer Certificate (GOC)</h3>
          <p className="text-xs text-gray-400 mt-0.5">Portal login credentials for the GOC application</p>
        </div>
        {canEdit && !editing && (
          <button
            className="text-sm text-primary-600 font-medium hover:underline"
            onClick={() => setEditing(true)}
          >Edit</button>
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
            <input type="email" className="input-base" placeholder="email@example.com"
              value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Mobile No.</label>
            <input type="tel" className="input-base" placeholder="10-digit mobile number"
              value={form.mobile} onChange={(e) => setForm(f => ({ ...f, mobile: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">
              Password {credentials?._passwordEncrypted && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input-base pr-16"
                placeholder={credentials?._passwordEncrypted ? 'Enter new password to change' : 'Set password'}
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium"
                onClick={() => setShowPass(v => !v)}>{showPass ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={() => setEditing(false)}>Cancel</button>
            <button className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              disabled={mutation.isPending} onClick={() => mutation.mutate(form)}>
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const Subsidies = () => {
  usePageTitle('Subsidies');
  const { can } = useAuth();
  const qc = useQueryClient();
  const configStore = useConfigStore();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [detailApp, setDetailApp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('goc');
  const [statusModal, setStatusModal] = useState(false);

  const debounced = useDebounce(search);

  useState(() => { configStore.fetchConfigurations(); }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['subsidies', { search: debounced, page, limit }],
    queryFn: () => getSubsidies({ search: debounced, page, limit }),
    select: (res) => res.data,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { limit: 200 }],
    queryFn: () => getClients({ limit: 200 }),
    enabled: formOpen,
    select: (res) => res.data.data,
  });

  const { data: detailData } = useQuery({
    queryKey: ['subsidy', detailApp?._id],
    queryFn: () => getSubsidyById(detailApp._id),
    enabled: !!detailApp,
    select: (res) => res.data.data,
  });

  const app = detailData ?? detailApp;

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSubsidy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subsidies'] }); toast.success('Deleted'); setDeleteTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const statusMutation = useMutation({
    mutationFn: (data) => updateSubsidyStatus(detailApp._id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subsidy', detailApp._id] }); toast.success('Status updated'); setStatusModal(false); },
  });

  const { register: regCreate, handleSubmit: hsCreate, reset: resetCreate } = useForm();
  const { register: regStatus, handleSubmit: hsStatus, reset: resetStatus } = useForm();

  const createMutation = useMutation({
    mutationFn: (data) => createSubsidy(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subsidies'] }); toast.success('Subsidy application created'); resetCreate(); setFormOpen(false); },
    onError: (e) => toast.error(e.response?.data?.message || 'Create failed'),
  });

  if (detailApp && app) {
    const days = daysAgo(app.applicationDate);
    const tabs = [
      { id: 'goc', label: 'GOC' },
      { id: 'info', label: 'Application Info' },
      { id: 'documents', label: 'Documents' },
      { id: 'queries', label: `Queries (${app.queries?.length ?? 0})` },
      { id: 'timeline', label: 'Timeline' },
      { id: 'status', label: 'Status' },
    ];

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setDetailApp(null); setActiveTab('info'); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{app.applicationId}</h1>
            <p className="text-sm text-gray-500">{app.clientId?.name ?? 'N/A'} · Subsidy — {app.schemeName}</p>
          </div>
          <StatusBadge status={app.currentStatus} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Subsidy Amount', value: app.subsidyAmountApplied ? `₹${Number(app.subsidyAmountApplied).toLocaleString('en-IN')}` : '—' },
            { label: 'Project Cost', value: app.projectCost ? `₹${Number(app.projectCost).toLocaleString('en-IN')}` : '—' },
            { label: 'Days in Process', value: `${days} days` },
            { label: 'Scheme Type', value: app.schemeType || '—' },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="text-sm font-semibold text-gray-800 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          {activeTab === 'goc' && (
            <GocCredentialsPanel
              applicationId={app._id ?? detailApp._id}
              credentials={app.gocCredentials}
              qc={qc}
              can={can}
            />
          )}

          {activeTab === 'info' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                ['Application ID', app.applicationId], ['Scheme Name', app.schemeName],
                ['Scheme Type', app.schemeType], ['Department', app.departmentName],
                ['Subsidy Applied', app.subsidyAmountApplied ? `₹${Number(app.subsidyAmountApplied).toLocaleString('en-IN')}` : '—'],
                ['Project Cost', app.projectCost ? `₹${Number(app.projectCost).toLocaleString('en-IN')}` : '—'],
                ['Subsidy %', app.subsidyPercentage ? `${app.subsidyPercentage}%` : '—'],
                ['Application Date', formatDate(app.applicationDate)],
                ['Approved Amount', app.approvedAmount ? `₹${Number(app.approvedAmount).toLocaleString('en-IN')}` : '—'],
                ['Release Date', formatDate(app.releaseDate)],
                ['Client', app.clientId?.name], ['Client Mobile', app.clientId?.mobile],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-400 font-medium">{label}</span>
                  <span className="text-gray-800">{value || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-2">
              {(app.documentChecklist ?? []).length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No documents configured.</p>
              )}
              {(app.documentChecklist ?? []).map((doc) => (
                <div key={doc._id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-800">{doc.documentName}</p>
                  <Badge color={{ pending: 'gray', 'received-from-client': 'yellow', 'verified-by-bank': 'green' }[doc.status] || 'blue'}>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'queries' && (
            <div className="space-y-3">
              {(app.queries ?? []).map((q) => (
                <div key={q._id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">{q.description}</p>
                    <Badge color={{ open: 'red', 'in-progress': 'yellow', resolved: 'green', closed: 'gray' }[q.status] || 'gray'}>{q.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Raised: {formatDate(q.queryRaisedDate)} · {q.queryRaisedBy}</p>
                </div>
              ))}
              {(app.queries ?? []).length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No queries raised.</p>}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-3 relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
              {(app.timeline ?? []).map((entry, i) => (
                <div key={i} className="flex gap-4 relative">
                  <div className="relative z-10 shrink-0 h-10 w-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-base">
                    {{ 'status-change': '🔄', 'document-update': '📄', query: '❓', note: '📝' }[entry.activityType] || '📌'}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl p-3">
                    <p className="text-sm font-medium text-gray-800">{entry.activity}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(entry.activityDate)} · {entry.performedBy?.fullName || 'System'}</p>
                  </div>
                </div>
              ))}
              {(app.timeline ?? []).length === 0 && <p className="text-center text-gray-400 py-8 text-sm pl-10">No activity yet.</p>}
            </div>
          )}

          {activeTab === 'status' && (
            <Card header="Change Status">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Current</p>
                  <StatusBadge status={app.currentStatus} size="lg" />
                </div>
                {can('subsidies.update') && (
                  <Button onClick={() => setStatusModal(true)}>Change Status</Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Status Modal */}
        <Modal isOpen={statusModal} onClose={() => setStatusModal(false)} title="Update Status" size="md">
          <form onSubmit={hsStatus((d) => statusMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label-base">New Status<span className="text-danger-500 ml-0.5">*</span></label>
              <select className="input-base" {...regStatus('status', { required: true })}>
                <option value="">Select...</option>
                {configStore.subsidyStatuses.map((s) => <option key={s._id} value={s.label}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">Remarks<span className="text-danger-500 ml-0.5">*</span></label>
              <textarea className="input-base resize-none" rows={3} {...regStatus('remarks', { required: true })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStatusModal(false)} type="button">Cancel</Button>
              <Button type="submit" loading={statusMutation.isPending}>Update</Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  const columns = [
    { key: 'applicationId', label: 'Application ID', width: '140px' },
    { key: 'client', label: 'Client', render: (row) => row.clientId?.name ?? '—' },
    { key: 'schemeName', label: 'Scheme' },
    { key: 'subsidyAmountApplied', label: 'Amount', render: (row) => row.subsidyAmountApplied ? `₹${Number(row.subsidyAmountApplied).toLocaleString('en-IN')}` : '—' },
    { key: 'currentStatus', label: 'Status', render: (row) => <StatusBadge status={row.currentStatus} /> },
    { key: 'applicationDate', label: 'Date', render: (row) => formatDate(row.applicationDate) },
    { key: 'days', label: 'Days', render: (row) => `${daysAgo(row.applicationDate)}d` },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => setDetailApp(row)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"><Eye className="h-4 w-4" /></button>
          {can('subsidies.delete') && <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Subsidy Applications</h1>
        {can('subsidies.create') && <Button icon={Plus} onClick={() => setFormOpen(true)}>New Application</Button>}
      </div>

      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-base pl-9" placeholder="Search subsidies..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Table columns={columns} data={data?.data ?? []} loading={isLoading}
        pagination={data?.pagination} onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No subsidy applications" emptyDescription="Create a new subsidy application."
        emptyAction={can('subsidies.create') ? () => setFormOpen(true) : undefined}
        emptyActionLabel="New Application"
      />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Subsidy Application" size="lg">
        <form onSubmit={hsCreate((d) => createMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label-base">Client<span className="text-danger-500 ml-0.5">*</span></label>
            <select className="input-base" {...regCreate('clientId', { required: true })}>
              <option value="">Select client...</option>
              {(clientsData ?? []).map((c) => <option key={c._id} value={c._id}>{c.name} — {c.clientId}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Scheme Name" required {...regCreate('schemeName', { required: true })} />
            <Input label="Scheme Type" {...regCreate('schemeType')} />
            <Input label="Department Name" {...regCreate('departmentName')} />
            <div>
              <label className="label-base">Subsidy Amount Applied (₹)</label>
              <input type="number" className="input-base" {...regCreate('subsidyAmountApplied')} />
            </div>
            <div>
              <label className="label-base">Project Cost (₹)</label>
              <input type="number" className="input-base" {...regCreate('projectCost')} />
            </div>
            <div>
              <label className="label-base">Subsidy %</label>
              <input type="number" className="input-base" {...regCreate('subsidyPercentage')} />
            </div>
            <Input label="Application Date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} {...regCreate('applicationDate')} />
            <div>
              <label className="label-base">Priority</label>
              <select className="input-base" {...regCreate('priority')}>
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
        title="Delete Application" message={`Delete "${deleteTarget?.applicationId}"?`} />
    </div>
  );
};

export default Subsidies;
