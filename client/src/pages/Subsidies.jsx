import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Trash2, ChevronRight, Filter, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

import {
  getSubsidies, getSubsidyById, createSubsidy, deleteSubsidy,
  updateSubsidyStatus, updateSubsidyDocumentChecklist,
  addSubsidyQuery, updateSubsidyQuery, addSubsidyTimelineEntry,
  updateGocCredentials,
  updateSubsidyNhbDetails, updateSubsidyGocDetails,
  updateSubsidyPayment, updateSubsidyVerification,
  updateSubsidyLoanPrep, updateSubsidyBankSubmission,
  updateSubsidyBankSanction, updateSubsidyClaim,
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
import { PRIORITIES } from '../utils/constants';

// ─── Inline Badge Components ─────────────────────────────────────────────────

const SCHEME_META = {
  nhb:     { label: 'NHB',     color: 'green'  },
  general: { label: 'General', color: 'yellow' },
  aif:     { label: 'AIF',     color: 'purple' },
  none:    { label: '—',       color: 'gray'   },
};

const VERIFY_META = {
  'not-started': { label: 'Not Started', color: 'gray'   },
  pending:       { label: 'Pending',     color: 'yellow' },
  completed:     { label: 'Completed',   color: 'green'  },
};

const NHB_PORTAL_META = {
  'goc-new':        { label: 'GOC New',        color: 'gray'   },
  'goc-processing': { label: 'GOC Processing', color: 'blue'   },
  'query-issued':   { label: 'Query Issued',   color: 'red'    },
  'query-replied':  { label: 'Query Replied',  color: 'orange' },
  'goc-received':   { label: 'GOC Received',   color: 'green'  },
};

const GOC_STATUS_META = {
  'not-started': { label: 'Not Started', color: 'gray'   },
  applied:       { label: 'Applied',     color: 'blue'   },
  approved:      { label: 'Approved',    color: 'green'  },
  rejected:      { label: 'Rejected',    color: 'red'    },
};

const LOAN_PREP_META = {
  'not-started':  { label: 'Not Started',  color: 'gray'   },
  'in-progress':  { label: 'In Progress',  color: 'yellow' },
  ready:          { label: 'Ready',        color: 'green'  },
};

const BANK_SUB_META = {
  'not-submitted': { label: 'Not Submitted', color: 'gray'   },
  submitted:       { label: 'Submitted',     color: 'blue'   },
  'under-review':  { label: 'Under Review',  color: 'yellow' },
};

const SANCTION_META = {
  pending:    { label: 'Pending',    color: 'yellow' },
  sanctioned: { label: 'Sanctioned', color: 'green'  },
  rejected:   { label: 'Rejected',   color: 'red'    },
};

const CLAIM_META = {
  'not-submitted': { label: 'Not Submitted', color: 'gray'   },
  submitted:       { label: 'Submitted',     color: 'blue'   },
  approved:        { label: 'Approved',      color: 'green'  },
  rejected:        { label: 'Rejected',      color: 'red'    },
  disbursed:       { label: 'Disbursed',     color: 'emerald' },
};

const SchemeBadge = ({ value }) => {
  const meta = SCHEME_META[value] || SCHEME_META.none;
  return <Badge color={meta.color}>{meta.label}</Badge>;
};

const VerificationBadge = ({ value }) => {
  const meta = VERIFY_META[value] || VERIFY_META['not-started'];
  return <Badge color={meta.color}>{meta.label}</Badge>;
};

const NHBStatusBadge = ({ value }) => {
  if (!value) return <span className="text-gray-300 text-sm">—</span>;
  const meta = NHB_PORTAL_META[value] || { label: value, color: 'gray' };
  return <Badge color={meta.color}>{meta.label}</Badge>;
};

const MetaBadge = ({ value, meta }) => {
  const m = meta[value] || Object.values(meta)[0];
  return <Badge color={m.color}>{m.label}</Badge>;
};

// ─── Prerequisite Alert ──────────────────────────────────────────────────────

const PrerequisiteAlert = ({ message }) => (
  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
    <p className="text-sm text-amber-800">{message}</p>
  </div>
);

// ─── Reusable Editable Panel ─────────────────────────────────────────────────

const EditablePanel = ({ title, subtitle, canEdit, saving, onSave, onCancel, children, viewContent }) => {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {canEdit && !editing && (
          <button className="text-sm text-primary-600 font-medium hover:underline" onClick={() => setEditing(true)}>Edit</button>
        )}
      </div>
      {!editing ? (
        viewContent
      ) : (
        <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-100">
          {children}
          <div className="flex justify-end gap-2 pt-1">
            <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={() => { setEditing(false); onCancel?.(); }}>Cancel</button>
            <button className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              disabled={saving} onClick={() => onSave(() => setEditing(false))}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const InfoRow = ({ label, value, mono }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-gray-400 font-medium">{label}</span>
    <span className={`text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'} ${mono ? 'font-mono' : ''}`}>
      {value || 'Not set'}
    </span>
  </div>
);

// ─── Helper: invalidate both list + detail ───────────────────────────────────

const invalidateBoth = (qc, applicationId) => {
  qc.invalidateQueries({ queryKey: ['subsidy', applicationId] });
  qc.invalidateQueries({ queryKey: ['subsidies'] });
};

// ─── GOC Credentials Panel ────────────────────────────────────────────────────

const GocCredentialsPanel = ({ applicationId, credentials, qc, can }) => {
  const [form, setForm] = useState({ email: '', mobile: '', password: '' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    setForm({ email: credentials?.email ?? '', mobile: credentials?.mobile ?? '', password: '' });
  }, [credentials]);

  const mutation = useMutation({
    mutationFn: (data) => updateGocCredentials(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('GOC credentials saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  return (
    <EditablePanel
      title="General Officer Certificate (GOC)"
      subtitle="Portal login credentials for the GOC application"
      canEdit={can('subsidies.update')}
      saving={mutation.isPending}
      onSave={(close) => mutation.mutate(form, { onSuccess: close })}
      viewContent={
        <div className="space-y-4">
          <InfoRow label="Email ID"  value={credentials?.email} />
          <InfoRow label="Mobile No." value={credentials?.mobile} />
          <InfoRow label="Password"   value={credentials?._passwordEncrypted ? '••••••••' : null} />
        </div>
      }
    >
      <div>
        <label className="label-base">Email ID</label>
        <input type="email" className="input-base" placeholder="email@example.com"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label className="label-base">Mobile No.</label>
        <input type="tel" className="input-base" placeholder="10-digit mobile number"
          value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
      </div>
      <div>
        <label className="label-base">
          Password {credentials?._passwordEncrypted && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
        </label>
        <div className="relative">
          <input type={showPass ? 'text' : 'password'} className="input-base pr-16"
            placeholder={credentials?._passwordEncrypted ? 'Enter new password to change' : 'Set password'}
            value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium"
            onClick={() => setShowPass(v => !v)}>{showPass ? 'Hide' : 'Show'}</button>
        </div>
      </div>
    </EditablePanel>
  );
};

// ─── NHB Details Panel ────────────────────────────────────────────────────────

const NhbDetailsPanel = ({ applicationId, nhbDetails, qc, can }) => {
  const [form, setForm] = useState({ nhbId: '', nhbPassword: '', nhbProjectCode: '', nhbPortalStatus: '' });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    setForm({
      nhbId:          nhbDetails?.nhbId ?? '',
      nhbPassword:    '',
      nhbProjectCode: nhbDetails?.nhbProjectCode ?? '',
      nhbPortalStatus: nhbDetails?.nhbPortalStatus ?? 'goc-new',
    });
  }, [nhbDetails]);

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyNhbDetails(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('NHB details saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  return (
    <EditablePanel
      title="NHB Portal Details"
      subtitle="NHB credentials and project information"
      canEdit={can('subsidies.update')}
      saving={mutation.isPending}
      onSave={(close) => mutation.mutate(form, { onSuccess: close })}
      viewContent={
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow label="NHB ID"           value={nhbDetails?.nhbId} mono />
          <InfoRow label="NHB Password"     value={nhbDetails?._nhbPasswordEncrypted ? '••••••••' : null} />
          <InfoRow label="NHB Project Code" value={nhbDetails?.nhbProjectCode} mono />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">NHB Portal Status</span>
            <NHBStatusBadge value={nhbDetails?.nhbPortalStatus} />
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label-base">NHB ID</label>
          <input className="input-base font-mono" placeholder="NHB portal user ID"
            value={form.nhbId} onChange={e => setForm(f => ({ ...f, nhbId: e.target.value }))} />
        </div>
        <div>
          <label className="label-base">
            NHB Password {nhbDetails?._nhbPasswordEncrypted && <span className="text-gray-400 font-normal">(leave blank to keep)</span>}
          </label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} className="input-base pr-16"
              placeholder={nhbDetails?._nhbPasswordEncrypted ? 'Enter to change' : 'Set password'}
              value={form.nhbPassword} onChange={e => setForm(f => ({ ...f, nhbPassword: e.target.value }))} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium"
              onClick={() => setShowPass(v => !v)}>{showPass ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div>
          <label className="label-base">NHB Project Code</label>
          <input className="input-base font-mono" placeholder="e.g. NHB-2026-1234"
            value={form.nhbProjectCode} onChange={e => setForm(f => ({ ...f, nhbProjectCode: e.target.value }))} />
        </div>
        <div>
          <label className="label-base">NHB Portal Status</label>
          <select className="input-base" value={form.nhbPortalStatus} onChange={e => setForm(f => ({ ...f, nhbPortalStatus: e.target.value }))}>
            {Object.entries(NHB_PORTAL_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
      </div>
    </EditablePanel>
  );
};

// ─── Verification Panel (renamed field) ───────────────────────────────────────

const VERIFY_OPTIONS = ['not-started', 'pending', 'completed'];

const VerificationToggle = ({ label, value, onChange }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-gray-700">{label}</p>
    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
      {VERIFY_OPTIONS.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            value === opt
              ? opt === 'completed' ? 'bg-green-600 text-white shadow-sm'
              : opt === 'pending'   ? 'bg-yellow-500 text-white shadow-sm'
              : 'bg-gray-400 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}>
          {opt === 'not-started' ? 'Not Started' : opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  </div>
);

const VerificationPanel = ({ applicationId, app, qc, can }) => {
  const [bankStatus, setBankStatus] = useState(app.gocBankVerificationStatus || 'not-started');
  const [bankDate, setBankDate]     = useState(app.gocBankVerificationDate ? new Date(app.gocBankVerificationDate).toISOString().slice(0, 10) : '');
  const [geoStatus, setGeoStatus]   = useState(app.geoTaggingStatus || 'not-started');
  const [geoDate, setGeoDate]       = useState(app.geoTaggingDate    ? new Date(app.geoTaggingDate).toISOString().slice(0, 10)    : '');

  useEffect(() => {
    setBankStatus(app.gocBankVerificationStatus || 'not-started');
    setBankDate(app.gocBankVerificationDate ? new Date(app.gocBankVerificationDate).toISOString().slice(0, 10) : '');
    setGeoStatus(app.geoTaggingStatus || 'not-started');
    setGeoDate(app.geoTaggingDate ? new Date(app.geoTaggingDate).toISOString().slice(0, 10) : '');
  }, [app]);

  const handleBankStatusChange = (val) => {
    setBankStatus(val);
    if (val === 'completed' && !bankDate) setBankDate(new Date().toISOString().slice(0, 10));
  };
  const handleGeoStatusChange = (val) => {
    setGeoStatus(val);
    if (val === 'completed' && !geoDate) setGeoDate(new Date().toISOString().slice(0, 10));
  };

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyVerification(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Verification updated'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('subsidies.update');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* GOC Bank Verification */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-base">🏦</div>
            <p className="font-medium text-gray-800">GOC Bank Verification</p>
          </div>
          {canEdit ? (
            <VerificationToggle label="Status" value={bankStatus} onChange={handleBankStatusChange} />
          ) : (
            <VerificationBadge value={bankStatus} />
          )}
          <div>
            <label className="label-base">Verified Date</label>
            <input type="date" className="input-base" value={bankDate}
              disabled={!canEdit} onChange={e => setBankDate(e.target.value)} />
          </div>
        </div>

        {/* Geo Tagging */}
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-50 flex items-center justify-center text-base">📍</div>
            <p className="font-medium text-gray-800">Geo-Tagging</p>
          </div>
          {canEdit ? (
            <VerificationToggle label="Status" value={geoStatus} onChange={handleGeoStatusChange} />
          ) : (
            <VerificationBadge value={geoStatus} />
          )}
          <div>
            <label className="label-base">Tagged Date</label>
            <input type="date" className="input-base" value={geoDate}
              disabled={!canEdit} onChange={e => setGeoDate(e.target.value)} />
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button loading={mutation.isPending} onClick={() => mutation.mutate({
            gocBankVerificationStatus: bankStatus,
            gocBankVerificationDate:   bankDate || undefined,
            geoTaggingStatus:       geoStatus,
            geoTaggingDate:         geoDate  || undefined,
          })}>Save Verification</Button>
        </div>
      )}
    </div>
  );
};

// ─── Loan Preparation Panel (NEW) ────────────────────────────────────────────

const LoanPreparationPanel = ({ applicationId, loanPreparation, qc, can }) => {
  const [form, setForm] = useState({
    preparationStartDate: '', preparationCompletedDate: '',
    loanAmountCalculated: '', preparationStatus: 'not-started',
  });

  useEffect(() => {
    setForm({
      preparationStartDate:     loanPreparation?.preparationStartDate ? new Date(loanPreparation.preparationStartDate).toISOString().slice(0, 10) : '',
      preparationCompletedDate: loanPreparation?.preparationCompletedDate ? new Date(loanPreparation.preparationCompletedDate).toISOString().slice(0, 10) : '',
      loanAmountCalculated:     loanPreparation?.loanAmountCalculated ?? '',
      preparationStatus:        loanPreparation?.preparationStatus ?? 'not-started',
    });
  }, [loanPreparation]);

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyLoanPrep(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Loan preparation saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  return (
    <EditablePanel
      title="Loan Preparation"
      subtitle="Prepare loan application details before bank submission"
      canEdit={can('subsidies.update')}
      saving={mutation.isPending}
      onSave={(close) => {
        const payload = {
          ...form,
          preparationStartDate:     form.preparationStartDate || undefined,
          preparationCompletedDate: form.preparationCompletedDate || undefined,
          loanAmountCalculated:     form.loanAmountCalculated || undefined,
        };
        mutation.mutate(payload, { onSuccess: close });
      }}
      viewContent={
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400 font-medium">Status</span>
            <MetaBadge value={loanPreparation?.preparationStatus} meta={LOAN_PREP_META} />
          </div>
          <InfoRow label="Loan Amount" value={loanPreparation?.loanAmountCalculated ? `₹${Number(loanPreparation.loanAmountCalculated).toLocaleString('en-IN')}` : null} />
          <InfoRow label="Start Date" value={formatDate(loanPreparation?.preparationStartDate)} />
          <InfoRow label="Completed Date" value={formatDate(loanPreparation?.preparationCompletedDate)} />
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-base">Status</label>
          <select className="input-base" value={form.preparationStatus} onChange={e => setForm(f => ({ ...f, preparationStatus: e.target.value }))}>
            {Object.entries(LOAN_PREP_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Loan Amount (₹)</label>
          <input type="number" className="input-base" placeholder="Calculated loan amount"
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
    </EditablePanel>
  );
};

// ─── Bank Loan Panel (Submission + Sanction) (NEW) ───────────────────────────

const BankLoanPanel = ({ applicationId, bankSubmission, bankLoanSanction, qc, can }) => {
  // ── Submission form
  const [subForm, setSubForm] = useState({
    submissionDate: '', bankFileReferenceNumber: '',
    bankOfficerName: '', bankOfficerContact: '', submissionStatus: 'not-submitted',
  });

  useEffect(() => {
    setSubForm({
      submissionDate:          bankSubmission?.submissionDate ? new Date(bankSubmission.submissionDate).toISOString().slice(0, 10) : '',
      bankFileReferenceNumber: bankSubmission?.bankFileReferenceNumber ?? '',
      bankOfficerName:         bankSubmission?.bankOfficerName ?? '',
      bankOfficerContact:      bankSubmission?.bankOfficerContact ?? '',
      submissionStatus:        bankSubmission?.submissionStatus ?? 'not-submitted',
    });
  }, [bankSubmission]);

  const subMutation = useMutation({
    mutationFn: (data) => updateSubsidyBankSubmission(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Bank submission saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  // ── Sanction form
  const [sanForm, setSanForm] = useState({
    sanctionDate: '', sanctionedAmount: '', sanctionLetterNumber: '',
    sanctionConditions: '', sanctionStatus: 'pending', rejectionReason: '',
  });

  useEffect(() => {
    setSanForm({
      sanctionDate:         bankLoanSanction?.sanctionDate ? new Date(bankLoanSanction.sanctionDate).toISOString().slice(0, 10) : '',
      sanctionedAmount:     bankLoanSanction?.sanctionedAmount ?? '',
      sanctionLetterNumber: bankLoanSanction?.sanctionLetterNumber ?? '',
      sanctionConditions:   bankLoanSanction?.sanctionConditions ?? '',
      sanctionStatus:       bankLoanSanction?.sanctionStatus ?? 'pending',
      rejectionReason:      bankLoanSanction?.rejectionReason ?? '',
    });
  }, [bankLoanSanction]);

  const sanMutation = useMutation({
    mutationFn: (data) => updateSubsidyBankSanction(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Sanction details saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('subsidies.update');

  return (
    <div className="space-y-8">
      {/* ── Bank Submission ─────────────────────────────────── */}
      <EditablePanel
        title="Bank Submission"
        subtitle="File submission details to bank"
        canEdit={canEdit}
        saving={subMutation.isPending}
        onSave={(close) => {
          const payload = { ...subForm, submissionDate: subForm.submissionDate || undefined };
          subMutation.mutate(payload, { onSuccess: close });
        }}
        viewContent={
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Submission Status</span>
              <MetaBadge value={bankSubmission?.submissionStatus} meta={BANK_SUB_META} />
            </div>
            <InfoRow label="Submission Date" value={formatDate(bankSubmission?.submissionDate)} />
            <InfoRow label="Bank File Ref. No." value={bankSubmission?.bankFileReferenceNumber} mono />
            <InfoRow label="Officer Name" value={bankSubmission?.bankOfficerName} />
            <InfoRow label="Officer Contact" value={bankSubmission?.bankOfficerContact} />
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Status</label>
            <select className="input-base" value={subForm.submissionStatus} onChange={e => setSubForm(f => ({ ...f, submissionStatus: e.target.value }))}>
              {Object.entries(BANK_SUB_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Submission Date</label>
            <input type="date" className="input-base"
              value={subForm.submissionDate} onChange={e => setSubForm(f => ({ ...f, submissionDate: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Bank File Reference No.</label>
            <input className="input-base font-mono" placeholder="Reference number…"
              value={subForm.bankFileReferenceNumber} onChange={e => setSubForm(f => ({ ...f, bankFileReferenceNumber: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Bank Officer Name</label>
            <input className="input-base"
              value={subForm.bankOfficerName} onChange={e => setSubForm(f => ({ ...f, bankOfficerName: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Bank Officer Contact</label>
            <input className="input-base"
              value={subForm.bankOfficerContact} onChange={e => setSubForm(f => ({ ...f, bankOfficerContact: e.target.value }))} />
          </div>
        </div>
      </EditablePanel>

      {/* ── Bank Loan Sanction ─────────────────────────────── */}
      <EditablePanel
        title="Bank Loan Sanction"
        subtitle="Loan sanction / rejection status from the bank"
        canEdit={canEdit}
        saving={sanMutation.isPending}
        onSave={(close) => {
          const payload = {
            ...sanForm,
            sanctionDate:     sanForm.sanctionDate || undefined,
            sanctionedAmount: sanForm.sanctionedAmount || undefined,
          };
          sanMutation.mutate(payload, { onSuccess: close });
        }}
        viewContent={
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Sanction Status</span>
              <MetaBadge value={bankLoanSanction?.sanctionStatus} meta={SANCTION_META} />
            </div>
            <InfoRow label="Sanction Date" value={formatDate(bankLoanSanction?.sanctionDate)} />
            <InfoRow label="Sanctioned Amount" value={bankLoanSanction?.sanctionedAmount ? `₹${Number(bankLoanSanction.sanctionedAmount).toLocaleString('en-IN')}` : null} />
            <InfoRow label="Sanction Letter No." value={bankLoanSanction?.sanctionLetterNumber} mono />
            {bankLoanSanction?.sanctionConditions && <InfoRow label="Conditions" value={bankLoanSanction.sanctionConditions} />}
            {bankLoanSanction?.sanctionStatus === 'rejected' && (
              <InfoRow label="Rejection Reason" value={bankLoanSanction.rejectionReason} />
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Sanction Status</label>
            <select className="input-base" value={sanForm.sanctionStatus} onChange={e => setSanForm(f => ({ ...f, sanctionStatus: e.target.value }))}>
              {Object.entries(SANCTION_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Sanction Date</label>
            <input type="date" className="input-base"
              value={sanForm.sanctionDate} onChange={e => setSanForm(f => ({ ...f, sanctionDate: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Sanctioned Amount (₹)</label>
            <input type="number" className="input-base"
              value={sanForm.sanctionedAmount} onChange={e => setSanForm(f => ({ ...f, sanctionedAmount: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Sanction Letter No.</label>
            <input className="input-base font-mono"
              value={sanForm.sanctionLetterNumber} onChange={e => setSanForm(f => ({ ...f, sanctionLetterNumber: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label-base">Conditions</label>
            <textarea className="input-base resize-none" rows={2}
              value={sanForm.sanctionConditions} onChange={e => setSanForm(f => ({ ...f, sanctionConditions: e.target.value }))} />
          </div>
          {sanForm.sanctionStatus === 'rejected' && (
            <div className="col-span-2">
              <label className="label-base">Rejection Reason <span className="text-danger-500">*</span></label>
              <textarea className="input-base resize-none" rows={2} placeholder="Why was the loan rejected?"
                value={sanForm.rejectionReason} onChange={e => setSanForm(f => ({ ...f, rejectionReason: e.target.value }))} />
            </div>
          )}
        </div>
      </EditablePanel>
    </div>
  );
};

// ─── GOC Details Panel (with prerequisite guard) ──────────────────────────────

const GocDetailsPanel = ({ applicationId, gocDetails, bankLoanSanction, qc, can }) => {
  const [form, setForm] = useState({ gocApplicationDate: '', gocStatus: 'not-started' });

  const canEditGoc = useMemo(() => {
    return bankLoanSanction?.sanctionStatus === 'sanctioned';
  }, [bankLoanSanction]);

  useEffect(() => {
    setForm({
      gocApplicationDate: gocDetails?.gocApplicationDate ? new Date(gocDetails.gocApplicationDate).toISOString().slice(0, 10) : '',
      gocStatus: gocDetails?.gocStatus ?? 'not-started',
    });
  }, [gocDetails]);

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyGocDetails(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('GOC details saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  return (
    <div className="space-y-4">
      {!canEditGoc && (
        <PrerequisiteAlert message="GOC application can only be submitted after bank loan is sanctioned." />
      )}
      <EditablePanel
        title="GOC Application"
        subtitle="Government Order Certificate application details"
        canEdit={can('subsidies.update') && canEditGoc}
        saving={mutation.isPending}
        onSave={(close) => {
          const payload = { ...form, gocApplicationDate: form.gocApplicationDate || undefined };
          mutation.mutate(payload, { onSuccess: close });
        }}
        viewContent={
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="GOC Application Date" value={formatDate(gocDetails?.gocApplicationDate)} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">GOC Status</span>
              <Badge color={(GOC_STATUS_META[gocDetails?.gocStatus] || GOC_STATUS_META['not-started']).color}>
                {(GOC_STATUS_META[gocDetails?.gocStatus] || GOC_STATUS_META['not-started']).label}
              </Badge>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">GOC Application Date</label>
            <input type="date" className="input-base"
              value={form.gocApplicationDate} onChange={e => setForm(f => ({ ...f, gocApplicationDate: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">GOC Status</label>
            <select className="input-base" value={form.gocStatus} onChange={e => setForm(f => ({ ...f, gocStatus: e.target.value }))}>
              {Object.entries(GOC_STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </EditablePanel>
    </div>
  );
};

// ─── Subsidy Claim Panel (NEW, with prerequisite guard) ──────────────────────

const SubsidyClaimPanel = ({ applicationId, subsidyClaim, gocDetails, qc, can }) => {
  const [form, setForm] = useState({
    claimSubmissionDate: '', claimReferenceNumber: '',
    approvedSubsidyAmount: '', claimApprovalDate: '',
    disbursementDate: '', claimStatus: 'not-submitted',
    rejectionReason: '', rejectionDate: '',
  });

  const canSubmitClaim = useMemo(() => {
    return gocDetails?.gocStatus === 'approved';
  }, [gocDetails]);

  useEffect(() => {
    setForm({
      claimSubmissionDate:   subsidyClaim?.claimSubmissionDate ? new Date(subsidyClaim.claimSubmissionDate).toISOString().slice(0, 10) : '',
      claimReferenceNumber:  subsidyClaim?.claimReferenceNumber ?? '',
      approvedSubsidyAmount: subsidyClaim?.approvedSubsidyAmount ?? '',
      claimApprovalDate:     subsidyClaim?.claimApprovalDate ? new Date(subsidyClaim.claimApprovalDate).toISOString().slice(0, 10) : '',
      disbursementDate:      subsidyClaim?.disbursementDate ? new Date(subsidyClaim.disbursementDate).toISOString().slice(0, 10) : '',
      claimStatus:           subsidyClaim?.claimStatus ?? 'not-submitted',
      rejectionReason:       subsidyClaim?.rejectionReason ?? '',
      rejectionDate:         subsidyClaim?.rejectionDate ? new Date(subsidyClaim.rejectionDate).toISOString().slice(0, 10) : '',
    });
  }, [subsidyClaim]);

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyClaim(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Subsidy claim saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  return (
    <div className="space-y-4">
      {!canSubmitClaim && (
        <PrerequisiteAlert message="Subsidy claim can only be submitted after GOC is approved." />
      )}
      <EditablePanel
        title="Subsidy Claim"
        subtitle="Claim submission and disbursement tracking"
        canEdit={can('subsidies.update') && canSubmitClaim}
        saving={mutation.isPending}
        onSave={(close) => {
          const payload = {
            ...form,
            claimSubmissionDate:   form.claimSubmissionDate || undefined,
            claimApprovalDate:     form.claimApprovalDate || undefined,
            disbursementDate:      form.disbursementDate || undefined,
            approvedSubsidyAmount: form.approvedSubsidyAmount || undefined,
            rejectionDate:         form.rejectionDate || undefined,
          };
          mutation.mutate(payload, { onSuccess: close });
        }}
        viewContent={
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400 font-medium">Claim Status</span>
              <MetaBadge value={subsidyClaim?.claimStatus} meta={CLAIM_META} />
            </div>
            <InfoRow label="Reference No." value={subsidyClaim?.claimReferenceNumber} mono />
            <InfoRow label="Submission Date" value={formatDate(subsidyClaim?.claimSubmissionDate)} />
            <InfoRow label="Approved Amount" value={subsidyClaim?.approvedSubsidyAmount ? `₹${Number(subsidyClaim.approvedSubsidyAmount).toLocaleString('en-IN')}` : null} />
            <InfoRow label="Approval Date" value={formatDate(subsidyClaim?.claimApprovalDate)} />
            <InfoRow label="Disbursement Date" value={formatDate(subsidyClaim?.disbursementDate)} />
            {subsidyClaim?.claimStatus === 'rejected' && (
              <>
                <InfoRow label="Rejection Reason" value={subsidyClaim.rejectionReason} />
                <InfoRow label="Rejection Date" value={formatDate(subsidyClaim.rejectionDate)} />
              </>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Claim Status</label>
            <select className="input-base" value={form.claimStatus} onChange={e => setForm(f => ({ ...f, claimStatus: e.target.value }))}>
              {Object.entries(CLAIM_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Reference Number</label>
            <input className="input-base font-mono" placeholder="Claim ref. no."
              value={form.claimReferenceNumber} onChange={e => setForm(f => ({ ...f, claimReferenceNumber: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Submission Date</label>
            <input type="date" className="input-base"
              value={form.claimSubmissionDate} onChange={e => setForm(f => ({ ...f, claimSubmissionDate: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Approved Amount (₹)</label>
            <input type="number" className="input-base"
              value={form.approvedSubsidyAmount} onChange={e => setForm(f => ({ ...f, approvedSubsidyAmount: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Approval Date</label>
            <input type="date" className="input-base"
              value={form.claimApprovalDate} onChange={e => setForm(f => ({ ...f, claimApprovalDate: e.target.value }))} />
          </div>
          <div>
            <label className="label-base">Disbursement Date</label>
            <input type="date" className="input-base"
              value={form.disbursementDate} onChange={e => setForm(f => ({ ...f, disbursementDate: e.target.value }))} />
          </div>
          {(form.claimStatus === 'rejected') && (
            <>
              <div>
                <label className="label-base">Rejection Date</label>
                <input type="date" className="input-base"
                  value={form.rejectionDate} onChange={e => setForm(f => ({ ...f, rejectionDate: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label-base">Rejection Reason <span className="text-danger-500">*</span></label>
                <textarea className="input-base resize-none" rows={2} placeholder="Why was the claim rejected?"
                  value={form.rejectionReason} onChange={e => setForm(f => ({ ...f, rejectionReason: e.target.value }))} />
              </div>
            </>
          )}
        </div>
      </EditablePanel>
    </div>
  );
};

// ─── Payment Panel (with prerequisite guard) ──────────────────────────────────

const PaymentPanel = ({ applicationId, paymentDetails, subsidyClaim, qc, can }) => {
  const [form, setForm] = useState({
    paymentReceived: false, paymentAmount: '', paymentDate: '',
    paymentMode: '', transactionReference: '',
  });

  const canMarkReceived = useMemo(() => {
    return subsidyClaim?.claimStatus === 'disbursed';
  }, [subsidyClaim]);

  useEffect(() => {
    setForm({
      paymentReceived:      paymentDetails?.paymentReceived ?? false,
      paymentAmount:        paymentDetails?.paymentAmount ?? '',
      paymentDate:          paymentDetails?.paymentDate ? new Date(paymentDetails.paymentDate).toISOString().slice(0, 10) : '',
      paymentMode:          paymentDetails?.paymentMode ?? '',
      transactionReference: paymentDetails?.transactionReference ?? '',
    });
  }, [paymentDetails]);

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyPayment(applicationId, data),
    onSuccess: () => { invalidateBoth(qc, applicationId); toast.success('Payment details saved'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  });

  const canEdit = can('subsidies.update');

  return (
    <div className="space-y-5 max-w-lg">
      {!canMarkReceived && (
        <PrerequisiteAlert message="Payment can only be marked as received after subsidy is disbursed." />
      )}

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <input type="checkbox" id="paymentReceived" className="h-4 w-4 rounded text-primary-600"
          checked={form.paymentReceived} disabled={!canEdit || !canMarkReceived}
          onChange={e => setForm(f => ({ ...f, paymentReceived: e.target.checked }))} />
        <label htmlFor="paymentReceived" className="text-sm font-medium text-gray-800 cursor-pointer select-none">
          Payment Received
        </label>
        {paymentDetails?.paymentReceived && (
          <span className="ml-auto text-green-600 font-semibold text-sm">
            ✅ {paymentDetails.paymentAmount ? `₹${Number(paymentDetails.paymentAmount).toLocaleString('en-IN')}` : 'Received'}
          </span>
        )}
      </div>

      {form.paymentReceived && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Amount (₹){canEdit && <span className="text-danger-500 ml-0.5">*</span>}</label>
              <input type="number" className="input-base" placeholder="0" disabled={!canEdit}
                value={form.paymentAmount} onChange={e => setForm(f => ({ ...f, paymentAmount: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Payment Date{canEdit && <span className="text-danger-500 ml-0.5">*</span>}</label>
              <input type="date" className="input-base" disabled={!canEdit}
                value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} />
            </div>
            <div>
              <label className="label-base">Payment Mode</label>
              <select className="input-base" disabled={!canEdit}
                value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
                <option value="">Select mode…</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div>
              <label className="label-base">Transaction Reference</label>
              <input className="input-base font-mono" placeholder="TXN / Cheque No." disabled={!canEdit}
                value={form.transactionReference} onChange={e => setForm(f => ({ ...f, transactionReference: e.target.value }))} />
            </div>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-end">
          <Button loading={mutation.isPending} onClick={() => {
            if (form.paymentReceived && (!form.paymentAmount || !form.paymentDate)) {
              toast.error('Amount and date are required when payment is received');
              return;
            }
            mutation.mutate(form);
          }}>Save Payment</Button>
        </div>
      )}
    </div>
  );
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const SCHEME_TABS = [
  { key: 'all', label: 'All' },
  { key: 'nhb', label: 'NHB' },
  { key: 'general', label: 'General' },
  { key: 'aif', label: 'AIF' },
];

const FilterBar = ({ filters, onChange, onClear }) => {
  const [open, setOpen] = useState(false);
  const hasFilters = Object.values(filters).some(v => v);

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
          hasFilters ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
        <Filter className="h-4 w-4" />
        Filters
        {hasFilters && <span className="ml-1 h-5 w-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">
          {Object.values(filters).filter(Boolean).length}
        </span>}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">Advanced Filters</p>
            <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          {[
            { key: 'nhbPortalStatus', label: 'NHB Portal Status', options: Object.entries(NHB_PORTAL_META).map(([v, m]) => ({ value: v, label: m.label })) },
            { key: 'gocBankVerificationStatus', label: 'GOC Bank Verification', options: Object.entries(VERIFY_META).map(([v, m]) => ({ value: v, label: m.label })) },
            { key: 'geoTaggingStatus', label: 'Geo-Tagging', options: Object.entries(VERIFY_META).map(([v, m]) => ({ value: v, label: m.label })) },
            { key: 'sanctionStatus', label: 'Bank Sanction', options: Object.entries(SANCTION_META).map(([v, m]) => ({ value: v, label: m.label })) },
            { key: 'claimStatus', label: 'Subsidy Claim', options: Object.entries(CLAIM_META).map(([v, m]) => ({ value: v, label: m.label })) },
            { key: 'paymentReceived', label: 'Payment', options: [{ value: 'true', label: 'Received' }, { value: 'false', label: 'Not Received' }] },
          ].map(({ key, label, options }) => (
            <div key={key}>
              <label className="label-base">{label}</label>
              <select className="input-base" value={filters[key] || ''} onChange={e => onChange(key, e.target.value)}>
                <option value="">All</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          {hasFilters && (
            <button onClick={() => { onClear(); setOpen(false); }}
              className="w-full text-sm text-danger-600 hover:text-danger-700 font-medium pt-1">
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Documents Tab Component ─────────────────────────────────────────────────

const DOC_STATUS_OPTIONS = ['pending', 'received'];

const DocumentRow = ({ doc, applicationId, qc, canEdit }) => {
  const [expanded, setExpanded]   = useState(false);
  const [status, setStatus]       = useState(doc.status);
  const [remarks, setRemarks]     = useState(doc.remarks || '');
  const [receivedDate, setReceivedDate] = useState(
    doc.receivedDate ? new Date(doc.receivedDate).toISOString().slice(0, 10) : ''
  );

  const mutation = useMutation({
    mutationFn: (data) => updateSubsidyDocumentChecklist(applicationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subsidy', applicationId] });
      toast.success('Document updated');
      setExpanded(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update'),
  });

  const handleStatusToggle = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === 'received' && !receivedDate) {
      setReceivedDate(new Date().toISOString().slice(0, 10));
    }
    if (!expanded) setExpanded(true);
  };

  const handleSave = () => {
    mutation.mutate({
      documentId:   doc._id,
      status,
      remarks:      remarks || undefined,
      receivedDate: receivedDate || undefined,
    });
  };

  const isReceived = doc.status === 'received';

  return (
    <div className={`border rounded-xl transition-all ${isReceived ? 'border-green-200 bg-green-50/40' : 'border-gray-100 bg-white'}`}>
      <div className="p-4 flex items-center gap-3">
        {/* Status toggle pill */}
        {canEdit ? (
          <div className="flex shrink-0 gap-1 p-0.5 bg-gray-100 rounded-lg">
            {DOC_STATUS_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => handleStatusToggle(opt)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  status === opt
                    ? opt === 'received'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-gray-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt === 'received' ? '✅ Received' : '⏳ Pending'}
              </button>
            ))}
          </div>
        ) : (
          <Badge color={isReceived ? 'green' : 'gray'}>{doc.status}</Badge>
        )}

        {/* Document name */}
        <p className="flex-1 text-sm font-medium text-gray-800">{doc.documentName}</p>

        {/* Received date label */}
        {doc.receivedDate && (
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(doc.receivedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}

        {/* Expand/collapse for remarks & date */}
        {canEdit && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 text-xs text-primary-600 hover:underline font-medium"
          >
            {expanded ? 'Close' : 'Edit'}
          </button>
        )}
      </div>

      {/* Expanded form */}
      {expanded && canEdit && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Received Date</label>
              <input type="date" className="input-base"
                value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
            </div>
            <div>
              <label className="label-base">Remarks</label>
              <input className="input-base" placeholder="Optional note…"
                value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={() => { setExpanded(false); setStatus(doc.status); }}
            >Cancel</button>
            <button
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60"
              disabled={mutation.isPending} onClick={handleSave}
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentsTab = ({ applicationId, docs, qc, can }) => {
  const canEdit = can('subsidies.update');
  const received = docs.filter(d => d.status === 'received').length;

  return (
    <div className="space-y-3">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{received}</span> of{' '}
          <span className="font-semibold text-gray-800">{docs.length}</span> documents received
        </p>
        <span className="text-xs text-gray-400">{docs.length ? Math.round((received / docs.length) * 100) : 0}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
        <div
          className="bg-green-500 h-1.5 rounded-full transition-all"
          style={{ width: `${docs.length ? (received / docs.length) * 100 : 0}%` }}
        />
      </div>

      {docs.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">No documents configured.</p>
      )}

      {docs.map(doc => (
        <DocumentRow
          key={doc._id}
          doc={doc}
          applicationId={applicationId}
          qc={qc}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────


const Subsidies = () => {
  usePageTitle('Subsidies');
  const { can } = useAuth();
  const qc = useQueryClient();
  const configStore = useConfigStore();

  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [limit, setLimit]             = useState(10);
  const [schemeFilter, setSchemeFilter] = useState('all');
  const [advFilters, setAdvFilters]   = useState({});
  const [formOpen, setFormOpen]       = useState(false);
  const [detailApp, setDetailApp]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeTab, setActiveTab]     = useState('info');
  const [statusModal, setStatusModal] = useState(false);

  const debounced = useDebounce(search);

  useEffect(() => { configStore.fetchConfigurations(); }, []);

  const queryParams = {
    search: debounced, page, limit,
    ...(schemeFilter !== 'all' ? { schemeType: schemeFilter } : {}),
    ...Object.fromEntries(Object.entries(advFilters).filter(([, v]) => v)),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['subsidies', queryParams],
    queryFn: () => getSubsidies(queryParams),
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
    onSuccess: () => {
      invalidateBoth(qc, detailApp._id);
      toast.success('Status updated');
      setStatusModal(false);
    },
  });

  const { register: regCreate, handleSubmit: hsCreate, reset: resetCreate, watch: watchCreate, formState: { errors: createErrors } } = useForm();
  const { register: regStatus, handleSubmit: hsStatus } = useForm();

  const createMutation = useMutation({
    mutationFn: (data) => createSubsidy(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subsidies'] });
      toast.success('Subsidy application created');
      resetCreate();
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

  const watchSchemeType = watchCreate('schemeType');

  const handleAdvFilter = (key, value) => {
    setAdvFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  // ── Current status options (enum from model) ──────────────────────────────
  const SUBSIDY_STATUS_OPTIONS = [
    'Documentation In Progress', 'Documentation Completed',
    'Loan Preparation', 'File Submitted to Bank', 'Under Bank Review',
    'Bank Loan Sanctioned', 'Bank Loan Rejected',
    'GOC Application Submitted', 'GOC Processing', 'GOC Approved', 'GOC Rejected',
    'Subsidy Claim Submitted', 'Subsidy Claim Approved', 'Subsidy Claim Rejected',
    'Subsidy Disbursed', 'Payment Received', 'Completed', 'Rejected',
  ];

  // ── Detail View ─────────────────────────────────────────────────────────────
  if (detailApp && app) {
    const days = daysAgo(app.applicationDate);
    const isNhb = app.schemeType?.toLowerCase() === 'nhb';

    // ── Rejection detection ───────────────────────────────────────────────
    const sanctionRejected = app.bankLoanSanction?.sanctionStatus === 'rejected';
    const gocRejected      = app.gocDetails?.gocStatus === 'rejected';
    const claimRejected    = app.subsidyClaim?.claimStatus === 'rejected';
    const isRejected       = sanctionRejected || gocRejected || claimRejected;

    const rejectionMessage = sanctionRejected
      ? `Case closed — Bank loan was rejected${app.bankLoanSanction?.rejectionReason ? `: ${app.bankLoanSanction.rejectionReason}` : ''}`
      : gocRejected
        ? 'Case closed — GOC application was rejected'
        : claimRejected
          ? `Case closed — Subsidy claim was rejected${app.subsidyClaim?.rejectionReason ? `: ${app.subsidyClaim.rejectionReason}` : ''}`
          : null;

    // Days in current stage
    const daysInStage = app.lastStatusChangeDate
      ? Math.floor((Date.now() - new Date(app.lastStatusChangeDate).getTime()) / (1000 * 60 * 60 * 24))
      : days;

    // Tabs disabled after rejection point
    const disabledTabs = new Set();
    if (sanctionRejected) {
      ['goc-details', 'goc-creds', 'verification', 'claim', 'payment'].forEach(t => disabledTabs.add(t));
    } else if (gocRejected) {
      ['claim', 'payment'].forEach(t => disabledTabs.add(t));
    } else if (claimRejected) {
      disabledTabs.add('payment');
    }

    const tabs = [
      { id: 'info',         label: 'Info' },
      { id: 'loan-prep',    label: 'Loan Prep' },
      { id: 'bank-loan',    label: 'Bank Loan' },
      ...(isNhb ? [{ id: 'nhb', label: 'NHB Details' }] : []),
      { id: 'goc-details',  label: 'GOC' },
      { id: 'goc-creds',    label: 'GOC Portal' },
      { id: 'verification', label: 'Verification' },
      { id: 'claim',        label: 'Subsidy Claim' },
      { id: 'payment',      label: 'Payment' },
      { id: 'documents',    label: 'Documents' },
      { id: 'queries',      label: `Queries (${app.queries?.length ?? 0})` },
      { id: 'timeline',     label: 'Timeline' },
      { id: 'status',       label: 'Status' },
    ];

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setDetailApp(null); setActiveTab('info'); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{app.applicationId}</h1>
            <p className="text-sm text-gray-500">
              {app.clientId?.name ?? 'N/A'} · <SchemeBadge value={app.schemeType} />
            </p>
          </div>
          <StatusBadge status={app.currentStatus} />
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          {[
            { label: 'Subsidy Amount',    value: app.subsidyAmountApplied ? `₹${Number(app.subsidyAmountApplied).toLocaleString('en-IN')}` : '—' },
            { label: 'Project Cost',      value: app.projectCost ? `₹${Number(app.projectCost).toLocaleString('en-IN')}` : '—' },
            { label: 'Days in Process',   value: `${days} days` },
            { label: 'Days in Stage',     value: <span className={daysInStage > 15 ? 'text-red-600' : daysInStage > 7 ? 'text-yellow-600' : 'text-green-600'}>{daysInStage}d</span> },
            { label: 'Bank Sanction',     value: <MetaBadge value={app.bankLoanSanction?.sanctionStatus} meta={SANCTION_META} /> },
            { label: 'Claim Status',      value: <MetaBadge value={app.subsidyClaim?.claimStatus} meta={CLAIM_META} /> },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <div className="text-sm font-semibold text-gray-800 mt-1 flex justify-center">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Rejection Banner */}
        {isRejected && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">🚫 {rejectionMessage}</p>
              <p className="text-xs text-red-600 mt-1">Downstream steps have been locked.</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => !disabledTabs.has(t.id) && setActiveTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  disabledTabs.has(t.id)
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : activeTab === t.id
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
                {disabledTabs.has(t.id) && <span className="ml-1 text-red-400">🔒</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* INFO */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Client & File</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <InfoRow label="Client Name"   value={app.clientId?.name} />
                  <InfoRow label="Mobile"         value={app.clientId?.mobile} />
                  <InfoRow label="Business"       value={app.clientId?.businessName} />
                  <InfoRow label="Vendor"         value={app.clientId?.vendorId?.vendorName} />
                  <InfoRow label="Bank"           value={app.clientId?.bankName} />
                  <InfoRow label="Branch"         value={app.clientId?.branchName} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Application Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <InfoRow label="Application ID"     value={app.applicationId} />
                  <InfoRow label="Scheme Name"         value={app.schemeName} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-400 font-medium">Scheme Type</span>
                    <SchemeBadge value={app.schemeType} />
                  </div>
                  <InfoRow label="File Receive Date"  value={formatDate(app.applicationDate)} />
                  <InfoRow label="Department"          value={app.departmentName} />
                  <InfoRow label="Subsidy Applied"     value={app.subsidyAmountApplied ? `₹${Number(app.subsidyAmountApplied).toLocaleString('en-IN')}` : '—'} />
                  <InfoRow label="Project Cost"        value={app.projectCost ? `₹${Number(app.projectCost).toLocaleString('en-IN')}` : '—'} />
                  <InfoRow label="Subsidy %"           value={app.subsidyPercentage ? `${app.subsidyPercentage}%` : '—'} />
                  <InfoRow label="Approved Amount"     value={app.approvedAmount ? `₹${Number(app.approvedAmount).toLocaleString('en-IN')}` : '—'} />
                  <InfoRow label="Release Date"        value={formatDate(app.releaseDate)} />
                </div>
              </div>
            </div>
          )}

          {/* LOAN PREPARATION (NEW) */}
          {activeTab === 'loan-prep' && (
            <LoanPreparationPanel
              applicationId={app._id ?? detailApp._id}
              loanPreparation={app.loanPreparation}
              qc={qc} can={can}
            />
          )}

          {/* BANK LOAN (NEW: submission + sanction) */}
          {activeTab === 'bank-loan' && (
            <BankLoanPanel
              applicationId={app._id ?? detailApp._id}
              bankSubmission={app.bankSubmission}
              bankLoanSanction={app.bankLoanSanction}
              qc={qc} can={can}
            />
          )}

          {/* NHB DETAILS (conditional) */}
          {activeTab === 'nhb' && isNhb && (
            <NhbDetailsPanel
              applicationId={app._id ?? detailApp._id}
              nhbDetails={app.nhbDetails}
              qc={qc} can={can}
            />
          )}

          {/* GOC DETAILS (with prerequisite) */}
          {activeTab === 'goc-details' && (
            <GocDetailsPanel
              applicationId={app._id ?? detailApp._id}
              gocDetails={app.gocDetails}
              bankLoanSanction={app.bankLoanSanction}
              qc={qc} can={can}
            />
          )}

          {/* GOC PORTAL CREDENTIALS */}
          {activeTab === 'goc-creds' && (
            <GocCredentialsPanel
              applicationId={app._id ?? detailApp._id}
              credentials={app.gocCredentials}
              qc={qc} can={can}
            />
          )}

          {/* VERIFICATION */}
          {activeTab === 'verification' && (
            <VerificationPanel
              applicationId={app._id ?? detailApp._id}
              app={app} qc={qc} can={can}
            />
          )}

          {/* SUBSIDY CLAIM (NEW, with prerequisite) */}
          {activeTab === 'claim' && (
            <SubsidyClaimPanel
              applicationId={app._id ?? detailApp._id}
              subsidyClaim={app.subsidyClaim}
              gocDetails={app.gocDetails}
              qc={qc} can={can}
            />
          )}

          {/* PAYMENT (with prerequisite) */}
          {activeTab === 'payment' && (
            <PaymentPanel
              applicationId={app._id ?? detailApp._id}
              paymentDetails={app.paymentDetails}
              subsidyClaim={app.subsidyClaim}
              qc={qc} can={can}
            />
          )}

          {/* DOCUMENTS */}
          {activeTab === 'documents' && (
            <DocumentsTab
              applicationId={app._id ?? detailApp._id}
              docs={app.documentChecklist ?? []}
              qc={qc}
              can={can}
            />
          )}

          {/* QUERIES */}
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

          {/* TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-3 relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
              {(app.timeline ?? []).map((entry, i) => (
                <div key={i} className="flex gap-4 relative">
                  <div className="relative z-10 shrink-0 h-10 w-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-base">
                    {{ 'status-change': '🔄', 'document-update': '📄', query: '❓', note: '📝', 'portal-update': '🌐', 'verification-update': '✅', 'payment-update': '💰', assignment: '👤', 'loan-update': '🏦', 'claim-update': '📋' }[entry.activityType] || '📌'}
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

          {/* STATUS */}
          {activeTab === 'status' && (
            <Card header="Change Status">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Current</p>
                    <StatusBadge status={app.currentStatus} size="lg" />
                  </div>
                  {can('subsidies.update') && (
                    <Button onClick={() => setStatusModal(true)}>Manual Override</Button>
                  )}
                </div>
                {app.lastStatusChangeDate && (
                  <p className="text-xs text-gray-400">
                    In this stage for <span className={`font-semibold ${daysInStage > 15 ? 'text-red-600' : daysInStage > 7 ? 'text-yellow-600' : 'text-green-600'}`}>{daysInStage} days</span>
                    {' · '}since {formatDate(app.lastStatusChangeDate)}
                  </p>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <p className="text-xs text-blue-500 font-medium mb-1">💡 Auto-Suggested Status (based on sub-document states)</p>
                  <p className="text-sm font-semibold text-blue-800">{app.currentStatus}</p>
                  <p className="text-xs text-blue-400 mt-1">Status auto-syncs when you update tabs. Manual override is available above.</p>
                </div>
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
                <option value="">Select…</option>
                {SUBSIDY_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
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

  // ── Table View ──────────────────────────────────────────────────────────────
  const isNhbActive = schemeFilter === 'nhb';

  const columns = [
    { key: 'applicationId', label: 'App ID', width: '130px' },
    { key: 'client',        label: 'Client',  render: (row) => row.clientId?.name ?? '—' },
    { key: 'appDate',       label: 'File Date', render: (row) => formatDate(row.applicationDate) },
    { key: 'vendor',        label: 'Vendor',  render: (row) => row.clientId?.vendorId?.vendorName ?? <span className="text-gray-300">Direct</span> },
    { key: 'scheme',        label: 'Scheme',  render: (row) => <SchemeBadge value={row.schemeType} /> },
    { key: 'status',        label: 'Status',  render: (row) => <StatusBadge status={row.currentStatus} /> },
    ...(isNhbActive ? [
      { key: 'nhbId',       label: 'NHB ID',  render: (row) => <span className="font-mono text-xs">{row.nhbDetails?.nhbId || '—'}</span> },
      { key: 'nhbStatus',   label: 'NHB Portal', render: (row) => <NHBStatusBadge value={row.nhbDetails?.nhbPortalStatus} /> },
    ] : []),
    { key: 'sanction',      label: 'Sanction',    render: (row) => <MetaBadge value={row.bankLoanSanction?.sanctionStatus} meta={SANCTION_META} /> },
    { key: 'claim',         label: 'Claim',       render: (row) => <MetaBadge value={row.subsidyClaim?.claimStatus} meta={CLAIM_META} /> },
    {
      key: 'payment',       label: 'Payment',
      render: (row) => row.paymentDetails?.paymentReceived
        ? <span className="text-green-600 font-medium text-xs">✅ {row.paymentDetails.paymentAmount ? `₹${Number(row.paymentDetails.paymentAmount).toLocaleString('en-IN')}` : 'Rcvd'}</span>
        : <span className="text-gray-300 text-sm">❌</span>,
    },
    { key: 'days', label: 'Days', render: (row) => `${daysAgo(row.applicationDate)}d` },
    {
      key: 'actions', label: '', sortable: false, tdClassName: 'text-right',
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => { setDetailApp(row); setActiveTab('info'); }}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
            <Eye className="h-4 w-4" />
          </button>
          {can('subsidies.delete') && (
            <button onClick={() => setDeleteTarget(row)}
              className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Subsidy Applications</h1>
        {can('subsidies.create') && <Button icon={Plus} onClick={() => setFormOpen(true)}>New Application</Button>}
      </div>

      {/* Scheme Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {SCHEME_TABS.map(tab => (
          <button key={tab.key} onClick={() => { setSchemeFilter(tab.key); setPage(1); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              schemeFilter === tab.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="card p-4 mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input-base pl-9" placeholder="Search by app ID, scheme, department…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <FilterBar
          filters={advFilters}
          onChange={handleAdvFilter}
          onClear={() => { setAdvFilters({}); setPage(1); }}
        />
      </div>

      {/* Table */}
      <Table
        columns={columns} data={data?.data ?? []} loading={isLoading}
        pagination={data?.pagination} onPageChange={setPage}
        onPageSizeChange={(s) => { setLimit(s); setPage(1); }}
        emptyTitle="No subsidy applications"
        emptyDescription="Create a new subsidy application to get started."
        emptyAction={can('subsidies.create') ? () => setFormOpen(true) : undefined}
        emptyActionLabel="New Application"
      />

      {/* Create Modal — MINIMAL */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Subsidy Application" size="lg">
        <form onSubmit={hsCreate(d => createMutation.mutate(d))} className="space-y-5">
          <div>
            <label className="label-base">Client<span className="text-danger-500 ml-0.5">*</span></label>
            <select className={`input-base ${createErrors.clientId ? 'input-error' : ''}`} {...regCreate('clientId', { required: 'Client is required' })}>
              <option value="">Select client…</option>
              {(clientsData ?? []).map(c => <option key={c._id} value={c._id}>{c.name} — {c.clientId}</option>)}
            </select>
            {createErrors.clientId && <p className="mt-1 text-xs text-danger-600">{createErrors.clientId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-base">Scheme Name<span className="text-danger-500 ml-0.5">*</span></label>
              <input className={`input-base ${createErrors.schemeName ? 'input-error' : ''}`}
                placeholder="e.g. PMAY-G, NABARD..."
                {...regCreate('schemeName', { required: 'Scheme name is required', minLength: { value: 3, message: 'Min 3 characters required' } })} />
              {createErrors.schemeName && <p className="mt-1 text-xs text-danger-600">{createErrors.schemeName.message}</p>}
            </div>
            <div>
              <label className="label-base">Scheme Type<span className="text-danger-500 ml-0.5">*</span></label>
              <select className="input-base" {...regCreate('schemeType')}>
                <option value="none">None</option>
                <option value="nhb">NHB</option>
                <option value="general">General</option>
                <option value="aif">AIF</option>
              </select>
            </div>
            <div>
              <label className="label-base">File Receive Date</label>
              <input type="date" className={`input-base ${createErrors.applicationDate ? 'input-error' : ''}`}
                defaultValue={new Date().toISOString().slice(0, 10)}
                {...regCreate('applicationDate', { validate: v => !v || !isNaN(Date.parse(v)) || 'Enter a valid date (YYYY-MM-DD)' })} />
              {createErrors.applicationDate && <p className="mt-1 text-xs text-danger-600">{createErrors.applicationDate.message}</p>}
            </div>
            <div>
              <label className="label-base">Subsidy Applied (₹)</label>
              <input type="number" step="any" className={`input-base ${createErrors.subsidyAmountApplied ? 'input-error' : ''}`}
                placeholder="0"
                {...regCreate('subsidyAmountApplied', { min: { value: 0, message: 'Amount must be positive' } })} />
              {createErrors.subsidyAmountApplied && <p className="mt-1 text-xs text-danger-600">{createErrors.subsidyAmountApplied.message}</p>}
            </div>
            <div>
              <label className="label-base">Priority</label>
              <select className="input-base" {...regCreate('priority')}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFormOpen(false)} type="button">Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create Application</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget._id)} loading={deleteMutation.isPending}
        title="Delete Application" message={`Delete "${deleteTarget?.applicationId}"?`}
      />
    </div>
  );
};

export default Subsidies;
