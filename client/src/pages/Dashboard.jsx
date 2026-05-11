import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Landmark, HandCoins, CheckCircle2, FileWarning,
  TrendingUp, AlertTriangle, Clock, ArrowUpRight, Activity,
  BarChart3, Target,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar,
} from 'recharts';
import {
  getDashboardSummary, getStatusDistribution,
  getVendorDistribution, getMonthlyTrend, getMyTasks,
} from '../services/dashboardService';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import Loader from '../components/common/Loader';
import { getMonthName, formatNumber } from '../utils/dateFormat';

// ── Palette ──────────────────────────────────────────────────────────────────
const BL_GRAD  = 'from-blue-600 to-blue-400';
const SUB_GRAD = 'from-emerald-600 to-emerald-400';
const PIE_COLORS = ['#6366f1','#3b82f6','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// ── Gradient Stat Card ────────────────────────────────────────────────────────
const GradCard = ({ icon: Icon, label, value, sub, grad, light, iconColor }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${grad} shadow-lg text-white`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium opacity-80 uppercase tracking-wider">{label}</p>
        <p className="text-3xl font-extrabold mt-1">{value ?? '—'}</p>
        {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-xl ${light}`}>
        <Icon className={`h-6 w-6 ${iconColor}`} />
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 bg-white" />
    <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
  </div>
);

// ── Flat Stat Card ────────────────────────────────────────────────────────────
const FlatCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, badge }) => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
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
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
};

