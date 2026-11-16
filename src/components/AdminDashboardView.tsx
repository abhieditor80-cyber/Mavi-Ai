import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  MaviFeatureFlags,
  PaymentDTO,
  SubscriptionPlanDTO,
} from '../types/mavi';
import { formatFileSize, formatInr } from '../utils/chatLogic';

interface AdminProviderRow {
  id: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  defaultModel: string;
  healthStatus: string;
  totalRequests: number;
  totalErrors: number;
  totalTokens: number;
  lastError: string | null;
}

interface AdminUserRow {
  id: number;
  email: string;
  displayName: string;
  role: string;
  planId: string;
  subscriptionStatus: string;
}

interface AdminOverviewData {
  metrics: {
    totalUsers: number;
    activePaidSubscribers: number;
    inactiveSubscribers: number;
    cancelledSubscribers: number;
    monthlyRevenueInr: number;
    totalStorageBytes: number;
    totalRequests: number;
    totalErrors: number;
    totalTokens: number;
  };
  users: AdminUserRow[];
  plans: SubscriptionPlanDTO[];
  providers: AdminProviderRow[];
  payments: PaymentDTO[];
  activityLogs: Array<{
    id: number;
    category: string;
    action: string;
    detail: string;
    createdAt: string;
  }>;
}

const FEATURE_FLAG_LABELS: Array<{ key: keyof MaviFeatureFlags; label: string }> = [
  { key: 'aiTextChat', label: 'AI Text Chat' },
  { key: 'imageGeneration', label: 'Image & SVG Studio' },
  { key: 'voiceChat', label: 'Voice Input' },
  { key: 'aiResearch', label: 'Deep Research' },
  { key: 'webSearch', label: 'Web Search' },
  { key: 'pdfAnalysis', label: 'PDF Analysis' },
  { key: 'codingAssistant', label: 'Coding Assistant' },
  { key: 'studyAssistant', label: 'Study Assistant' },
  { key: 'diagramGeneration', label: 'Diagram Generation' },
  { key: 'writingAssistant', label: 'Writing Assistant' },
  { key: 'dataAnalysis', label: 'Data Analysis' },
  { key: 'workspaces', label: 'Projects & Workspaces' },
  { key: 'aiMemory', label: 'AI Memory' },
  { key: 'fileStorage', label: 'File Storage' },
  { key: 'multilingualTelugu', label: 'Telugu & Tenglish' },
  { key: 'customWallpapers', label: 'Custom Wallpapers' },
];

