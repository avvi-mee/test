"use client";

import { usePlatformStats } from "@/hooks/usePlatformStats";
import { useCompanies } from "@/hooks/useCompanies";
import { BarChart3, Building2, TrendingUp, Users, Activity, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
          {icon}
        </div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <p className={cn("text-3xl font-black tabular-nums", color)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformAnalyticsPage() {
  const stats = usePlatformStats();
  const { companies, loading: companiesLoading } = useCompanies();

  if (stats.loading || companiesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // Breakdown by status
  const byStatus = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  // Top tenants by subscription tier
  const bySubscription = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.subscription] = (acc[c.subscription] ?? 0) + 1;
    return acc;
  }, {});

  // Recent signups (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSignups = companies.filter(c => {
    if (!c.createdAt) return false;
    return new Date(c.createdAt) >= thirtyDaysAgo;
  });

  const growthLabel = stats.growthRate >= 0
    ? `+${stats.growthRate.toFixed(0)}% vs last month`
    : `${stats.growthRate.toFixed(0)}% vs last month`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-indigo-500" /> Platform Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time stats across all UNMATRIX tenants.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Total Tenants"
          value={stats.totalCompanies}
          sub={`${stats.companiesThisMonth} joined this month`}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Active"
          value={stats.activeCompanies}
          sub={`${stats.totalCompanies - stats.activeCompanies} pending/inactive`}
          color="text-emerald-700"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Growth Rate"
          value={`${stats.growthRate >= 0 ? "+" : ""}${stats.growthRate.toFixed(0)}%`}
          sub="vs last month"
          color={stats.growthRate >= 0 ? "text-emerald-700" : "text-red-600"}
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Last 30 Days"
          value={recentSignups.length}
          sub="new tenants"
          color="text-blue-700"
        />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Status */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">By Status</h3>
          <div className="space-y-3">
            {Object.entries(byStatus).map(([status, count]) => {
              const total = companies.length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600 capitalize">{status}</span>
                    <span className="text-xs font-bold text-gray-900">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", {
                        "bg-emerald-500": status === "active",
                        "bg-amber-400": status === "pending",
                        "bg-red-400": status === "rejected" || status === "inactive",
                      })}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Subscription */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">By Subscription Tier</h3>
          <div className="space-y-3">
            {Object.entries(bySubscription).map(([tier, count]) => {
              const total = companies.length;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-600 capitalize">{tier}</span>
                    <span className="text-xs font-bold text-gray-900">{count} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", {
                        "bg-indigo-400": tier === "enterprise",
                        "bg-blue-400": tier === "pro",
                        "bg-sky-400": tier === "basic",
                        "bg-gray-300": tier === "free",
                      })}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Tenants Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/70">
          <h3 className="text-sm font-bold text-gray-700">Recent Signups (Last 30 Days)</h3>
        </div>
        {recentSignups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No new signups in the last 30 days.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentSignups.slice(0, 20).map(company => (
              <div key={company.id} className="flex items-center gap-4 px-5 py-3">
                <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-xs shrink-0">
                  {company.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{company.name}</p>
                  <p className="text-xs text-gray-400 truncate">{company.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    company.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    company.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-500"
                  )}>
                    {company.status}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{company.subscription}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
