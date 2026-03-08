"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileText, Users, IndianRupee, Flame, ChevronRight, ShoppingBag, Globe, DollarSign, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useTenantDashboard } from "@/hooks/useTenantDashboard";
import { useLeads } from "@/hooks/useLeads";
import { useFollowUps } from "@/hooks/useFollowUps";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useContracts } from "@/hooks/useContracts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

function formatRupees(n: number): string {
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
    return `₹${n}`;
}

function timeAgo(date: any): string {
    if (!date) return "";
    const d: Date = date?.toDate ? date.toDate() : new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formattedDate(): string {
    return new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
}

// ── Static data ───────────────────────────────────────────────────────────────

const STAGE_BAR: Record<string, string> = {
    new:           "#6366F1",
    contacted:     "#3B82F6",
    qualified:     "#F59E0B",
    proposal_sent: "#8B5CF6",
    negotiation:   "#EC4899",
    won:           "#10B981",
};

const STAGE_LABELS: Record<string, string> = {
    new:           "New",
    contacted:     "Contacted",
    qualified:     "Qualified",
    proposal_sent: "Proposal Sent",
    negotiation:   "Negotiation",
    won:           "Won",
};

const FOLLOWUP_EMOJI: Record<string, string> = {
    call: "📞", email: "📧", meeting: "🤝", site_visit: "🏠", whatsapp: "💬",
};

const KPI_CONFIGS = [
    { icon: Users,       bg: "var(--brand-bg)",  color: "var(--brand)" },
    { icon: Flame,       bg: "var(--brand-bg)",  color: "var(--brand)" },
    { icon: FileText,    bg: "var(--brand-bg)",  color: "var(--brand)" },
    { icon: IndianRupee, bg: "var(--brand-bg)",  color: "var(--brand)" },
];

// ── Animation helper ─────────────────────────────────────────────────────────

function fadeUp(delay = 0) {
    return {
        initial:    { opacity: 0, y: 18 },
        animate:    { opacity: 1, y: 0  },
        transition: { duration: 0.52, delay, ease: "easeOut" },
    } as const;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function DashboardSkeleton() {
    return (
        <div className="space-y-7 animate-pulse">
            <div className="space-y-2">
                <div className="h-9 w-72 rounded-2xl skeleton-shimmer" />
                <div className="h-4 w-52 rounded-xl skeleton-shimmer" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl h-[120px] skeleton-shimmer" />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="col-span-2 rounded-2xl h-[260px] skeleton-shimmer" />
                <div className="rounded-2xl h-[260px] skeleton-shimmer" />
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TenantDashboardPage() {
    const { tenant, isAuthenticated, loading: authLoading } = useTenantAuth();
    const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
    const stats = useTenantDashboard(tenantId);
    const { leads, stats: leadStats, loading: leadsLoading } = useLeads(tenantId);
    const { todayFollowUps, overdueFollowUps } = useFollowUps(tenantId);
    const { firebaseUser } = useCurrentUser();
    const { stats: contractStats } = useContracts(tenantId);
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.push("/login");
    }, [authLoading, isAuthenticated, router]);

    // Seed sample data once per session
    useEffect(() => {
        if (tenant?.id) {
            const key = `seeded-${tenant.id}`;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
            import("@/lib/seeder").then((module) => { module.checkAndSeed(tenant.id); });
        }
    }, [tenant?.id]);

    const leadMap = useMemo<Record<string, string>>(() => {
        const m: Record<string, string> = {};
        leads.forEach((l) => { m[l.id] = l.name; });
        return m;
    }, [leads]);

    if (authLoading || stats.loading) return <DashboardSkeleton />;
    if (!tenant) return null;

    const kpiData = [
        {
            label: "Total Leads",
            value: leadStats.total,
            sub: `${leadStats.new} new · ${leadStats.contacted} contacted`,
            badge: `${leadStats.conversionRate}% CVR`,
            href: "/dashboard/orders",
        },
        {
            label: "Hot Leads",
            value: leadStats.hotCount,
            sub: `${leadStats.warmCount} warm · ${leadStats.coldCount} cold`,
            href: "/dashboard/orders",
        },
        {
            label: "Total Estimates",
            value: stats.estimatesCount,
            sub: stats.pendingApprovalsCount > 0 ? `${stats.pendingApprovalsCount} pending review` : "All reviewed",
            href: "/dashboard/orders",
        },
        {
            label: "Pipeline Value",
            value: formatRupees(leadStats.totalValue),
            sub: `${leadStats.won} won · ${leadStats.lost} lost`,
            badge: `${leadStats.conversionRate}% CVR`,
            href: "/dashboard/orders",
        },
    ];

    return (
        <div className="space-y-6">

            {/* ── Header ────────────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-start justify-between gap-4"
            >
                <div>
                    <h1 className="text-[26px] font-[800] leading-tight tracking-tight" style={{ color: 'var(--fg-900)' }}>
                        {getGreeting()} 👋
                    </h1>
                    <p className="text-[13px] mt-1 font-[400]" style={{ color: 'var(--fg-400)' }}>
                        {formattedDate()}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { if (tenant.id) window.open(`/${tenant.id}`, "_blank"); }}
                        className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-[600] transition-all"
                        style={{
                            background: 'var(--glass)',
                            backdropFilter: 'var(--glass-blur)',
                            border: '1px solid var(--glass-border-in)',
                            color: 'var(--fg-700)',
                            boxShadow: 'var(--glass-shadow)',
                        }}
                    >
                        Open Website ↗
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { if (tenant.id) window.open(`/${tenant.id}/estimate`, "_blank"); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-[12px] font-[700]"
                        style={{
                            background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
                            boxShadow: '0 2px 12px var(--brand-glow)',
                        }}
                    >
                        + New Estimate
                    </motion.button>
                </div>
            </motion.div>

            {/* ── KPI Cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiData.map((kpi, i) => {
                    const cfg = KPI_CONFIGS[i];
                    const Icon = cfg.icon;
                    return (
                        <motion.div key={kpi.label} {...fadeUp(i * 0.08)}>
                            <Link href={kpi.href}>
                                <div className="kpi-card rounded-2xl p-5 cursor-pointer">
                                    {/* Icon badge */}
                                    <div
                                        className="h-9 w-9 rounded-xl flex items-center justify-center mb-3"
                                        style={{ background: cfg.bg }}
                                    >
                                        <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                                    </div>

                                    {/* Label */}
                                    <p className="text-[10px] font-[700] uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--fg-400)' }}>
                                        {kpi.label}
                                    </p>

                                    {/* Value */}
                                    <p className="text-[34px] font-[800] leading-none tabular-nums tracking-tight" style={{ color: 'var(--fg-900)' }}>
                                        {kpi.value}
                                    </p>

                                    {/* Sub */}
                                    {kpi.sub && (
                                        <p className="text-[11px] mt-1.5 font-[400]" style={{ color: 'var(--fg-500)' }}>
                                            {kpi.sub}
                                        </p>
                                    )}

                                    {/* Badge */}
                                    {kpi.badge && (
                                        <div className="mt-2.5 flex items-center gap-1" style={{ color: cfg.color }}>
                                            <TrendingUp className="h-3 w-3" />
                                            <span className="text-[11px] font-[600]">{kpi.badge}</span>
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Middle row ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Sales Pipeline */}
                <motion.div {...fadeUp(0.28)} className="col-span-2">
                    <div className="glass-panel rounded-2xl p-5 h-full">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: 'var(--fg-900)' }}>
                                    Sales Pipeline
                                </h2>
                                <p className="text-[11px] mt-0.5" style={{ color: 'var(--fg-400)' }}>
                                    {leadStats.total} total leads
                                </p>
                            </div>
                            <Link
                                href="/dashboard/orders"
                                className="text-[12px] font-[600] flex items-center gap-1 transition-all"
                                style={{ color: 'var(--brand)' }}
                            >
                                View all <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                        <div className="space-y-3.5">
                            {(["new", "contacted", "qualified", "proposal_sent", "negotiation", "won"] as const).map((stage, idx) => {
                                const count = leadStats[stage] ?? 0;
                                const pct = leadStats.total > 0 ? (count / leadStats.total) * 100 : 0;
                                return (
                                    <Link key={stage} href="/dashboard/orders" className="block group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[12px] w-28 shrink-0 font-[500]" style={{ color: 'var(--fg-500)' }}>
                                                {STAGE_LABELS[stage]}
                                            </span>
                                            <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'var(--glass-border-in)' }}>
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${pct}%` }}
                                                    transition={{ duration: 0.8, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                                    className="h-full rounded-full"
                                                    style={{ background: STAGE_BAR[stage] }}
                                                />
                                            </div>
                                            <span className="text-[12px] font-[700] w-6 text-right shrink-0 tabular-nums" style={{ color: 'var(--fg-900)' }}>
                                                {count}
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>

                {/* Follow-ups */}
                <motion.div {...fadeUp(0.36)}>
                    <div className="glass-panel rounded-2xl p-5 h-full">
                        <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4" style={{ color: 'var(--fg-900)' }}>
                            Today&apos;s Follow-ups
                        </h2>
                        {overdueFollowUps.length === 0 && todayFollowUps.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                                <div className="text-4xl">✅</div>
                                <p className="text-[13px] font-[500]" style={{ color: 'var(--fg-400)' }}>
                                    All clear! No follow-ups pending.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {overdueFollowUps.map((f) => (
                                    <motion.div
                                        key={f.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                                        style={{ background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.15)' }}
                                    >
                                        <span className="text-base">{FOLLOWUP_EMOJI[f.type] ?? "📋"}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-[600] truncate" style={{ color: 'var(--red)' }}>
                                                {leadMap[f.leadId] ?? "Lead"}
                                            </p>
                                            <p className="text-[10px] mt-px" style={{ color: 'var(--fg-500)' }}>{timeAgo(f.scheduledAt)} · Overdue</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {todayFollowUps.map((f) => (
                                    <motion.div
                                        key={f.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                                        style={{ background: 'var(--amber-bg)', border: '1px solid rgba(217,119,6,0.15)' }}
                                    >
                                        <span className="text-base">{FOLLOWUP_EMOJI[f.type] ?? "📋"}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-[600] truncate" style={{ color: 'var(--amber)' }}>
                                                {leadMap[f.leadId] ?? "Lead"}
                                            </p>
                                            <p className="text-[10px] mt-px" style={{ color: 'var(--fg-500)' }}>Today · {f.type}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* ── Recent Leads ──────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.35, ease: "easeOut" }}
            >
                <div className="glass-panel rounded-2xl overflow-hidden">
                    <div
                        className="flex items-center justify-between px-5 py-4"
                        style={{ borderBottom: '1px solid var(--glass-border-in)' }}
                    >
                        <div>
                            <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: 'var(--fg-900)' }}>
                                Recent Leads
                            </h2>
                            <p className="text-[11px] mt-px" style={{ color: 'var(--fg-400)' }}>
                                Latest activity across your pipeline
                            </p>
                        </div>
                        <Link href="/dashboard/orders" className="text-[12px] font-[600] flex items-center gap-1" style={{ color: 'var(--brand)' }}>
                            View all <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    {leads.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                            <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-bg)' }}>
                                <Users className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                            </div>
                            <p className="text-[13px]" style={{ color: 'var(--fg-500)' }}>No leads yet</p>
                            <a
                                href={`/${tenant.id}/estimate`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] font-[600] hover:underline"
                                style={{ color: 'var(--brand)' }}
                            >
                                Share your estimate link to get your first lead ↗
                            </a>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr
                                        className="text-[10px] font-[700] uppercase tracking-widest"
                                        style={{ borderBottom: '1px solid var(--glass-border-in)', color: 'var(--fg-400)' }}
                                    >
                                        <th className="px-5 py-3 text-left">Client</th>
                                        <th className="px-4 py-3 text-left hidden md:table-cell">Contact</th>
                                        <th className="px-4 py-3 text-left">Stage</th>
                                        <th className="px-4 py-3 text-left hidden sm:table-cell">Heat</th>
                                        <th className="px-4 py-3 text-right hidden lg:table-cell">Value</th>
                                        <th className="px-5 py-3 text-right">When</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leads.slice(0, 8).map((lead, idx) => (
                                        <motion.tr
                                            key={lead.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className="group transition-all duration-100 cursor-pointer"
                                            style={{ borderBottom: '1px solid var(--glass-border-in)' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-border-in)' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                        style={{
                                                            background: `linear-gradient(135deg, hsl(${(idx * 47 + 180) % 360},60%,52%), hsl(${(idx * 47 + 210) % 360},60%,42%))`,
                                                        }}
                                                    >
                                                        {lead.name?.charAt(0)?.toUpperCase() ?? "?"}
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-[600]" style={{ color: 'var(--fg-900)' }}>{lead.name}</p>
                                                        {lead.city && <p className="text-[11px]" style={{ color: 'var(--fg-400)' }}>{lead.city}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 hidden md:table-cell">
                                                <p className="text-xs" style={{ color: 'var(--fg-700)' }}>{lead.phone}</p>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span
                                                    className="inline-block text-[11px] font-[600] px-2.5 py-[3px] rounded-full capitalize"
                                                    style={{
                                                        background: STAGE_BAR[lead.stage] + '18',
                                                        color: STAGE_BAR[lead.stage],
                                                    }}
                                                >
                                                    {(STAGE_LABELS[lead.stage] ?? lead.stage).replace(/_/g, " ")}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 hidden sm:table-cell">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className="h-2 w-2 rounded-full shrink-0"
                                                        style={{
                                                            background: lead.temperature === 'hot' ? 'var(--red)'
                                                                : lead.temperature === 'warm' ? 'var(--amber)'
                                                                : 'var(--brand)',
                                                        }}
                                                    />
                                                    <span className="text-[12px] capitalize" style={{ color: 'var(--fg-700)' }}>
                                                        {lead.temperature}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                                                <span className="text-[13px] font-[700] tabular-nums" style={{ color: 'var(--fg-900)' }}>
                                                    {lead.estimatedValue ? formatRupees(lead.estimatedValue) : "—"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <span className="text-[11px]" style={{ color: 'var(--fg-400)' }}>{timeAgo(lead.createdAt)}</span>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* ── Quick Actions ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Sales Pipeline", Icon: ShoppingBag, href: "/dashboard/orders",       color: "#6366F1" },
                    { label: "Website Setup",  Icon: Globe,       href: "/dashboard/website-setup", color: "#10B981" },
                    { label: "Pricing Config", Icon: DollarSign,  href: "/dashboard/pricing",        color: "#F59E0B" },
                    { label: "Employees",      Icon: Users,       href: "/dashboard/employees",      color: "#3B82F6" },
                ].map((action, i) => (
                    <motion.div key={action.href} {...fadeUp(0.55 + i * 0.07)}>
                        <Link href={action.href}>
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: action.color + '15' }}
                                    >
                                        <action.Icon className="h-4 w-4" style={{ color: action.color }} />
                                    </div>
                                    <p className="text-[13px] font-[600]" style={{ color: 'var(--fg-900)' }}>
                                        {action.label}
                                    </p>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--fg-200)' }} />
                            </motion.div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
        </div>
    );
}
