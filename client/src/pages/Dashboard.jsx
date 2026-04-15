import { useQuery } from '@tanstack/react-query';
import {
  Users, Landmark, HandCoins, CheckCircle2,
  FileWarning, MessageSquareWarning, TrendingUp, BarChart3,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, ResponsiveContainer,
} from 'recharts';
import {
  getDashboardSummary, getStatusDistribution,
  getVendorDistribution, getMonthlyTrend, getMyTasks,
} from '../services/dashboardService';
import useAuth from '../hooks/useAuth';
import usePageTitle from '../hooks/usePageTitle';
import Card from '../components/common/Card';
import Loader from '../components/common/Loader';
import { formatCurrency, getMonthName } from '../utils/dateFormat';
import { formatNumber } from '../utils/dateFormat';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

const StatCard = ({ icon: Icon, label, value, sub, color = 'primary' }) => {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    info: 'bg-info-50 text-info-600',
  };
  return (
    <div className="stat-card">
      <div className={`p-3 rounded-xl shrink-0 ${colorMap[color] || colorMap.primary}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const Dashboard = () => {
  usePageTitle('Dashboard');
  const { isDataEntry } = useAuth();

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => getDashboardSummary(),
    select: (res) => res.data.data,
  });

  const { data: statusDist } = useQuery({
    queryKey: ['dashboard', 'status-distribution'],
    queryFn: () => getStatusDistribution(),
    select: (res) => res.data.data,
  });

  const { data: vendorDist } = useQuery({
    queryKey: ['dashboard', 'vendor-distribution'],
    queryFn: () => getVendorDistribution(),
    select: (res) => res.data.data,
  });

  const { data: trend } = useQuery({
    queryKey: ['dashboard', 'monthly-trend'],
    queryFn: () => getMonthlyTrend(),
    select: (res) => res.data.data,
  });

  const { data: myTasks } = useQuery({
    queryKey: ['dashboard', 'my-tasks'],
    queryFn: () => getMyTasks(),
    enabled: isDataEntry,
    select: (res) => res.data.data,
  });

  if (loadingSummary) return <Loader text="Loading dashboard..." />;

  const s = summary ?? {};
  const blStatus = statusDist?.bankLoan ?? [];
  const blTrend = trend?.bankLoan ?? [];

  const trendData = blTrend.map((t) => ({
    name: `${getMonthName(t.month)} ${t.year}`,
    created: t.created,
    approved: t.approved,
  }));

  const vendorData = (vendorDist ?? []).slice(0, 8).map((v) => ({
    name: v.vendor.vendorName?.split(' ')[0] ?? 'N/A',
    clients: v.totalClients,
    applications: v.totalApplications,
  }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-gray-400">Overview of all operations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Clients" value={formatNumber(s.totalClients)} color="primary" />
        <StatCard icon={Landmark} label="Active Bank Loans" value={formatNumber(s.activeBankLoans)} color="info" />
        <StatCard icon={HandCoins} label="Active Subsidies" value={formatNumber(s.activeSubsidies)} color="success" />
        <StatCard
          icon={CheckCircle2}
          label="Completed This Month"
          value={formatNumber(s.completedThisMonth?.total)}
          sub={`${formatNumber(s.completedThisYear?.total)} this year`}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileWarning} label="Applications w/ Pending Docs" value={formatNumber(s.pendingDocumentsApplications)} color="warning" />
        <StatCard icon={MessageSquareWarning} label="Open Queries" value={formatNumber(s.openQueries)} color="danger" />
        <StatCard
          icon={TrendingUp}
          label="Vendor Clients"
          value={`${s.vendorClients?.percentage ?? 0}%`}
          sub={`${formatNumber(s.vendorClients?.count)} clients`}
          color="info"
        />
        <StatCard
          icon={BarChart3}
          label="Direct Clients"
          value={`${s.directClients?.percentage ?? 0}%`}
          sub={`${formatNumber(s.directClients?.count)} clients`}
          color="primary"
        />
      </div>

      {/* My Tasks (Data Entry) */}
      {isDataEntry && myTasks && (
        <Card header="My Assigned Tasks">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{myTasks.totalAssigned}</p>
              <p className="text-xs text-blue-500 mt-1">Total Assigned</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">{myTasks.pendingBankLoans}</p>
              <p className="text-xs text-yellow-600 mt-1">Pending Bank Loans</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{myTasks.pendingSubsidies}</p>
              <p className="text-xs text-purple-500 mt-1">Pending Subsidies</p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Status Distribution Pie */}
        <Card header="Bank Loan Status Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={blStatus.slice(0, 8)}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="count"
                nameKey="status"
                label={({ status, percent }) => `${status?.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {blStatus.slice(0, 8).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Vendor Bar Chart */}
        <Card header="Vendor-wise Client Distribution">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vendorData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="clients" name="Clients" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="applications" name="Applications" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Monthly Trend */}
      <Card header="Monthly Application Trend (Last 12 Months)">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="created" name="Created" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="approved" name="Approved" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default Dashboard;
