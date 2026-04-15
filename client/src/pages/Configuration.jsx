import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import { getDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType, getStatusOptions, createStatusOption, updateStatusOption } from '../services/configService';
import useConfigStore from '../store/configStore';
import usePageTitle from '../hooks/usePageTitle';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Badge from '../components/common/Badge';

const DocTypeForm = ({ doc, type, onSuccess, onClose }) => {
  const qc = useQueryClient();
  const configStore = useConfigStore();
  const isEdit = !!doc;

  const { register, handleSubmit } = useForm({
    defaultValues: doc ? { name: doc.name, description: doc.description, required: doc.isRequired, displayOrder: doc.displayOrder } : { required: false, displayOrder: 99 },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateDocumentType(doc._id, { ...data, type }) : createDocumentType({ ...data, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config-docs', type] });
      configStore.invalidate();
      toast.success(`Document type ${isEdit ? 'updated' : 'created'}`);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Input label="Document Name" required {...register('name', { required: true })} />
      <div>
        <label className="label-base">Description</label>
        <textarea className="input-base resize-none" rows={2} {...register('description')} />
      </div>
      <Input label="Display Order" type="number" {...register('displayOrder')} />
      <div className="flex items-center gap-3">
        <input type="checkbox" id="doc-required" className="h-4 w-4 rounded text-primary-600" {...register('required')} />
        <label htmlFor="doc-required" className="text-sm text-gray-700">Required document</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  );
};

const StatusForm = ({ status, type, onSuccess, onClose }) => {
  const qc = useQueryClient();
  const configStore = useConfigStore();
  const isEdit = !!status;

  const { register, handleSubmit } = useForm({
    defaultValues: status ? { label: status.label, order: status.order } : { order: 99 },
  });

  const mutation = useMutation({
    mutationFn: (data) => isEdit ? updateStatusOption(status._id, { ...data, type }) : createStatusOption({ ...data, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config-statuses', type] });
      configStore.invalidate();
      toast.success(`Status ${isEdit ? 'updated' : 'created'}`);
      onSuccess?.();
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <Input label="Status Label" required {...register('label', { required: true })} />
      <Input label="Display Order" type="number" {...register('order')} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
        <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  );
};

const Configuration = () => {
  usePageTitle('Configuration');
  const [mainTab, setMainTab] = useState('documents');
  const [docType, setDocType] = useState('bank-loan');
  const [statusType, setStatusType] = useState('bank-loan');
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);

  const { data: docs, isLoading: loadingDocs } = useQuery({
    queryKey: ['config-docs', docType],
    queryFn: () => getDocumentTypes(docType),
    select: (res) => res.data.data,
  });

  const { data: statuses, isLoading: loadingStatuses } = useQuery({
    queryKey: ['config-statuses', statusType],
    queryFn: () => getStatusOptions(statusType),
    select: (res) => res.data.data,
  });

  const qc = useQueryClient();
  const configStore = useConfigStore();

  const deleteDocMutation = useMutation({
    mutationFn: (id) => deleteDocumentType(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['config-docs', docType] }); configStore.invalidate(); toast.success('Deleted'); setDeleteDocTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const typeButtons = (current, setCurrent) => ['bank-loan', 'subsidy'].map((t) => (
    <button key={t} onClick={() => setCurrent(t)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${current === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {t === 'bank-loan' ? 'Bank Loan' : 'Subsidy'}
    </button>
  ));

  return (
    <div className="space-y-5">
      <h1 className="page-title">Configuration</h1>

      {/* Main Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {[{ id: 'documents', label: 'Document Types' }, { id: 'statuses', label: 'Status Options' }].map((t) => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${mainTab === t.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Document Types */}
      {mainTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">{typeButtons(docType, setDocType)}</div>
            <Button icon={Plus} size="sm" onClick={() => { setSelectedDoc(null); setDocModalOpen(true); }}>Add Document Type</Button>
          </div>

          {loadingDocs ? <div className="py-8 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="space-y-2">
              {(docs ?? []).map((doc) => (
                <div key={doc._id} className="card p-4 flex items-center gap-4">
                  <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                      <Badge color={doc.isRequired ? 'red' : 'gray'} size="sm">{doc.isRequired ? 'Required' : 'Optional'}</Badge>
                      <Badge color={doc.isActive ? 'green' : 'gray'} size="sm">{doc.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    {doc.description && <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>}
                  </div>
                  <span className="text-xs text-gray-300">#{doc.displayOrder}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setSelectedDoc(doc); setDocModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteDocTarget(doc)} className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {(docs ?? []).length === 0 && <p className="text-center text-gray-400 text-sm py-8">No document types configured.</p>}
            </div>
          )}
        </div>
      )}

      {/* Status Options */}
      {mainTab === 'statuses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">{typeButtons(statusType, setStatusType)}</div>
            <Button icon={Plus} size="sm" onClick={() => { setSelectedStatus(null); setStatusModalOpen(true); }}>Add Status</Button>
          </div>

          {loadingStatuses ? <div className="py-8 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="space-y-2">
              {(statuses ?? []).map((s, i) => (
                <div key={s._id} className="card p-4 flex items-center gap-4">
                  <span className="text-xs text-gray-300 w-6 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  </div>
                  <Badge color={s.isActive !== false ? 'green' : 'gray'} size="sm">{s.isActive !== false ? 'Active' : 'Inactive'}</Badge>
                  <button onClick={() => { setSelectedStatus(s); setStatusModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(statuses ?? []).length === 0 && <p className="text-center text-gray-400 text-sm py-8">No statuses configured.</p>}
            </div>
          )}
        </div>
      )}

      {/* Doc Type Modal */}
      <Modal isOpen={docModalOpen} onClose={() => { setDocModalOpen(false); setSelectedDoc(null); }}
        title={selectedDoc ? 'Edit Document Type' : 'Add Document Type'} size="md">
        <DocTypeForm doc={selectedDoc} type={docType}
          onSuccess={() => { setDocModalOpen(false); setSelectedDoc(null); }}
          onClose={() => { setDocModalOpen(false); setSelectedDoc(null); }} />
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={statusModalOpen} onClose={() => { setStatusModalOpen(false); setSelectedStatus(null); }}
        title={selectedStatus ? 'Edit Status' : 'Add Status'} size="sm">
        <StatusForm status={selectedStatus} type={statusType}
          onSuccess={() => { setStatusModalOpen(false); setSelectedStatus(null); }}
          onClose={() => { setStatusModalOpen(false); setSelectedStatus(null); }} />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={!!deleteDocTarget} onClose={() => setDeleteDocTarget(null)}
        onConfirm={() => deleteDocMutation.mutate(deleteDocTarget._id)} loading={deleteDocMutation.isPending}
        title="Delete Document Type"
        message={`Delete "${deleteDocTarget?.name}"? This affects all new applications using this type.`} />
    </div>
  );
};

export default Configuration;