// ── Custom Donut Tooltip ──────────────────────────────────────────────────────
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
  const [mode, setMode] = useState('bank-loan');

  const { data: summary, isLoading } = useQuery({ queryKey: ['dashboard','summary'],    queryFn: getDashboardSummary,      select: r => r.data.data });
  const { data: statusDist }         = useQuery({ queryKey: ['dashboard','status-dist'], queryFn: getStatusDistribution,    select: r => r.data.data });
  const { data: vendorDist }         = useQuery({ queryKey: ['dashboard','vendor-dist'], queryFn: getVendorDistribution,    select: r => r.data.data });
  const { data: trend }              = useQuery({ queryKey: ['dashboard','trend'],        queryFn: getMonthlyTrend,          select: r => r.data.data });
  const { data: myTasks }            = useQuery({ queryKey: ['dashboard','my-tasks'],    queryFn: getMyTasks, enabled: isDataEntry, select: r => r.data.data });

  if (isLoading) return <Loader text="Loading dashboard..." />;

  const s    = summary ?? {};
  const isBL = mode === 'bank-loan';
  const grad = isBL ? BL_GRAD : SUB_GRAD;
  const accent = isBL ? 'blue' : 'emerald';

  // ── Status data for donut ──────────────────────────────────────────────────
  const statusData = (isBL ? statusDist?.bankLoan : statusDist?.subsidy) ?? [];
  const totalApps  = statusData.reduce((s, d) => s + d.count, 0);

  // ── Trend area chart ───────────────────────────────────────────────────────
  const rawTrend   = (isBL ? trend?.bankLoan : trend?.subsidy) ?? [];
  const trendData  = rawTrend.map(t => ({
    month: `${getMonthName(t.month).slice(0,3)} ${String(t.year).slice(2)}`,
    Created: t.created,
    Approved: t.approved,
  }));

  // ── Vendor bar chart ───────────────────────────────────────────────────────
  const vendorData = (vendorDist ?? [])
    .filter(v => isBL ? v.bankLoanApplications > 0 : v.subsidyApplications > 0)
    .slice(0, 7)
    .map(v => ({
      name: v.vendor.vendorName?.split(' ')[0] ?? 'N/A',
      apps: isBL ? v.bankLoanApplications : v.subsidyApplications,
      clients: v.totalClients,
    }));

  // ── Summary numbers ────────────────────────────────────────────────────────
  const activeCount    = isBL ? s.activeBankLoans     : s.activeSubsidies;
  const doneMonth      = isBL ? s.completedThisMonth?.bankLoans : s.completedThisMonth?.subsidies;
  const doneYear       = isBL ? s.completedThisYear?.bankLoans  : s.completedThisYear?.subsidies;
  const successPctM    = pct(doneMonth ?? 0, activeCount ?? 1);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Real-time overview · {new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}</p>
        </div>
        {/* Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1 self-start sm:self-auto">
          {[['bank-loan','🏦  Bank Loan','blue'],['subsidy','🤝  Subsidy','emerald']].map(([key, label, col]) => (
            <button key={key} onClick={() => setMode(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === key
                  ? `bg-white shadow text-${col}-700 ring-1 ring-${col}-200`
                  : 'text-gray-500 hover:text-gray-800'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Gradient Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GradCard
          icon={isBL ? Landmark : HandCoins}
          label={isBL ? 'Active Bank Loans' : 'Active Subsidies'}
          value={formatNumber(activeCount)}
          sub={`${formatNumber(s.totalClients)} total clients`}
          grad={grad}
          light="bg-white/20"
          iconColor="text-white"
        />
        <GradCard
          icon={CheckCircle2}
          label="Completed This Month"
          value={formatNumber(doneMonth)}
          sub={`${formatNumber(doneYear)} completed this year`}
          grad={isBL ? 'from-violet-600 to-violet-400' : 'from-teal-600 to-teal-400'}
          light="bg-white/20"
          iconColor="text-white"
        />
        <GradCard
          icon={TrendingUp}
          label="Monthly Success Rate"
          value={`${successPctM}%`}
          sub="completed vs active"
          grad="from-amber-500 to-orange-400"
          light="bg-white/20"
          iconColor="text-white"
        />
        <GradCard
          icon={Users}
          label="Total Clients"
          value={formatNumber(s.totalClients)}
          sub={`${s.vendorClients?.percentage ?? 0}% via vendors`}
          grad="from-slate-700 to-slate-500"
          light="bg-white/20"
          iconColor="text-white"
        />
      </div>

      {/* ── Alert Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FlatCard
          icon={FileWarning}
          label="Pending Documents"
          value={formatNumber(s.pendingDocumentsApplications)}
          sub="applications missing docs"
          iconBg="bg-amber-50" iconColor="text-amber-600"
        />
        <FlatCard
          icon={AlertTriangle}
          label="Open Queries"
          value={formatNumber(s.openQueries)}
          sub="require follow-up"
          iconBg="bg-red-50" iconColor="text-red-600"
        />
        <FlatCard
          icon={Activity}
          label="Applications This Year"
          value={formatNumber((s.completedThisYear?.total ?? 0) + (activeCount ?? 0))}
          sub={`${pct(s.completedThisYear?.total ?? 0, (s.completedThisYear?.total ?? 0) + (activeCount ?? 0))}% completion rate`}
          iconBg={`bg-${accent}-50`} iconColor={`text-${accent}-600`}
          badge={`${pct(s.directClients?.count ?? 0, s.totalClients ?? 1)}% Direct`}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Donut – Status Distribution */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-800">Status Breakdown</p>
              <p className="text-xs text-gray-400">{isBL ? 'Bank Loan' : 'Subsidy'} · {formatNumber(totalApps)} total</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-${accent}-50 text-${accent}-700`}>
              {statusData.length} stages
            </span>
          </div>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="count" nameKey="status" paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RTooltip content={<DonutTip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend list */}
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

        {/* Pipeline progress bars */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="mb-4">
            <p className="font-semibold text-gray-800">Status Pipeline</p>
            <p className="text-xs text-gray-400">Distribution across all statuses</p>
          </div>
          <div className="space-y-3.5">
            {statusData.slice(0, 8).map((d, i) => (
              <PipelineBar
                key={d.status}
                label={d.status}
                value={d.count}
                max={statusData[0]?.count ?? 1}
                color={[
                  'bg-indigo-500','bg-blue-500','bg-sky-500','bg-emerald-500',
                  'bg-amber-500','bg-red-500','bg-violet-500','bg-pink-500',
                ][i]}
              />
            ))}
            {statusData.length === 0 && (
              <div className="flex items-center justify-center h-40 text-gray-300 text-sm">No data yet</div>
            )}
          </div>
        </div>

        {/* My Tasks (data entry) or Client Split */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="mb-4">
            <p className="font-semibold text-gray-800">{isDataEntry ? 'My Tasks' : 'Client Overview'}</p>
            <p className="text-xs text-gray-400">{isDataEntry ? 'Your assigned workload' : 'Vendor vs direct split'}</p>
          </div>
          {isDataEntry && myTasks ? (
            <div className="space-y-4">
              {[
                { label: 'Total Assigned', value: myTasks.totalAssigned, color: 'bg-blue-500', pctVal: 100 },
                { label: 'Pending Bank Loans', value: myTasks.pendingBankLoans, color: 'bg-amber-500', pctVal: pct(myTasks.pendingBankLoans, myTasks.totalAssigned) },
                { label: 'Pending Subsidies', value: myTasks.pendingSubsidies, color: 'bg-violet-500', pctVal: pct(myTasks.pendingSubsidies, myTasks.totalAssigned) },
              ].map(t => (
                <div key={t.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t.label}</span>
                    <span className="font-bold text-gray-900">{t.value}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pctVal}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-5 mt-2">
              {[
                { label: 'Vendor Clients',  value: s.vendorClients?.count, pct: s.vendorClients?.percentage, color: `bg-${accent}-500`, icon: '🏢' },
                { label: 'Direct Clients',  value: s.directClients?.count, pct: s.directClients?.percentage, color: 'bg-slate-500', icon: '👤' },
              ].map(row => (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">{row.icon} {row.label}</span>
                    <span className="font-bold text-gray-900">{formatNumber(row.value)} <span className="text-gray-400 font-normal text-xs">({row.pct}%)</span></span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.color} transition-all duration-700`} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Done/Month', val: formatNumber(doneMonth), color: `text-${accent}-600` },
                  { label: 'Done/Year',  val: formatNumber(doneYear),  color: 'text-violet-600' },
                ].map(c => (
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

      {/* ── Area Trend ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-semibold text-gray-800">Monthly Application Trend</p>
            <p className="text-xs text-gray-400">{isBL ? 'Bank Loan' : 'Subsidy'} · last 12 months</p>
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className={`inline-block w-3 h-0.5 rounded bg-${accent}-500`}/>Created</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded bg-violet-500"/>Approved</span>
          </div>
        </div>
        {trendData.length === 0 ? (
          <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No trend data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={isBL ? '#3b82f6' : '#10b981'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={isBL ? '#3b82f6' : '#10b981'} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} />
              <RTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Area type="monotone" dataKey="Created"  stroke={isBL ? '#3b82f6' : '#10b981'} strokeWidth={2.5} fill="url(#gCreated)"  dot={{ r: 3 }} />
              <Area type="monotone" dataKey="Approved" stroke="#8b5cf6"                       strokeWidth={2.5} fill="url(#gApproved)" dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Vendor Bar ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="mb-5">
          <p className="font-semibold text-gray-800">Vendor-wise {isBL ? 'Bank Loan' : 'Subsidy'} Applications</p>
          <p className="text-xs text-gray-400">Top vendors by application count</p>
        </div>
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
              <Bar dataKey="apps"    name={isBL ? 'Bank Loans' : 'Subsidies'} fill={isBL ? '#3b82f6' : '#10b981'} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