export const AdminDashboardView: React.FC = () => {
  const { account, authFetch, refreshPlansAndAds } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [priceInput, setPriceInput] = useState('199');
  const [safeguardInput, setSafeguardInput] = useState('2048');
  const [savingPlan, setSavingPlan] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/overview');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Admin access required.');
      const overview = json as AdminOverviewData;
      setData(overview);
      const currentPlan = overview.plans[0];
      if (currentPlan) {
        setPriceInput(String(currentPlan.priceInr));
        setSafeguardInput(String(currentPlan.storageQuotaMb));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (account?.user.role === 'admin') {
      void loadOverview();
    }
  }, [account?.user.role, loadOverview]);

  if (!account || account.user.role !== 'admin') {
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 sm:px-8 py-12 text-center">
        <div className="p-8 rounded-[28px] bg-white/84 dark:bg-slate-800/70 border border-white/90 dark:border-white/10">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-3">
            Administrator Access Required
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2">
            Admin routes are protected by role-based access control. Sign in with an account configured in server <code className="font-mono">ADMIN_EMAILS</code> to manage pricing, feature toggles, AI providers, and subscribers.
          </p>
        </div>
      </div>
    );
  }

  const unlimitedPlan = data?.plans[0];

  const handleToggleProvider = async (p: AdminProviderRow) => {
    await authFetch(`/api/admin/providers/${encodeURIComponent(p.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !p.enabled }),
    });
    await loadOverview();
  };

  const handleSavePricingAndSafeguard = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(priceInput);
    const parsedSafeguard = Number(safeguardInput);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 1) return;

    setSavingPlan(true);
    try {
      await authFetch('/api/admin/plans/unlimited', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceInr: Math.round(parsedPrice),
          storageQuotaMb: Number.isFinite(parsedSafeguard)
            ? Math.max(128, Math.round(parsedSafeguard))
            : 2048,
        }),
      });
      await loadOverview();
      await refreshPlansAndAds();
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleFeature = async (key: keyof MaviFeatureFlags) => {
    if (!unlimitedPlan) return;
    const current = unlimitedPlan.featureFlagsJson?.[key] ?? true;
    await authFetch('/api/admin/plans/unlimited', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        featureFlagsJson: {
          [key]: !current,
        },
      }),
    });
    await loadOverview();
    await refreshPlansAndAds();
  };

  const handleChangeSubscriberStatus = async (userId: number, status: string) => {
    await authFetch(`/api/admin/users/${userId}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadOverview();
  };

  const handleRefundPayment = async (paymentId: number) => {
    await authFetch(`/api/admin/payments/${paymentId}/refund`, {
      method: 'POST',
    });
    await loadOverview();
  };

  return (
    <div className="w-full max-w-[1080px] mx-auto px-4 sm:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-sky-400">
            Role-Based Admin Console · Single-Plan Platform
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            MAVI UNLIMITED Platform Control
          </h1>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-white/10 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-800 text-xs">{error}</div>
      )}

      {data && (
        <>
          {/* Infrastructure & Subscriber KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 tabular-nums">
            <div className="p-4 rounded-2xl bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
              <p className="text-xs text-slate-500">Total Accounts</p>
              <p className="font-display text-xl font-bold mt-1">{data.metrics.totalUsers}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
              <p className="text-xs text-slate-500">MAVI Unlimited Active</p>
              <p className="font-display text-xl font-bold mt-1">
                {data.metrics.activePaidSubscribers}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
              <p className="text-xs text-slate-500">Est. Monthly Revenue</p>
              <p className="font-display text-xl font-bold mt-1">
                {formatInr(data.metrics.monthlyRevenueInr)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
              <p className="text-xs text-slate-500">Infra Requests / Errors</p>
              <p className="font-display text-xl font-bold mt-1">
                {data.metrics.totalRequests} / {data.metrics.totalErrors}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10">
              <p className="text-xs text-slate-500">Storage Consumed</p>
              <p className="font-display text-xl font-bold mt-1">
                {formatFileSize(data.metrics.totalStorageBytes)}
              </p>
            </div>
          </div>

          {/* Single-Plan Price Control & Feature Toggles */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <form
              onSubmit={handleSavePricingAndSafeguard}
              className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-4"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <h2 className="font-display text-base font-bold">
                  MAVI UNLIMITED Pricing
                </h2>
              </div>

              <div className="space-y-3 text-xs tabular-nums">
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Monthly Subscription Price (INR ₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Workspace Disk Safeguard (MB)
                  </label>
                  <input
                    type="number"
                    min={128}
                    step={128}
                    value={safeguardInput}
                    onChange={(e) => setSafeguardInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPlan}
                className="w-full py-2.5 rounded-full text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 cursor-pointer"
              >
                {savingPlan ? 'Saving...' : 'Save Plan Configuration'}
              </button>
            </form>

            <div className="lg:col-span-2 p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold">
                  Enable / Disable Platform Features
                </h2>
                <span className="text-[11px] text-slate-500">
                  Changes apply immediately across MAVI UNLIMITED
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                {FEATURE_FLAG_LABELS.map((item) => {
                  const enabled = unlimitedPlan?.featureFlagsJson?.[item.key] ?? true;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleToggleFeature(item.key)}
                      className={`px-3 py-2 rounded-xl text-left border transition-colors cursor-pointer ${
                        enabled
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/35 dark:border-emerald-500/30 dark:text-emerald-200'
                          : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-900/60 dark:border-white/10 dark:text-slate-400'
                      }`}
                    >
                      <p className="font-semibold truncate">{item.label}</p>
                      <p className="text-[10.5px] opacity-80 mt-0.5">
                        {enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* AI Providers & Infrastructure Monitoring */}
          <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <h2 className="font-display text-base font-bold">
                  AI Providers & Infrastructure Telemetry
                </h2>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {data.metrics.totalTokens.toLocaleString('en-IN')} tokens processed
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-900/[0.06] dark:border-white/10 text-slate-500">
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Default Model</th>
                    <th className="py-2 pr-4">Health</th>
                    <th className="py-2 pr-4">Requests / Errors</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
                  {data.providers.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4 font-semibold">{p.displayName}</td>
                      <td className="py-2.5 pr-4 font-mono">{p.defaultModel}</td>
                      <td className="py-2.5 pr-4 capitalize">{p.healthStatus}</td>
                      <td className="py-2.5 pr-4">
                        {p.totalRequests} / {p.totalErrors}
                      </td>
                      <td className="py-2.5 pr-4">{p.totalTokens.toLocaleString('en-IN')}</td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => handleToggleProvider(p)}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                            p.enabled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {p.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subscribers & Payments + Activity Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                <h2 className="font-display text-base font-bold">
                  Subscribers (MAVI UNLIMITED)
                </h2>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto mavi-scroll text-xs">
                {data.users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.05] dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.email}</p>
                      <p className="text-slate-500 capitalize">Role: {u.role}</p>
                    </div>
                    <select
                      value={u.subscriptionStatus}
                      onChange={(e) => handleChangeSubscriberStatus(u.id, e.target.value)}
                      aria-label={`Change MAVI UNLIMITED status for ${u.email}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 uppercase font-semibold"
                    >
                      <option value="active">ACTIVE</option>
                      <option value="inactive">INACTIVE</option>
                      <option value="cancelled">CANCELLED</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-[24px] bg-white/84 dark:bg-slate-800/65 border border-white/90 dark:border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h2 className="font-display text-base font-bold">
                  Payments & Activity Logs
                </h2>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto mavi-scroll text-xs">
                {data.payments.map((p) => (
                  <div
                    key={`pay-${p.id}`}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/[0.05] dark:border-white/10 tabular-nums"
                  >
                    <span>
                      {p.invoiceNumber} · {formatInr(p.amountInr)} ({p.status})
                    </span>
                    {p.status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => handleRefundPayment(p.id)}
                        className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 cursor-pointer"
                      >
                        Mark Refunded
                      </button>
                    )}
                  </div>
                ))}
                {data.activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="py-1.5 border-b border-slate-900/[0.04] dark:border-white/[0.05]"
                  >
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      [{log.category}] {log.action}
                    </p>
                    <p className="text-[11px] text-slate-500">{log.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
