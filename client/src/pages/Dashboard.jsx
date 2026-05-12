import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Landmark, HandCoins, CheckCircle2, FileWarning,
  TrendingUp, AlertTriangle, Activity, X, ChevronRight,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Legend,
} from 'recharts';
import {
  getDashboardSummary, getStatusDistribution,
  getVendorDistribution, getMonthlyTrend, getMyTasks,
} from '../services/dashboardService';
import { getBankLoans } from '../services/bankLoanService';
import { getSubsidies } from '../services/subsidyService';
import { getClients } from '../services/clientService';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import Loader from '../components/common/Loader';
import { getMonthName, formatNumber, formatDate } from '../utils/dateFormat';

const PIE_COLORS = ['#6366f1','#3b82f6','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── Clickable Gradient Stat Card ──────────────────────────────────────────────
const GradCard = ({ icon: Icon, label, value, sub, grad, onClick }) => (
  <div
    onClick={onClick}
    className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${grad} shadow-lg text-white
      ${onClick ? 'cursor-pointer hover:scale-[1.02] hover:shadow-xl transition-all duration-200' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-extrabold mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
      </div>
      <div className="p-3 rounded-xl bg-white/20">
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
    {onClick && (
      <p className="text-xs opacity-60 mt-3 flex items-center gap-1">
        Click to view details <ChevronRight className="h-3 w-3" />
      </p>
    )}
    <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-white" />
    <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
  </div>
);

// ── Flat Stat Card ────────────────────────────────────────────────────────────
const FlatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, badge, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4 transition-all duration-200
      ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-200 hover:scale-[1.01]' : ''}`}
  >
    <div className={`p-3 rounded-xl shrink-0 ${iconBg}`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className="flex items-end gap-2 mt-0.5">
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        {badge && <span className="mb-0.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{badge}</span>}
      </div>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      {onClick && <p className="text-xs text-blue-500 mt-1 flex items-center gap-0.5 font-medium">Click to view <ChevronRight className="h-3 w-3" /></p>}
    </div>
  </div>
);

// ── Pipeline Bar ──────────────────────────────────────────────────────────────
const PipelineBar = ({ label, value, max, color }) => {
  const w = max ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium truncate max-w-[60%]">{label}</span>
        <span className="font-bold text-gray-800">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
};

// ── Drill-Down Config ─────────────────────────────────────────────────────────
// drillKey format: '<mode>:<drillType>'  e.g. 'bank-loan:active', 'subsidy:pending-docs'
const getDrillConfig = (drillKey) => {
  if (!drillKey) return null;
  const [mode, drillType] = drillKey.split(':');
  const isBL = mode === 'bank-loan';
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfYear  = new Date(now.getFullYear(), 0, 1).toISOString();

  const configs = {
    active: {
      title: isBL ? 'Active Bank Loans' : 'Active Subsidies',
      subtitle: 'All active applications',
      gradFrom: isBL ? 'from-blue-600' : 'from-emerald-600',
      gradTo:   isBL ? 'to-blue-400'   : 'to-emerald-400',
      params: {},
    },
    'completed-month': {
      title: 'Completed This Month',
      subtitle: 'Completed / approved this month',
      gradFrom: isBL ? 'from-violet-600' : 'from-teal-600',
      gradTo:   isBL ? 'to-violet-400'   : 'to-teal-400',
      params: {
        currentStatus: isBL ? 'Disbursement Completed' : 'Subsidy Released',
        from: startOfMonth,
      },
    },
    'total-clients': {
      title: 'Total Clients',
      subtitle: 'All registered clients',
      gradFrom: 'from-slate-700',
      gradTo:   'to-slate-500',
      isClients: true,
      params: { limit: 100 },
    },
    'pending-docs': {
      title: 'Pending Documents',
      subtitle: 'Applications with missing documents',
      gradFrom: 'from-amber-600',
      gradTo:   'to-amber-400',
      params: { hasPendingDocs: true },
    },
    'open-queries': {
      title: 'Open Queries',
      subtitle: 'Applications requiring follow-up',
      gradFrom: 'from-red-600',
      gradTo:   'to-red-400',
      params: { hasOpenQuery: true },
    },
    'apps-year': {
      title: 'Applications This Year',
      subtitle: 'All applications created this year',
      gradFrom: isBL ? 'from-blue-600' : 'from-emerald-600',
      gradTo:   isBL ? 'to-sky-400'    : 'to-teal-400',
      params: { from: startOfYear },
    },
  };
  return { isBL, drillType, mode, ...configs[drillType] };
};

// ── Drill-Down Slide-Over ─────────────────────────────────────────────────────
const QUERY_STATUS_COLOR = {
  open:          'bg-red-100 text-red-700',
  'in-progress': 'bg-amber-100 text-amber-700',
  closed:        'bg-gray-100 text-gray-500',
};

const DrillDownDrawer = ({ drillKey, onClose, navigate }) => {
  const cfg = getDrillConfig(drillKey);
  if (!cfg) return null;
  const { isBL, drillType, mode, title, subtitle, gradFrom, gradTo, isClients, params } = cfg;
  const isOpenQueries = drillType === 'open-queries';

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data, isLoading } = useQuery({
    queryKey: ['drill-down', drillKey],
    queryFn: () => {
      if (isClients) return getClients({ ...params });
      return isBL
        ? getBankLoans({ limit: 100, ...params })
        : getSubsidies({ limit: 100, ...params });
    },
    select: (res) => {
      if (isClients) return res.data?.data ?? [];
      return res.data?.data ?? [];
    },
    enabled: !!drillKey,
  });

  const openItem = (item, initialTab) => {
    onClose();
    if (isClients) {
      navigate('/clients', { state: { openClient: item } });
    } else {
      navigate(isBL ? '/bank-loans' : '/subsidies', {
        state: { openApp: item, ...(initialTab ? { initialTab } : {}) },
      });
    }
  };

  const viewAllPath = isClients ? '/clients' : (isBL ? '/bank-loans' : '/subsidies');

  // For open-queries: count open queries across all apps
  const totalOpenQueries = isOpenQueries
    ? (data ?? []).reduce((sum, app) =>
        sum + (app.queries ?? []).filter(q => q.status === 'open' || q.status === 'in-progress').length, 0)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className={`p-5 flex items-center justify-between text-white bg-gradient-to-r ${gradFrom} ${gradTo}`}>
          <div>
            <p className="text-xs opacity-80 uppercase tracking-wider">
              {isClients ? 'Clients' : (isBL ? 'Bank Loan' : 'Subsidy')}
            </p>
            <p className="text-lg font-bold mt-0.5">{title}</p>
            <p className="text-xs opacity-70 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Count badge */}
        {!isLoading && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500">
              {isOpenQueries
                ? `${totalOpenQueries} open quer${totalOpenQueries === 1 ? 'y' : 'ies'} across ${data?.length ?? 0} applications`
                : `${data?.length ?? 0} ${isClients ? 'clients' : 'applications'} found`}
            </span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center pt-12">
              <div className="animate-spin h-7 w-7 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : !data?.length ? (
            <div className="text-center pt-12 text-gray-400 text-sm">No records found</div>
          ) : isClients ? (
            data.map((client) => (
              <button key={client._id} onClick={() => openItem(client)}
                className="w-full text-left bg-gray-50 hover:bg-slate-100 border border-gray-100 hover:border-slate-200 rounded-xl p-4 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{client.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{client.clientId} · {client.mobile}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 capitalize">
                        {client.sourceType ?? 'direct'}
                      </span>
                      {client.businessName && (
                        <span className="text-xs text-gray-500 truncate max-w-[140px]">{client.businessName}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-slate-500 shrink-0 ml-2 transition-colors" />
                </div>
              </button>
            ))
          ) : isOpenQueries ? (
            // ── Open Queries view: expand each app to show its queries ──
            data.map((app) => {
              const openQs = (app.queries ?? []).filter(q => q.status === 'open' || q.status === 'in-progress');
              if (!openQs.length) return null;
              return (
                <div key={app._id} className="border border-red-100 rounded-xl overflow-hidden bg-white">
                  {/* App header */}
                  <div className="px-4 py-3 bg-red-50 flex items-center justify-between border-b border-red-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{app.clientId?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500 font-mono">{app.applicationId}</p>
                    </div>
                    <span className="shrink-0 ml-2 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      {openQs.length} quer{openQs.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                  {/* Query list */}
                  <div className="divide-y divide-gray-50">
                    {openQs.map((q) => (
                      <button key={q._id} onClick={() => openItem(app, 'queries')}
                        className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors group flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-mono text-gray-400">{q.queryNumber}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${QUERY_STATUS_COLOR[q.status] ?? 'bg-gray-100 text-gray-500'}`}>
                              {q.status}
                            </span>
                            {q.priority && (
                              <span className="text-[10px] text-gray-400 capitalize">{q.priority}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 line-clamp-2 leading-snug">
                            {q.description || q.queryDescription || '—'}
                          </p>
                          {q.queryRaisedDate && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              Raised: {new Date(q.queryRaisedDate).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-red-500 shrink-0 mt-0.5 transition-colors" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            data.map((app) => (
              <button key={app._id} onClick={() => openItem(app)}
                className="w-full text-left bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl p-4 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{app.clientId?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{app.applicationId}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
                        {app.currentStatus}
                      </span>
                      {isBL && app.loanAmount && (
                        <span className="text-xs text-gray-500">₹{Number(app.loanAmount).toLocaleString('en-IN')}</span>
                      )}
                      {!isBL && app.schemeName && (
                        <span className="text-xs text-gray-500">{app.schemeName}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 shrink-0 ml-2 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <button onClick={() => { onClose(); navigate(viewAllPath); }}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-colors bg-gradient-to-r ${gradFrom} ${gradTo} hover:opacity-90`}>
            View All →
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Donut Tooltip ─────────────────────────────────────────────────────────────
const DonutTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 shadow-lg rounded-xl px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-gray-500">Count: <span className="font-bold text-gray-900">{payload[0].value}</span></p>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  usePageTitle('Dashboard');
  const { isDataEntry } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('bank-loan');
  const [drillDown, setDrillDown] = useState(null); // '<mode>:<drillType>' | null
  const drill = (type) => setDrillDown(`${mode}:${type}`);

  const { data: summary, isLoading } = useQuery({ queryKey: ['dashboard','summary'],    queryFn: getDashboardSummary,   select: r => r.data.data });
  const { data: statusDist }         = useQuery({ queryKey: ['dashboard','status-dist'], queryFn: getStatusDistribution, select: r => r.data.data });
  const { data: vendorDist }         = useQuery({ queryKey: ['dashboard','vendor-dist'], queryFn: getVendorDistribution, select: r => r.data.data });
  const { data: trend }              = useQuery({ queryKey: ['dashboard','trend'],       queryFn: getMonthlyTrend,       select: r => r.data.data });
  const { data: myTasks }            = useQuery({ queryKey: ['dashboard','my-tasks'],   queryFn: getMyTasks, enabled: isDataEntry, select: r => r.data.data });

  if (isLoading) return <Loader text="Loading dashboard..." />;

  const s    = summary ?? {};
  const isBL = mode === 'bank-loan';
  const accent = isBL ? 'blue' : 'emerald';

  const statusData   = (isBL ? statusDist?.bankLoan : statusDist?.subsidy) ?? [];
  const totalApps    = statusData.reduce((s, d) => s + d.count, 0);
  const rawTrend     = (isBL ? trend?.bankLoan : trend?.subsidy) ?? [];
  const trendData    = rawTrend.map(t => ({ month: `${getMonthName(t.month).slice(0,3)} ${String(t.year).slice(2)}`, Created: t.created, Approved: t.approved }));
  const vendorData   = (vendorDist ?? []).filter(v => isBL ? v.bankLoanApplications > 0 : v.subsidyApplications > 0).slice(0, 7).map(v => ({ name: v.vendor.vendorName?.split(' ')[0] ?? 'N/A', apps: isBL ? v.bankLoanApplications : v.subsidyApplications, clients: v.totalClients }));
  const activeCount  = isBL ? s.activeBankLoans : s.activeSubsidies;
  const doneMonth    = isBL ? s.completedThisMonth?.bankLoans : s.completedThisMonth?.subsidies;
  const doneYear     = isBL ? s.completedThisYear?.bankLoans  : s.completedThisYear?.subsidies;

  return (
    <div className="space-y-6">
      {drillDown && (
        <DrillDownDrawer drillKey={drillDown} onClose={() => setDrillDown(null)} navigate={navigate} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time overview · {new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 self-start sm:self-auto">
          {[['bank-loan','🏦  Bank Loan','blue'],['subsidy','🤝  Subsidy','emerald']].map(([key, label, col]) => (
            <button key={key} onClick={() => setMode(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${mode === key ? `bg-white shadow text-${col}-700 ring-1 ring-${col}-200` : 'text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Gradient Cards — all clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GradCard
          icon={isBL ? Landmark : HandCoins}
          label={isBL ? 'Active Bank Loans' : 'Active Subsidies'}
          value={formatNumber(activeCount)}
          sub="Click to view applications"
          grad={isBL ? 'from-blue-600 to-blue-400' : 'from-emerald-600 to-emerald-400'}
          onClick={() => drill('active')}
        />
        <GradCard icon={CheckCircle2} label="Completed This Month" value={formatNumber(doneMonth)} sub={`${formatNumber(doneYear)} this year`} grad={isBL ? 'from-violet-600 to-violet-400' : 'from-teal-600 to-teal-400'} onClick={() => drill('completed-month')} />
        <GradCard icon={TrendingUp} label="Monthly Success Rate" value={`${pct(doneMonth ?? 0, activeCount ?? 1)}%`} sub="completed vs active" grad="from-amber-500 to-orange-400" />
        <GradCard icon={Users} label="Total Clients" value={formatNumber(s.totalClients)} sub={`${s.vendorClients?.percentage ?? 0}% via vendors`} grad="from-slate-700 to-slate-500" onClick={() => drill('total-clients')} />
      </div>

      {/* Alert Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FlatCard icon={FileWarning} label="Pending Documents" value={formatNumber(isBL ? s.pendingDocumentsApplications?.bankLoans : s.pendingDocumentsApplications?.subsidies)} sub="applications missing docs" iconBg="bg-amber-50" iconColor="text-amber-600" onClick={() => drill('pending-docs')} />
        <FlatCard icon={AlertTriangle} label="Open Queries" value={formatNumber(isBL ? s.openQueries?.bankLoans : s.openQueries?.subsidies)} sub="require follow-up" iconBg="bg-red-50" iconColor="text-red-600" onClick={() => drill('open-queries')} />
        <FlatCard icon={Activity} label="Applications This Year" value={formatNumber((s.completedThisYear?.total ?? 0) + (activeCount ?? 0))} sub={`${pct(s.completedThisYear?.total ?? 0, (s.completedThisYear?.total ?? 0) + (activeCount ?? 0))}% completion rate`} iconBg={`bg-${accent}-50`} iconColor={`text-${accent}-600`} badge={`${pct(s.directClients?.count ?? 0, s.totalClients ?? 1)}% Direct`} onClick={() => drill('apps-year')} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-800">Status Breakdown</p>
              <p className="text-xs text-gray-400">{isBL ? 'Bank Loan' : 'Subsidy'} · {formatNumber(totalApps)} total</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-${accent}-50 text-${accent}-700`}>{statusData.length} stages</span>
          </div>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="count" nameKey="status" paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip content={<DonutTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {statusData.slice(0, 5).map((d, i) => (
                  <div key={d.status} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600 truncate max-w-[160px]">{d.status}</span>
                    </div>
                    <span className="font-semibold text-gray-800 ml-2">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="font-semibold text-gray-800 mb-1">Status Pipeline</p>
          <p className="text-xs text-gray-400 mb-4">Distribution across all statuses</p>
          <div className="space-y-3.5">
            {statusData.slice(0, 8).map((d, i) => (
              <PipelineBar key={d.status} label={d.status} value={d.count} max={statusData[0]?.count ?? 1}
                color={['bg-indigo-500','bg-blue-500','bg-sky-500','bg-emerald-500','bg-amber-500','bg-red-500','bg-violet-500','bg-pink-500'][i]} />
            ))}
            {statusData.length === 0 && <div className="flex items-center justify-center h-40 text-gray-300 text-sm">No data yet</div>}
          </div>
        </div>

        {/* My Tasks / Client split */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="font-semibold text-gray-800 mb-1">{isDataEntry ? 'My Tasks' : 'Client Overview'}</p>
          <p className="text-xs text-gray-400 mb-4">{isDataEntry ? 'Your assigned workload' : 'Vendor vs direct split'}</p>
          {isDataEntry && myTasks ? (
            <div className="space-y-4">
              {[
                { label: 'Total Assigned', value: myTasks.totalAssigned, color: 'bg-blue-500', pctVal: 100 },
                { label: 'Pending Bank Loans', value: myTasks.pendingBankLoans, color: 'bg-amber-500', pctVal: pct(myTasks.pendingBankLoans, myTasks.totalAssigned) },
                { label: 'Pending Subsidies', value: myTasks.pendingSubsidies, color: 'bg-violet-500', pctVal: pct(myTasks.pendingSubsidies, myTasks.totalAssigned) },
              ].map(t => (
                <div key={t.label} className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">{t.label}</span><span className="font-bold text-gray-900">{t.value}</span></div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pctVal}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Vendor Clients', value: s.vendorClients?.count, p: s.vendorClients?.percentage, color: `bg-${accent}-500`, icon: '🏢' },
                { label: 'Direct Clients', value: s.directClients?.count, p: s.directClients?.percentage, color: 'bg-slate-500', icon: '👤' },
              ].map(r => (
                <div key={r.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{r.icon} {r.label}</span>
                    <span className="font-bold text-gray-900">{formatNumber(r.value)} <span className="text-gray-400 font-normal text-xs">({r.p}%)</span></span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.p}%` }} /></div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[{label:'Done/Month',val:formatNumber(doneMonth),color:`text-${accent}-600`},{label:'Done/Year',val:formatNumber(doneYear),color:'text-violet-600'}].map(c => (
                  <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className={`text-xl font-extrabold ${c.color}`}>{c.val}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Area Trend */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold text-gray-800">Monthly Application Trend</p>
            <p className="text-xs text-gray-400">{isBL ? 'Bank Loan' : 'Subsidy'} · last 12 months</p>
          </div>
        </div>
        {trendData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No trend data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={isBL ? '#3b82f6' : '#10b981'} stopOpacity={0.3}/><stop offset="95%" stopColor={isBL ? '#3b82f6' : '#10b981'} stopOpacity={0}/></linearGradient>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <RTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Created" stroke={isBL ? '#3b82f6' : '#10b981'} strokeWidth={2.5} fill="url(#gC)" dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Approved" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gA)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Vendor Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="font-semibold text-gray-800 mb-1">Vendor-wise {isBL ? 'Bank Loan' : 'Subsidy'} Applications</p>
        <p className="text-xs text-gray-400 mb-5">Top vendors by application count</p>
        {vendorData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No vendor data</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vendorData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
              <RTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="clients" name="Clients" fill="#e0e7ff" radius={[4,4,0,0]} />
              <Bar dataKey="apps" name={isBL ? 'Bank Loans' : 'Subsidies'} fill={isBL ? '#3b82f6' : '#10b981'} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
