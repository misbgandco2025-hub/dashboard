import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, BarChart3, Calendar, TrendingUp, Shield, Users } from 'lucide-react';
import {
  getClientWiseReport, getVendorWiseReport, getStatusWiseReport,
  getDateRangeReport, getPerformanceReport, getAuditLogReport,
} from '../services/reportService';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { StatusBadge } from '../components/common/Badge';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { exportSingleSheet } from '../utils/exportExcel';
import { exportTableToPDF } from '../utils/exportPDF';

const reportTypes = [
  { id: 'client', label: 'Client-wise Report', icon: Users, description: 'All clients with their applications and document status', color: 'bg-blue-50 text-blue-600', roles: [] },
  { id: 'vendor', label: 'Vendor-wise Report', icon: BarChart3, description: 'Vendor performance and client distribution', color: 'bg-purple-50 text-purple-600', roles: [] },
  { id: 'status', label: 'Status-wise Report', icon: FileText, description: 'Applications grouped by current status with aging', color: 'bg-green-50 text-green-600', roles: [] },
  { id: 'daterange', label: 'Date Range Report', icon: Calendar, description: 'All applications within a date range', color: 'bg-orange-50 text-orange-600', roles: [] },
  { id: 'performance', label: 'Performance Analytics', icon: TrendingUp, description: 'Success rates, processing times, bottlenecks', color: 'bg-emerald-50 text-emerald-600', roles: ['admin', 'viewer'] },
  { id: 'audit', label: 'Audit Log Report', icon: Shield, description: 'System activity and user action history', color: 'bg-red-50 text-red-600', roles: ['admin'] },
];

