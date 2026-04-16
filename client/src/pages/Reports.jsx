import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download, FileText, BarChart3, Calendar, TrendingUp,
  Shield, Users, ChevronDown, ChevronRight, AlertCircle,
  CheckCircle, Clock, IndianRupee, Building2, Layers,
} from 'lucide-react';
import {
  getClientWiseReport, getVendorWiseReport, getStatusWiseReport,
  getDateRangeReport, getPerformanceReport, getAuditLogReport,
  getSubsidyAnalytics,
} from '../services/reportService';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { StatusBadge } from '../components/common/Badge';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { exportSingleSheet } from '../utils/exportExcel';

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const Stat = ({ label, value, sub, color = 'text-gray-800', icon: Icon, iconBg }) => (
  <div className="card p-4 flex items-center gap-3">
    {Icon && (
      <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${iconBg || 'bg-gray-100'}`}>
        <Icon className="h-5 w-5 text-current" />
      </div>
    )}
    <div className="min-w-0">
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-300 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const MiniBar = ({ label, count, total, color }) => {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-semibold text-gray-800">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// Expandable application list per status group
const AppList = ({ apps = [], type = 'subsidy' }) => {
  const [expanded, setExpanded] = useState(false);
  if (!apps.length) return <p className="text-xs text-gray-400 pl-1 pt-1">No applications.</p>;
  const shown = expanded ? apps : apps.slice(0, 5);
  return (
    <div className="mt-3 space-y-1.5">
      {shown.map(a => (
        <div key={a._id || a.applicationId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs">
          <span className="font-mono text-gray-500 shrink-0">{a.applicationId}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800 truncate">{a.clientId?.name || '—'}</p>
            <p className="text-gray-400 truncate">
              {a.clientId?.vendorId?.vendorName ? `via ${a.clientId.vendorId.vendorName}` : 'Direct'}
              {a.clientId?.bankName ? ` · ${a.clientId.bankName}` : ''}
            </p>
          </div>
          <span className="text-gray-300 shrink-0">{formatDate(a.applicationDate)}</span>
          {type === 'subsidy' && a.paymentDetails?.paymentReceived && (
            <span className="text-green-600 shrink-0">✅</span>
          )}
        </div>
      ))}
      {apps.length > 5 && (
        <button onClick={() => setExpanded(v => !v)}
          className="text-xs text-primary-600 hover:underline font-medium pl-1">
          {expanded ? 'Show less' : `+ ${apps.length - 5} more`}
        </button>
      )}
    </div>
  );
};

// Collapsible status group card
const StatusGroup = ({ status, count, avgDays, apps = [], total, type }) => {
  const [open, setOpen] = useState(false);
  const pct = total ? Math.round((count / total) * 100) : 0;

  const urgency = avgDays > 60 ? 'text-red-600' : avgDays > 30 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={status} />
            <span className="text-xs text-gray-400">{avgDays} avg days</span>
            {avgDays > 45 && <span className="text-xs text-red-500 font-medium">⚠ Aging</span>}
          </div>
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-2xl font-bold text-gray-800">{count}</p>
          <p className="text-xs text-gray-400">applications</p>
        </div>
        <div className="shrink-0">
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-1">
          <AppList apps={apps} type={type} />
        </div>
      )}
    </div>
  );
};

// ─── Status-wise Report (enhanced with who) ───────────────────────────────────
const StatusWiseReportView = () => {
  const [type, setType] = useState('bank-loan');
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'status', type],
    queryFn: () => getStatusWiseReport({ type }),
    select: (res) => res.data.data,
  });

  const total = (data ?? []).reduce((s, g) => s + g.count, 0);

  const exportExcel = () => {
    const rows = (data ?? []).flatMap(g =>
      (g.applications ?? []).map(a => ({
        status: g.status, applicationId: a.applicationId,
        client: a.clientId?.name, bank: a.clientId?.bankName,
        vendor: a.clientId?.vendorId?.vendorName,
        date: formatDate(a.applicationDate),
      }))
    );
    exportSingleSheet('Status-wise Report', [
      { header: 'Status',         accessor: r => r.status },
      { header: 'Application ID', accessor: r => r.applicationId },
      { header: 'Client',         accessor: r => r.client },
      { header: 'Bank',           accessor: r => r.bank },
      { header: 'Vendor',         accessor: r => r.vendor },
      { header: 'Date',           accessor: r => r.date },
    ], rows, `status-wise-${type}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {[['bank-loan', 'Bank Loan'], ['subsidy', 'Subsidy']].map(([t, l]) => (
            <button key={t} onClick={() => setType(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {l}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
      </div>

      {/* Summary strip */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total Applications" value={total} color="text-gray-800" />
          <Stat label="Status Groups" value={(data ?? []).length} color="text-primary-700" />
          <Stat
            label="Longest Aging (avg)"
            value={`${Math.max(...(data ?? []).map(g => g.avgDaysInProcess || 0))}d`}
            color="text-red-600"
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map(g => (
            <StatusGroup
              key={g.status} status={g.status} count={g.count}
              avgDays={g.avgDaysInProcess} apps={g.applications}
              total={total} type={type}
            />
          ))}
          {(data ?? []).length === 0 && <p className="text-center text-gray-400 py-8">No data.</p>}
        </div>
      )}
    </div>
  );
};

// ─── Subsidy Analytics ────────────────────────────────────────────────────────

const NHB_PORTAL_LABELS = {
  'goc-new':        { label: 'GOC New',        color: 'bg-gray-400'   },
  'goc-processing': { label: 'GOC Processing', color: 'bg-blue-500'   },
  'query-issued':   { label: 'Query Issued',   color: 'bg-red-500'    },
  'query-replied':  { label: 'Query Replied',  color: 'bg-orange-400' },
  'goc-received':   { label: 'GOC Received',   color: 'bg-green-500'  },
};

const VERIF_LABELS = {
  'not-started': { label: 'Not Started', color: 'bg-gray-300' },
  'pending':     { label: 'Pending',     color: 'bg-yellow-400' },
  'completed':   { label: 'Completed',   color: 'bg-green-500'  },
};

const SCHEME_LABELS = {
  nhb:     { label: 'NHB',     color: 'bg-green-500'  },
  general: { label: 'General', color: 'bg-yellow-400' },
  aif:     { label: 'AIF',     color: 'bg-purple-500' },
  none:    { label: 'None',    color: 'bg-gray-300'   },
};

const SubsidyAnalyticsView = () => {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['reports', 'subsidy-analytics'],
    queryFn: () => getSubsidyAnalytics(),
    select: res => res.data.data,
  });

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading analytics…</div>;
  if (!raw) return null;

  const { totalSubsidies, schemeBreakdown, nhbPortalStatus, bankVerification, geoTagging, payment } = raw;
  const nhbTotal = nhbPortalStatus?.reduce((s, g) => s + g.count, 0) || 0;
  const bvTotal  = bankVerification?.reduce((s, g) => s + g.count, 0) || 0;
  const gtTotal  = geoTagging?.reduce((s, g) => s + g.count, 0) || 0;

  const exportNhbExcel = () => {
    const rows = (nhbPortalStatus ?? []).flatMap(g =>
      (g.applications ?? []).map(a => ({
        portalStatus: g.status, applicationId: a.applicationId,
        client: a.clientId?.name, mobile: a.clientId?.mobile,
        bank: a.clientId?.bankName, vendor: a.clientId?.vendorId?.vendorName,
        nhbId: a.nhbDetails?.nhbId, nhbProjectCode: a.nhbDetails?.nhbProjectCode,
        bankVerif: a.bankVerificationStatus, geoTag: a.geoTaggingStatus,
        paymentReceived: a.paymentDetails?.paymentReceived ? 'Yes' : 'No',
        date: formatDate(a.applicationDate),
      }))
    );
    exportSingleSheet('NHB Tracker', [
      { header: 'NHB Portal Status', accessor: r => r.portalStatus   },
      { header: 'Application ID',    accessor: r => r.applicationId  },
      { header: 'Client',            accessor: r => r.client         },
      { header: 'Mobile',            accessor: r => r.mobile         },
      { header: 'Bank',              accessor: r => r.bank           },
      { header: 'Vendor',            accessor: r => r.vendor         },
      { header: 'NHB ID',            accessor: r => r.nhbId          },
      { header: 'NHB Project Code',  accessor: r => r.nhbProjectCode },
      { header: 'Bank Verification', accessor: r => r.bankVerif      },
      { header: 'Geo-Tagging',       accessor: r => r.geoTag         },
      { header: 'Payment Received',  accessor: r => r.paymentReceived},
      { header: 'File Date',         accessor: r => r.date           },
    ], rows, 'nhb-tracker');
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total Subsidies"   value={totalSubsidies}                color="text-gray-800"   icon={FileText}    iconBg="bg-blue-50 text-blue-600" />
        <Stat label="Payment Received"  value={payment?.paymentReceived ?? 0} color="text-green-700"  icon={CheckCircle} iconBg="bg-green-50 text-green-600" />
        <Stat label="Payment Pending"   value={payment?.paymentPending ?? 0}  color="text-red-600"    icon={AlertCircle} iconBg="bg-red-50 text-red-600" />
        <Stat
          label="Total Amount Received"
          value={payment?.totalAmountReceived ? `₹${Number(payment.totalAmountReceived).toLocaleString('en-IN')}` : '₹0'}
          color="text-emerald-700"
          icon={IndianRupee}
          iconBg="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Scheme Distribution + Payment split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Scheme Distribution</h3>
          </div>
          <div className="space-y-3">
            {(schemeBreakdown ?? []).map(g => {
              const meta = SCHEME_LABELS[g.type] || SCHEME_LABELS.none;
              return (
                <MiniBar key={g.type} label={meta.label} count={g.count}
                  total={totalSubsidies} color={meta.color} />
              );
            })}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Payment Overview</h3>
          </div>
          <div className="space-y-3">
            <MiniBar label="Received" count={payment?.paymentReceived ?? 0} total={totalSubsidies} color="bg-green-500" />
            <MiniBar label="Pending"  count={payment?.paymentPending  ?? 0} total={totalSubsidies} color="bg-red-400"   />
          </div>
          {payment?.totalAmountReceived > 0 && (
            <div className="mt-2 pt-3 border-t border-gray-100 text-sm text-gray-600">
              Total received: <span className="font-semibold text-emerald-700">₹{Number(payment.totalAmountReceived).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bank Verification + Geo-Tagging */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Bank Verification</h3>
          </div>
          <div className="space-y-3">
            {(bankVerification ?? []).map(g => {
              const meta = VERIF_LABELS[g.status] || VERIF_LABELS['not-started'];
              return <MiniBar key={g.status} label={meta.label} count={g.count} total={bvTotal} color={meta.color} />;
            })}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">📍</span>
            <h3 className="text-sm font-semibold text-gray-700">Geo-Tagging</h3>
          </div>
          <div className="space-y-3">
            {(geoTagging ?? []).map(g => {
              const meta = VERIF_LABELS[g.status] || VERIF_LABELS['not-started'];
              return <MiniBar key={g.status} label={meta.label} count={g.count} total={gtTotal} color={meta.color} />;
            })}
          </div>
        </div>
      </div>

      {/* NHB Portal Status — main tracker with expandable who-is-who */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm">🏛</span>
            <h3 className="text-sm font-semibold text-gray-700">NHB Portal Status Tracker</h3>
            <span className="text-xs text-gray-400">({nhbTotal} NHB applications)</span>
          </div>
          <Button variant="secondary" size="sm" icon={Download} onClick={exportNhbExcel}>Export NHB Tracker</Button>
        </div>

        {nhbTotal === 0 ? (
          <p className="text-center text-gray-400 py-6 text-sm">No NHB applications yet.</p>
        ) : (
          <div className="space-y-3">
            {(nhbPortalStatus ?? []).map(g => {
              const meta = NHB_PORTAL_LABELS[g.status] || { label: g.status, color: 'bg-gray-300' };
              return (
                <div key={g.status} className="border border-gray-200 rounded-xl overflow-hidden">
                  <details className="group">
                    <summary className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 list-none">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${meta.color}`} />
                          <span className="text-sm font-semibold text-gray-800">{meta.label}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${meta.color}`}
                            style={{ width: `${nhbTotal ? Math.round((g.count / nhbTotal) * 100) : 0}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-gray-800">{g.count}</p>
                        <p className="text-xs text-gray-400">{nhbTotal ? Math.round((g.count / nhbTotal) * 100) : 0}%</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-1">
                      <AppList apps={g.applications} type="subsidy" />
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Client Report ────────────────────────────────────────────────────────────
const ClientReport = () => {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'client', { page }],
    queryFn: () => getClientWiseReport({ page, limit: 20 }),
    select: (res) => res.data,
  });
  const rows = data?.data ?? [];

  const exportExcel = () => {
    exportSingleSheet('Client-wise Report', [
      { header: 'Client ID',       accessor: r => r.client?.clientId },
      { header: 'Name',            accessor: r => r.client?.name },
      { header: 'Mobile',          accessor: r => r.client?.mobile },
      { header: 'Bank Loans',      accessor: r => r.bankLoanApplications?.count },
      { header: 'Subsidies',       accessor: r => r.subsidyApplications?.count },
      { header: 'Doc Completion %',accessor: r => r.documentCompletionPercentage },
    ], rows, 'client-wise-report');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
      </div>
      {isLoading ? <div className="py-8 text-center text-gray-400">Loading…</div> : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.client?._id} className="border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpanded(expanded === r.client?._id ? null : r.client?._id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{r.client?.name}</p>
                  <p className="text-xs text-gray-400">{r.client?.clientId} · {r.client?.mobile}</p>
                  {r.client?.vendor && <p className="text-xs text-purple-500">via {r.client.vendor.vendorName}</p>}
                </div>
                <div className="flex gap-4 text-center shrink-0">
                  <div><p className="text-lg font-bold text-blue-700">{r.bankLoanApplications?.count}</p><p className="text-[10px] text-gray-400">Bank Loans</p></div>
                  <div><p className="text-lg font-bold text-purple-700">{r.subsidyApplications?.count}</p><p className="text-[10px] text-gray-400">Subsidies</p></div>
                  <div><p className="text-lg font-bold text-green-700">{r.documentCompletionPercentage}%</p><p className="text-[10px] text-gray-400">Docs Done</p></div>
                </div>
                {expanded === r.client?._id
                  ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
              </button>

              {expanded === r.client?._id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                  {r.bankLoanApplications?.list?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-blue-600 mb-1.5">Bank Loan Applications</p>
                      <div className="space-y-1">
                        {r.bankLoanApplications.list.map(a => (
                          <div key={a.applicationId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs">
                            <span className="font-mono text-gray-500">{a.applicationId}</span>
                            <StatusBadge status={a.status} />
                            <span className="text-gray-400 ml-auto">{formatDate(a.date)}</span>
                            {a.amount && <span className="text-blue-600 font-medium">₹{Number(a.amount).toLocaleString('en-IN')}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {r.subsidyApplications?.list?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-purple-600 mb-1.5">Subsidy Applications</p>
                      <div className="space-y-1">
                        {r.subsidyApplications.list.map(a => (
                          <div key={a.applicationId} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs">
                            <span className="font-mono text-gray-500">{a.applicationId}</span>
                            <StatusBadge status={a.status} />
                            <span className="text-gray-400 text-[10px]">{a.scheme}</span>
                            <span className="text-gray-400 ml-auto">{formatDate(a.date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-center text-gray-400 py-8">No data found.</p>}
        </div>
      )}
    </div>
  );
};

// ─── Vendor Report ────────────────────────────────────────────────────────────
const VendorReport = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'vendor'],
    queryFn: () => getVendorWiseReport(),
    select: (res) => res.data.data,
  });

  const exportExcel = () => {
    exportSingleSheet('Vendor-wise Report', [
      { header: 'Vendor',        accessor: r => r.vendor?.vendorName },
      { header: 'Total Clients', accessor: r => r.totalClients },
      { header: 'Bank Loans',    accessor: r => r.bankLoanApplications },
      { header: 'Subsidies',     accessor: r => r.subsidyApplications },
      { header: 'Total Apps',    accessor: r => r.totalApplications },
      { header: 'Approved',      accessor: r => r.approvedApplications },
      { header: 'Success Rate',  accessor: r => `${r.successRate}%` },
    ], data ?? [], 'vendor-wise-report');
  };

  const maxApps = Math.max(...(data ?? []).map(r => r.totalApplications), 1);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
      </div>
      {isLoading ? <div className="py-8 text-center text-gray-400">Loading…</div> : (
        <div className="space-y-3">
          {(data ?? []).map(r => (
            <div key={r.vendor?._id} className="card p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{r.vendor?.vendorName}</p>
                  <p className="text-xs text-gray-400">{r.vendor?.vendorCode} · {r.totalClients} clients</p>
                </div>
                <Badge color={r.successRate >= 70 ? 'green' : r.successRate >= 40 ? 'yellow' : 'red'}>
                  {r.successRate}% success
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                <div className="bg-blue-50 rounded-lg p-2">
                  <p className="text-base font-bold text-blue-700">{r.bankLoanApplications}</p>
                  <p className="text-[10px] text-gray-400">Bank Loans</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-2">
                  <p className="text-base font-bold text-purple-700">{r.subsidyApplications}</p>
                  <p className="text-[10px] text-gray-400">Subsidies</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2">
                  <p className="text-base font-bold text-green-700">{r.approvedApplications}</p>
                  <p className="text-[10px] text-gray-400">Approved</p>
                </div>
              </div>
              {/* Volume bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Volume</span><span>{r.totalApplications} total</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full"
                    style={{ width: `${(r.totalApplications / maxApps) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <p className="text-center text-gray-400 py-8">No vendor data.</p>}
        </div>
      )}
    </div>
  );
};

// ─── Date Range Report ────────────────────────────────────────────────────────
const DateRangeReport = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'daterange', { from, to }],
    queryFn: () => getDateRangeReport({ from, to }),
    enabled: submitted,
    select: (res) => res.data.data,
  });

  const rows = [...(data?.bankLoanApplications ?? []), ...(data?.subsidyApplications ?? [])];

  const exportExcel = () => {
    exportSingleSheet('Date Range Report', [
      { header: 'Application ID', accessor: r => r.applicationId },
      { header: 'Client',         accessor: r => r.clientId?.name },
      { header: 'Status',         accessor: r => r.currentStatus },
      { header: 'Date',           accessor: r => formatDate(r.applicationDate) },
      { header: 'Type',           accessor: r => r.applicationId?.startsWith('BL') ? 'Bank Loan' : 'Subsidy' },
    ], rows, 'date-range-report');
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div><label className="label-base">From Date</label>
          <input type="date" className="input-base" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><label className="label-base">To Date</label>
          <input type="date" className="input-base" value={to} onChange={e => setTo(e.target.value)} /></div>
        <Button onClick={() => { setSubmitted(true); }} loading={isLoading}>Generate Report</Button>
        {submitted && rows.length > 0 && (
          <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
        )}
      </div>

      {submitted && (
        <>
          {data && (
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Total" value={data.summary?.total} color="text-gray-800" />
              <Stat label="Bank Loans" value={data.summary?.bankLoans} color="text-blue-700" />
              <Stat label="Subsidies"  value={data.summary?.subsidies} color="text-purple-700" />
            </div>
          )}
          {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead><tr>
                {['Application ID', 'Client', 'Status', 'Date', 'Type'].map(h =>
                  <th key={h} className="table-th">{h}</th>)}
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.applicationId} className="hover:bg-gray-50">
                    <td className="table-td font-mono text-xs">{r.applicationId}</td>
                    <td className="table-td">{r.clientId?.name ?? '—'}</td>
                    <td className="table-td"><StatusBadge status={r.currentStatus} /></td>
                    <td className="table-td">{formatDate(r.applicationDate)}</td>
                    <td className="table-td">
                      <Badge color={r.applicationId?.startsWith('BL') ? 'blue' : 'purple'}>
                        {r.applicationId?.startsWith('BL') ? 'Bank Loan' : 'Subsidy'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {submitted && rows.length === 0 && !isLoading && (
              <p className="text-center text-gray-400 py-8">No applications in this range.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Performance Report ───────────────────────────────────────────────────────
const PerformanceReportView = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'performance'],
    queryFn: () => getPerformanceReport(),
    select: (res) => res.data.data,
  });

  if (isLoading) return <div className="py-8 text-center text-gray-400">Loading…</div>;
  const d = data ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: 'Bank Loan', emoji: '🏦', metrics: d.bankLoan,  color: 'blue' },
          { title: 'Subsidy',   emoji: '🏛',  metrics: d.subsidy,  color: 'purple' },
        ].map(({ title, emoji, metrics, color }) => (
          <div key={title} className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{emoji} {title} Performance</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Stat label="Total"       value={metrics?.total}       color="text-gray-800" />
              <Stat label="Approved"    value={metrics?.approved}    color="text-green-700" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Success Rate</span>
                  <span className="font-semibold">{metrics?.successRate ?? 0}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${metrics?.successRate >= 70 ? 'bg-green-500' : metrics?.successRate >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${metrics?.successRate ?? 0}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-t border-gray-50">
                <span className="text-gray-500">Avg Processing</span>
                <span className="font-semibold">{metrics?.avgProcessingDays ?? '—'} days</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Audit Log ────────────────────────────────────────────────────────────────
const AuditLogReportView = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'audit', { page }],
    queryFn: () => getAuditLogReport({ page, limit: 20 }),
    select: (res) => res.data,
  });
  const logs = data?.data ?? [];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead><tr>
          {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID'].map(h =>
            <th key={h} className="table-th">{h}</th>)}
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {isLoading ? (
            <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
          ) : logs.map(log => (
            <tr key={log._id} className="hover:bg-gray-50">
              <td className="table-td text-xs">{formatDateTime(log.createdAt)}</td>
              <td className="table-td">{log.userId?.fullName ?? log.userId?.username ?? '—'}</td>
              <td className="table-td">
                <Badge color={{ create: 'green', update: 'blue', delete: 'red' }[log.action] || 'gray'}>{log.action}</Badge>
              </td>
              <td className="table-td capitalize">{log.entity}</td>
              <td className="table-td font-mono text-xs">{log.entityId}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isLoading && logs.length === 0 && <p className="text-center text-gray-400 py-8">No audit logs found.</p>}
    </div>
  );
};

// ─── Report Cards ─────────────────────────────────────────────────────────────
const reportTypes = [
  { id: 'subsidy-analytics', label: 'Subsidy Analytics',     icon: TrendingUp,  description: 'NHB portal tracker, payment stats, scheme breakdown, verification status',  color: 'bg-emerald-50 text-emerald-600', roles: [] },
  { id: 'status',            label: 'Status-wise Report',    icon: FileText,    description: 'Applications grouped by status — click to see exactly who is in each bucket', color: 'bg-green-50 text-green-600',   roles: [] },
  { id: 'client',            label: 'Client-wise Report',    icon: Users,       description: 'All clients with their applications and document completion',                  color: 'bg-blue-50 text-blue-600',     roles: [] },
  { id: 'vendor',            label: 'Vendor-wise Report',    icon: BarChart3,   description: 'Vendor performance, client count, and success rates',                         color: 'bg-purple-50 text-purple-600', roles: [] },
  { id: 'daterange',         label: 'Date Range Report',     icon: Calendar,    description: 'All applications filed within a custom date range',                           color: 'bg-orange-50 text-orange-600', roles: [] },
  { id: 'performance',       label: 'Performance Analytics', icon: TrendingUp,  description: 'Success rates, approval times, and bottleneck metrics',                       color: 'bg-sky-50 text-sky-600',       roles: ['admin', 'viewer'] },
  { id: 'audit',             label: 'Audit Log Report',      icon: Shield,      description: 'System activity and user action history',                                     color: 'bg-red-50 text-red-600',       roles: ['admin'] },
];

// ─── Main Reports Page ────────────────────────────────────────────────────────
const Reports = () => {
  usePageTitle('Reports');
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState(null);

  const accessible = reportTypes.filter(r => r.roles.length === 0 || r.roles.includes(user?.role));

  if (!activeReport) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Reports & Analytics</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessible.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className="card p-5 text-left hover:shadow-md transition-all hover:border-primary-200 group">
              <div className={`inline-flex p-3 rounded-xl mb-3 ${r.color}`}>
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700">{r.label}</h3>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">{r.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const report = reportTypes.find(r => r.id === activeReport);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setActiveReport(null)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
        <div>
          <h1 className="page-title">{report?.label}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{report?.description}</p>
        </div>
      </div>

      {activeReport === 'subsidy-analytics' && <SubsidyAnalyticsView />}
      {activeReport === 'client'            && <ClientReport />}
      {activeReport === 'vendor'            && <VendorReport />}
      {activeReport === 'daterange'         && <DateRangeReport />}
      {activeReport === 'status'            && <StatusWiseReportView />}
      {activeReport === 'performance'       && <PerformanceReportView />}
      {activeReport === 'audit'             && <AuditLogReportView />}
    </div>
  );
};

export default Reports;