// ─── Client Report ────────────────────────────────────────────────────────────
const ClientReport = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'client', { page }],
    queryFn: () => getClientWiseReport({ page, limit: 20 }),
    select: (res) => res.data,
  });
  const rows = data?.data ?? [];

  const exportExcel = () => {
    exportSingleSheet('Client-wise Report', [
      { header: 'Client ID', accessor: (r) => r.client?.clientId },
      { header: 'Name', accessor: (r) => r.client?.name },
      { header: 'Mobile', accessor: (r) => r.client?.mobile },
      { header: 'Bank Loans', accessor: (r) => r.bankLoanApplications?.count },
      { header: 'Subsidies', accessor: (r) => r.subsidyApplications?.count },
      { header: 'Doc Completion %', accessor: (r) => r.documentCompletionPercentage },
    ], rows, 'client-wise-report');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
      </div>
      {isLoading ? <div className="py-8 text-center text-gray-400">Loading...</div> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.client?._id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-gray-900">{r.client?.name}</p>
                  <p className="text-xs text-gray-400">{r.client?.clientId} · {r.client?.mobile}</p>
                </div>
                <div className="flex gap-3 text-center">
                  <div><p className="text-lg font-bold text-blue-700">{r.bankLoanApplications?.count}</p><p className="text-[10px] text-gray-400">Bank Loans</p></div>
                  <div><p className="text-lg font-bold text-purple-700">{r.subsidyApplications?.count}</p><p className="text-[10px] text-gray-400">Subsidies</p></div>
                  <div><p className="text-lg font-bold text-green-700">{r.documentCompletionPercentage}%</p><p className="text-[10px] text-gray-400">Docs Done</p></div>
                </div>
              </div>
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
      { header: 'Vendor', accessor: (r) => r.vendor?.vendorName },
      { header: 'Total Clients', accessor: (r) => r.totalClients },
      { header: 'Bank Loans', accessor: (r) => r.bankLoanApplications },
      { header: 'Subsidies', accessor: (r) => r.subsidyApplications },
      { header: 'Total Apps', accessor: (r) => r.totalApplications },
      { header: 'Approved', accessor: (r) => r.approvedApplications },
      { header: 'Success Rate', accessor: (r) => `${r.successRate}%` },
    ], data ?? [], 'vendor-wise-report');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" icon={Download} onClick={exportExcel}>Export Excel</Button>
      </div>
      {isLoading ? <div className="py-8 text-center text-gray-400">Loading...</div> : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead><tr>
              {['Vendor', 'Clients', 'Bank Loans', 'Subsidies', 'Total', 'Approved', 'Success Rate'].map((h) => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr></thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {(data ?? []).map((r) => (
                <tr key={r.vendor?._id} className="hover:bg-gray-50">
                  <td className="table-td font-medium">{r.vendor?.vendorName}</td>
                  <td className="table-td">{r.totalClients}</td>
                  <td className="table-td">{r.bankLoanApplications}</td>
                  <td className="table-td">{r.subsidyApplications}</td>
                  <td className="table-td">{r.totalApplications}</td>
                  <td className="table-td">{r.approvedApplications}</td>
                  <td className="table-td"><Badge color={r.successRate >= 70 ? 'green' : r.successRate >= 40 ? 'yellow' : 'red'}>{r.successRate}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
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

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label-base">From Date</label>
          <input type="date" className="input-base" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label-base">To Date</label>
          <input type="date" className="input-base" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button onClick={() => setSubmitted(true)} loading={isLoading}>Generate Report</Button>
      </div>

      {submitted && (
        <>
          {data && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total', value: data.summary?.total, color: 'text-gray-800' },
                { label: 'Bank Loans', value: data.summary?.bankLoans, color: 'text-blue-700' },
                { label: 'Subsidies', value: data.summary?.subsidies, color: 'text-purple-700' },
              ].map((s) => (
                <div key={s.label} className="card p-4 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {isLoading && <div className="py-8 text-center text-gray-400">Loading...</div>}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead><tr>
                {['Application ID', 'Client', 'Status', 'Date', 'Type'].map((h) => <th key={h} className="table-th">{h}</th>)}
              </tr></thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.applicationId} className="hover:bg-gray-50">
                    <td className="table-td font-mono text-xs">{r.applicationId}</td>
                    <td className="table-td">{r.clientId?.name ?? '—'}</td>
                    <td className="table-td"><StatusBadge status={r.currentStatus} /></td>
                    <td className="table-td">{formatDate(r.applicationDate)}</td>
                    <td className="table-td"><Badge color={r.applicationId?.startsWith('BL') ? 'blue' : 'purple'}>{r.applicationId?.startsWith('BL') ? 'Bank Loan' : 'Subsidy'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {submitted && rows.length === 0 && !isLoading && <p className="text-center text-gray-400 py-8">No applications found for this date range.</p>}
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

  if (isLoading) return <div className="py-8 text-center text-gray-400">Loading...</div>;

  const d = data ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: 'Bank Loan Performance', metrics: d.bankLoan, color: 'blue' },
          { title: 'Subsidy Performance', metrics: d.subsidy, color: 'purple' },
        ].map(({ title, metrics, color }) => (
          <div key={title} className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
            <div className="space-y-2">
              {[
                ['Total Applications', metrics?.total],
                ['Approved', metrics?.approved],
                ['Success Rate', metrics?.successRate != null ? `${metrics.successRate}%` : '—'],
                ['Avg Processing Days', metrics?.avgProcessingDays != null ? `${metrics.avgProcessingDays} days` : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-sm text-gray-500">{label}</span>
                  <span className="text-sm font-semibold text-gray-800">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {d.queryMetrics && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Query Resolution</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center"><p className="text-2xl font-bold text-gray-800">{d.queryMetrics.totalResolved}</p><p className="text-xs text-gray-400">Total Resolved</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-gray-800">{d.queryMetrics.avgResolutionDays} days</p><p className="text-xs text-gray-400">Avg Resolution Time</p></div>
          </div>
        </div>
      )}
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
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead><tr>
            {['Timestamp', 'User', 'Action', 'Entity', 'Entity ID'].map((h) => <th key={h} className="table-th">{h}</th>)}
          </tr></thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50">
                <td className="table-td text-xs">{formatDateTime(log.createdAt)}</td>
                <td className="table-td">{log.userId?.fullName ?? log.userId?.username ?? '—'}</td>
                <td className="table-td"><Badge color={{ create: 'green', update: 'blue', delete: 'red' }[log.action] || 'gray'}>{log.action}</Badge></td>
                <td className="table-td capitalize">{log.entity}</td>
                <td className="table-td font-mono text-xs">{log.entityId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && logs.length === 0 && <p className="text-center text-gray-400 py-8">No audit logs found.</p>}
      </div>
    </div>
  );
};

// ─── Main Reports Page ────────────────────────────────────────────────────────
const Reports = () => {
  usePageTitle('Reports');
  const { isAdmin, isViewer, user } = useAuth();
  const [activeReport, setActiveReport] = useState(null);

  const accessible = reportTypes.filter((r) => r.roles.length === 0 || r.roles.includes(user?.role));

  if (!activeReport) {
    return (
      <div className="space-y-5">
        <h1 className="page-title">Reports</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessible.map((r) => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className="card p-5 text-left hover:shadow-md transition-shadow hover:border-primary-200 group">
              <div className={`inline-flex p-3 rounded-xl mb-3 ${r.color}`}>
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700">{r.label}</h3>
              <p className="text-sm text-gray-400 mt-1">{r.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const report = reportTypes.find((r) => r.id === activeReport);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => setActiveReport(null)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <BarChart3 className="h-5 w-5 rotate-180" />
        </button>
        <h1 className="page-title">{report?.label}</h1>
      </div>

      {activeReport === 'client' && <ClientReport />}
      {activeReport === 'vendor' && <VendorReport />}
      {activeReport === 'daterange' && <DateRangeReport />}
      {activeReport === 'status' && <StatusWiseReportView />}
      {activeReport === 'performance' && <PerformanceReportView />}
      {activeReport === 'audit' && <AuditLogReportView />}
    </div>
  );
};

const StatusWiseReportView = () => {
  const [type, setType] = useState('bank-loan');
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'status', type],
    queryFn: () => getStatusWiseReport({ type }),
    select: (res) => res.data.data,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['bank-loan', 'subsidy'].map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${type === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t === 'bank-loan' ? 'Bank Loan' : 'Subsidy'}
          </button>
        ))}
      </div>
      {isLoading ? <div className="py-8 text-center text-gray-400">Loading...</div> : (
        <div className="space-y-3">
          {(data ?? []).map((g) => (
            <div key={g.status} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <StatusBadge status={g.status} />
                <p className="text-xs text-gray-400 mt-1">Avg {g.avgDaysInProcess} days in this status</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{g.count}</p>
                <p className="text-xs text-gray-400">applications</p>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <p className="text-center text-gray-400 py-8">No data.</p>}
        </div>
      )}
    </div>
  );
};

export default Reports;
