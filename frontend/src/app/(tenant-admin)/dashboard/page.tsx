"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    FileText, Users, IndianRupee, Flame, ChevronRight,
    ShoppingBag, Globe, DollarSign, TrendingUp, FolderKanban,
    HardHat, Calculator, AlertCircle, Briefcase,
    Phone, Mail, Home, MessageCircle, ClipboardList, CheckCircle2,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useTenantDashboard } from "@/hooks/useTenantDashboard";
import { useLeads } from "@/hooks/useLeads";
import type { Lead } from "@/hooks/useLeads";
import { useFollowUps } from "@/hooks/useFollowUps";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useContracts } from "@/hooks/useContracts";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import type { FinanceStats } from "@/hooks/useFinance";
import type { Invoice } from "@/lib/services/invoiceService";
import type { VendorBill } from "@/lib/services/vendorBillService";

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

function daysOverdue(dueDate: any): number {
    if (!dueDate) return 0;
    const d = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
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

const FOLLOWUP_ICON: Record<string, ReactNode> = {
    call: <Phone className="h-3.5 w-3.5" />, email: <Mail className="h-3.5 w-3.5" />, meeting: <Users className="h-3.5 w-3.5" />, site_visit: <Home className="h-3.5 w-3.5" />, whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
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

// ── Section divider ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <hr className="flex-1" style={{ borderColor: "var(--glass-border-in)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-400)" }}>
                {label}
            </span>
            <hr className="flex-1" style={{ borderColor: "var(--glass-border-in)" }} />
        </div>
    );
}

// ── Sales Section ─────────────────────────────────────────────────────────────

function SalesSection({
    myLeads,
    overdueFollowUps,
    todayFollowUps,
    leadStats,
}: {
    myLeads: Lead[];
    overdueFollowUps: any[];
    todayFollowUps: any[];
    leadStats: any;
}) {
    const myHot = myLeads.filter(l => l.temperature === "hot").length;
    const myValue = myLeads.reduce((s, l) => s + (l.estimatedValue || 0), 0);

    return (
        <div className="space-y-4">
            {/* KPI pills */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "My Leads", value: myLeads.length, color: "var(--brand)" },
                    { label: "Hot",       value: myHot,          color: "var(--red)" },
                    { label: "Pipeline",  value: formatRupees(myValue), color: "var(--green)" },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-card rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-[700] uppercase tracking-[0.1em] mb-1" style={{ color: "var(--fg-400)" }}>{kpi.label}</p>
                        <p className="text-[26px] font-[800] tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Follow-ups + My Leads table */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Follow-ups */}
                <div className="glass-panel rounded-2xl p-5">
                    <h3 className="text-[12px] font-[700] uppercase tracking-[0.08em] mb-3" style={{ color: "var(--fg-900)" }}>
                        Today&apos;s Follow-ups
                    </h3>
                    {overdueFollowUps.length === 0 && todayFollowUps.length === 0 ? (
                        <p className="text-[12px] py-4 text-center flex items-center justify-center gap-1" style={{ color: "var(--fg-400)" }}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> All clear!</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {overdueFollowUps.slice(0, 4).map((f: any) => (
                                <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: "var(--red-bg)", border: "1px solid rgba(220,38,38,0.15)" }}>
                                    <span className="text-sm">{FOLLOWUP_ICON[f.type] ?? <ClipboardList className="h-3.5 w-3.5" />}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-[600] truncate" style={{ color: "var(--red)" }}>Overdue</p>
                                        <p className="text-[10px]" style={{ color: "var(--fg-500)" }}>{timeAgo(f.scheduledAt)}</p>
                                    </div>
                                </div>
                            ))}
                            {todayFollowUps.slice(0, 4).map((f: any) => (
                                <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: "var(--amber-bg)", border: "1px solid rgba(217,119,6,0.15)" }}>
                                    <span className="text-sm">{FOLLOWUP_ICON[f.type] ?? <ClipboardList className="h-3.5 w-3.5" />}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-[600] truncate" style={{ color: "var(--amber)" }}>Today</p>
                                        <p className="text-[10px]" style={{ color: "var(--fg-500)" }}>{f.type}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Leads table */}
                <div className="col-span-2 glass-panel rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <h3 className="text-[12px] font-[700] uppercase tracking-[0.08em]" style={{ color: "var(--fg-900)" }}>My Leads</h3>
                        <Link href="/dashboard/orders" className="text-[11px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                            View all <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                    {myLeads.length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>No leads assigned to you yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-[10px] font-[700] uppercase tracking-widest" style={{ borderBottom: "1px solid var(--glass-border-in)", color: "var(--fg-400)" }}>
                                        <th className="px-4 py-2.5 text-left">Client</th>
                                        <th className="px-4 py-2.5 text-left">Stage</th>
                                        <th className="px-4 py-2.5 text-left hidden sm:table-cell">Heat</th>
                                        <th className="px-4 py-2.5 text-right hidden md:table-cell">Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myLeads.slice(0, 6).map((lead, idx) => (
                                        <tr
                                            key={lead.id}
                                            className="transition-all duration-100 cursor-pointer"
                                            style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                                            onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-border-in)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                                        style={{ background: `linear-gradient(135deg, hsl(${(idx * 47 + 180) % 360},60%,52%), hsl(${(idx * 47 + 210) % 360},60%,42%))` }}>
                                                        {lead.name?.charAt(0)?.toUpperCase() ?? "?"}
                                                    </div>
                                                    <p className="text-[12px] font-[600]" style={{ color: "var(--fg-900)" }}>{lead.name}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-block text-[10px] font-[600] px-2 py-[2px] rounded-full capitalize"
                                                    style={{ background: (STAGE_BAR[lead.stage] ?? "#888") + "18", color: STAGE_BAR[lead.stage] ?? "#888" }}>
                                                    {(STAGE_LABELS[lead.stage] ?? lead.stage).replace(/_/g, " ")}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 hidden sm:table-cell">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full shrink-0" style={{
                                                        background: lead.temperature === "hot" ? "var(--red)" : lead.temperature === "warm" ? "var(--amber)" : "var(--brand)",
                                                    }} />
                                                    <span className="text-[11px] capitalize" style={{ color: "var(--fg-700)" }}>{lead.temperature}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right hidden md:table-cell">
                                                <span className="text-[12px] font-[700] tabular-nums" style={{ color: "var(--fg-900)" }}>
                                                    {lead.estimatedValue ? formatRupees(lead.estimatedValue) : "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-3">
                <Link href="/dashboard/orders">
                    <button className="px-4 py-2 rounded-xl text-white text-[12px] font-[700]" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}>
                        + Add Lead
                    </button>
                </Link>
                <Link href="/dashboard/orders">
                    <button className="px-4 py-2 rounded-xl text-[12px] font-[600]"
                        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)", backdropFilter: "var(--glass-blur)" }}>
                        View Pipeline →
                    </button>
                </Link>
            </div>
        </div>
    );
}

// ── PM Section ────────────────────────────────────────────────────────────────

function PMSection({ projects }: { projects: Project[] }) {
    const today = new Date();
    const active = projects.filter(p => p.status === "in_progress").length;
    const atRisk = projects.filter(p => p.healthStatus === "at_risk" || p.healthStatus === "delayed").length;
    const behindSchedule = projects.filter(p =>
        p.status !== "completed" && p.expectedEndDate && new Date(p.expectedEndDate) < today
    ).length;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Active",          value: active,        color: "var(--brand)" },
                    { label: "At Risk",          value: atRisk,        color: "var(--amber)" },
                    { label: "Behind Schedule",  value: behindSchedule, color: "var(--red)" },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-card rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-[700] uppercase tracking-[0.1em] mb-1" style={{ color: "var(--fg-400)" }}>{kpi.label}</p>
                        <p className="text-[26px] font-[800] tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.filter(p => p.status === "in_progress").slice(0, 6).map(project => (
                    <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                        <div className="glass-card rounded-2xl p-4 cursor-pointer hover:scale-[1.01] transition-transform">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <p className="text-[13px] font-[700]" style={{ color: "var(--fg-900)" }}>
                                        {project.projectName || project.clientName}
                                    </p>
                                    <p className="text-[11px]" style={{ color: "var(--fg-400)" }}>{project.clientName}</p>
                                </div>
                                <span className="text-[10px] font-[600] px-2 py-[2px] rounded-full" style={{
                                    background: project.healthStatus === "on_track" ? "rgba(16,185,129,0.12)" : project.healthStatus === "at_risk" ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                                    color: project.healthStatus === "on_track" ? "var(--green)" : project.healthStatus === "at_risk" ? "var(--amber)" : "var(--red)",
                                }}>
                                    {project.healthStatus === "on_track" ? "On Track" : project.healthStatus === "at_risk" ? "At Risk" : "Delayed"}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--glass-border-in)" }}>
                                <div className="h-full rounded-full" style={{ width: `${project.projectProgress ?? 0}%`, background: "var(--brand)" }} />
                            </div>
                            <p className="text-[10px] mt-1 text-right" style={{ color: "var(--fg-400)" }}>{project.projectProgress ?? 0}%</p>
                        </div>
                    </Link>
                ))}
            </div>
            <Link href="/dashboard/projects" className="text-[12px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                View All Projects <ChevronRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}

// ── Designer Section ──────────────────────────────────────────────────────────

function DesignerSection({ myProjects }: { myProjects: Project[] }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-[700]" style={{ color: "var(--fg-900)" }}>
                    My Projects ({myProjects.length})
                </h3>
                <Link href="/dashboard/designer" className="text-[12px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                    Full Designer View <ChevronRight className="h-3.5 w-3.5" />
                </Link>
            </div>
            {myProjects.length === 0 ? (
                <div className="glass-panel rounded-2xl py-10 text-center">
                    <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>No projects assigned yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {myProjects.map(project => {
                        const currentPhase = project.phases?.find(ph => ph.status === "in_progress") ?? project.phases?.[0];
                        return (
                            <div key={project.id} className="glass-card rounded-2xl p-4">
                                <p className="text-[13px] font-[700] mb-0.5" style={{ color: "var(--fg-900)" }}>
                                    {project.projectName || project.clientName}
                                </p>
                                <p className="text-[11px] mb-2" style={{ color: "var(--fg-400)" }}>{project.clientName}</p>
                                {currentPhase && (
                                    <span className="inline-block text-[10px] font-[600] px-2 py-[2px] rounded-full mb-3"
                                        style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                        {currentPhase.name}
                                    </span>
                                )}
                                <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--glass-border-in)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${project.projectProgress ?? 0}%`, background: "var(--brand)" }} />
                                </div>
                                <p className="text-[10px] mb-3" style={{ color: "var(--fg-400)" }}>{project.projectProgress ?? 0}% complete</p>
                                <Link href={`/dashboard/projects/${project.id}`}>
                                    <button className="w-full text-[11px] font-[600] py-1.5 rounded-xl"
                                        style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                        Upload Files →
                                    </button>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Supervisor Section ────────────────────────────────────────────────────────

function SupervisorSection({ myProjects }: { myProjects: Project[] }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-[700]" style={{ color: "var(--fg-900)" }}>
                    My Sites ({myProjects.length})
                </h3>
                <Link href="/dashboard/supervisor" className="text-[12px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                    Full Supervisor View <ChevronRight className="h-3.5 w-3.5" />
                </Link>
            </div>
            {myProjects.length === 0 ? (
                <div className="glass-panel rounded-2xl py-10 text-center">
                    <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>No sites assigned yet.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {myProjects.map(project => {
                        const currentPhase = project.phases?.find(ph => ph.status === "in_progress") ?? project.phases?.[0];
                        return (
                            <div key={project.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[13px] font-[700]" style={{ color: "var(--fg-900)" }}>
                                        {project.projectName || project.clientName}
                                    </p>
                                    <p className="text-[11px]" style={{ color: "var(--fg-400)" }}>
                                        {project.clientCity && `${project.clientCity} · `}
                                        {currentPhase?.name ?? "—"}
                                    </p>
                                </div>
                                <Link href={`/dashboard/projects/${project.id}`}>
                                    <button className="shrink-0 text-[11px] font-[600] px-3 py-1.5 rounded-xl"
                                        style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
                                        View Site →
                                    </button>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Accountant Section ────────────────────────────────────────────────────────

function AccountantSection({
    financeStats,
    overdueInvoices,
    pendingBills,
    totalInvoiced,
    totalCollected,
}: {
    financeStats: FinanceStats;
    overdueInvoices: Invoice[];
    pendingBills: VendorBill[];
    totalInvoiced: number;
    totalCollected: number;
}) {
    return (
        <div className="space-y-4">
            {/* KPI pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Invoiced",  value: formatRupees(totalInvoiced),                color: "var(--fg-900)" },
                    { label: "Collected",        value: formatRupees(totalCollected),               color: "var(--green)" },
                    { label: "Outstanding",      value: formatRupees(financeStats.totalReceivable), color: "var(--amber)" },
                    { label: "Overdue",          value: overdueInvoices.length,                     color: "var(--red)" },
                ].map(kpi => (
                    <div key={kpi.label} className="glass-card rounded-2xl p-4 text-center">
                        <p className="text-[10px] font-[700] uppercase tracking-[0.1em] mb-1" style={{ color: "var(--fg-400)" }}>{kpi.label}</p>
                        <p className="text-[22px] font-[800] tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Overdue invoices table */}
            {overdueInvoices.length > 0 && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <h3 className="text-[12px] font-[700] uppercase tracking-[0.08em] flex items-center gap-2" style={{ color: "var(--fg-900)" }}>
                            <AlertCircle className="h-3.5 w-3.5" style={{ color: "var(--red)" }} />
                            Overdue Invoices
                        </h3>
                        <Link href="/dashboard/finance" className="text-[11px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                            View all <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-[10px] font-[700] uppercase tracking-widest" style={{ borderBottom: "1px solid var(--glass-border-in)", color: "var(--fg-400)" }}>
                                    <th className="px-4 py-2.5 text-left">Invoice</th>
                                    <th className="px-4 py-2.5 text-left">Client</th>
                                    <th className="px-4 py-2.5 text-right hidden sm:table-cell">Amount</th>
                                    <th className="px-4 py-2.5 text-right">Days Overdue</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody>
                                {overdueInvoices.slice(0, 5).map(inv => (
                                    <tr key={inv.id} className="transition-all duration-100" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] font-[600]" style={{ color: "var(--fg-900)" }}>{inv.invoiceNumber}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[12px]" style={{ color: "var(--fg-700)" }}>{inv.clientName}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                                            <span className="text-[12px] font-[700] tabular-nums" style={{ color: "var(--fg-900)" }}>{formatRupees(inv.amount - inv.paidAmount)}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="text-[11px] font-[600]" style={{ color: "var(--red)" }}>{daysOverdue(inv.dueDate)}d</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link href="/dashboard/finance" className="text-[11px] font-[600]" style={{ color: "var(--brand)" }}>View →</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pending vendor bills + Quick actions */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
                    <span className="text-[13px] font-[700] tabular-nums" style={{ color: "var(--amber)" }}>{pendingBills.length}</span>
                    <span className="text-[12px]" style={{ color: "var(--fg-700)" }}>pending vendor bills</span>
                    <Link href="/dashboard/finance" className="text-[11px] font-[600] ml-2" style={{ color: "var(--brand)" }}>View →</Link>
                </div>
                <div className="flex gap-3">
                    <Link href="/dashboard/finance">
                        <button className="px-4 py-2 rounded-xl text-white text-[12px] font-[700]" style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" }}>
                            Raise Invoice
                        </button>
                    </Link>
                    <Link href="/dashboard/finance">
                        <button className="px-4 py-2 rounded-xl text-[12px] font-[600]"
                            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)", backdropFilter: "var(--glass-blur)" }}>
                            View Finance →
                        </button>
                    </Link>
                </div>
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
    const { firebaseUser, roles, employeeId } = useCurrentUser();
    const { stats: contractStats } = useContracts(tenantId);
    const { projects } = useProjects(tenantId);
    const { stats: financeStats, invoices, vendorBills } = useFinance(tenantId);
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

    // Role booleans
    const isOwner      = roles.includes("owner") || roles.includes("admin");
    const isSales      = roles.includes("sales");
    const isDesigner   = roles.includes("designer");
    const isSupervisor = roles.includes("site_supervisor");
    const isPM         = roles.includes("project_manager");
    const isAccountant = roles.includes("accountant");

    // Role-filtered data
    const myLeads = useMemo(() =>
        employeeId ? leads.filter(l => l.assignedTo === employeeId) : [],
        [leads, employeeId]
    );
    const myDesignerProjects = useMemo(() =>
        employeeId ? projects.filter(p =>
            p.assignedDesigner === employeeId || p.team?.designerIds?.includes(employeeId)
        ) : [],
        [projects, employeeId]
    );
    const mySupervisorProjects = useMemo(() =>
        employeeId ? projects.filter(p =>
            p.assignedSupervisor === employeeId || p.team?.supervisorIds?.includes(employeeId)
        ) : [],
        [projects, employeeId]
    );
    const overdueInvoices = useMemo(() => invoices.filter(i => i.status === "overdue"), [invoices]);
    const pendingBills    = useMemo(() => vendorBills.filter(b => b.status === "received" || b.status === "approved"), [vendorBills]);
    const totalInvoiced   = useMemo(() => invoices.reduce((s, i) => s + i.amount, 0), [invoices]);
    const totalCollected  = useMemo(() => invoices.reduce((s, i) => s + i.paidAmount, 0), [invoices]);

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
                    <h1 className="text-[26px] font-[800] leading-tight tracking-tight" style={{ color: "var(--fg-900)" }}>
                        {getGreeting()} 👋
                    </h1>
                    <p className="text-[13px] mt-1 font-[400]" style={{ color: "var(--fg-400)" }}>
                        {formattedDate()}
                    </p>
                </div>
                {isOwner && (
                    <div className="flex items-center gap-2 shrink-0">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { if (tenant.id) window.open(`/${tenant.id}`, "_blank"); }}
                            className="hidden md:flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-[600] transition-all"
                            style={{
                                background: "var(--glass)",
                                backdropFilter: "var(--glass-blur)",
                                border: "1px solid var(--glass-border-in)",
                                color: "var(--fg-700)",
                                boxShadow: "var(--glass-shadow)",
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
                                background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
                                boxShadow: "0 2px 12px var(--brand-glow)",
                            }}
                        >
                            + New Estimate
                        </motion.button>
                    </div>
                )}
            </motion.div>

            {/* ── Role-gated sections ────────────────────────────────────────── */}
            <div className="space-y-8">

                {/* OWNER / ADMIN SECTION */}
                {isOwner && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {kpiData.map((kpi, i) => {
                                const cfg = KPI_CONFIGS[i];
                                const Icon = cfg.icon;
                                return (
                                    <motion.div key={kpi.label} {...fadeUp(i * 0.08)}>
                                        <Link href={kpi.href}>
                                            <div className="kpi-card rounded-2xl p-5 cursor-pointer">
                                                <div className="h-9 w-9 rounded-xl flex items-center justify-center mb-3" style={{ background: cfg.bg }}>
                                                    <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                                                </div>
                                                <p className="text-[10px] font-[700] uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--fg-400)" }}>
                                                    {kpi.label}
                                                </p>
                                                <p className="text-[34px] font-[800] leading-none tabular-nums tracking-tight" style={{ color: "var(--fg-900)" }}>
                                                    {kpi.value}
                                                </p>
                                                {kpi.sub && (
                                                    <p className="text-[11px] mt-1.5 font-[400]" style={{ color: "var(--fg-500)" }}>{kpi.sub}</p>
                                                )}
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

                        {/* Middle row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Sales Pipeline */}
                            <motion.div {...fadeUp(0.28)} className="col-span-2">
                                <div className="glass-panel rounded-2xl p-5 h-full">
                                    <div className="flex items-center justify-between mb-5">
                                        <div>
                                            <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: "var(--fg-900)" }}>
                                                Sales Pipeline
                                            </h2>
                                            <p className="text-[11px] mt-0.5" style={{ color: "var(--fg-400)" }}>
                                                {leadStats.total} total leads
                                            </p>
                                        </div>
                                        <Link href="/dashboard/orders" className="text-[12px] font-[600] flex items-center gap-1 transition-all" style={{ color: "var(--brand)" }}>
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
                                                        <span className="text-[12px] w-28 shrink-0 font-[500]" style={{ color: "var(--fg-500)" }}>
                                                            {STAGE_LABELS[stage]}
                                                        </span>
                                                        <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: "var(--glass-border-in)" }}>
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${pct}%` }}
                                                                transition={{ duration: 0.8, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                                                                className="h-full rounded-full"
                                                                style={{ background: STAGE_BAR[stage] }}
                                                            />
                                                        </div>
                                                        <span className="text-[12px] font-[700] w-6 text-right shrink-0 tabular-nums" style={{ color: "var(--fg-900)" }}>
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
                                    <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em] mb-4" style={{ color: "var(--fg-900)" }}>
                                        Today&apos;s Follow-ups
                                    </h2>
                                    {overdueFollowUps.length === 0 && todayFollowUps.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
                                            <div className="flex items-center justify-center"><CheckCircle2 className="h-10 w-10 text-emerald-500" /></div>
                                            <p className="text-[13px] font-[500]" style={{ color: "var(--fg-400)" }}>
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
                                                    style={{ background: "var(--red-bg)", border: "1px solid rgba(220,38,38,0.15)" }}
                                                >
                                                    <span className="text-base">{FOLLOWUP_ICON[f.type] ?? <ClipboardList className="h-3.5 w-3.5" />}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-[600] truncate" style={{ color: "var(--red)" }}>
                                                            {leadMap[f.leadId] ?? "Lead"}
                                                        </p>
                                                        <p className="text-[10px] mt-px" style={{ color: "var(--fg-500)" }}>{timeAgo(f.scheduledAt)} · Overdue</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                            {todayFollowUps.map((f) => (
                                                <motion.div
                                                    key={f.id}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                                                    style={{ background: "var(--amber-bg)", border: "1px solid rgba(217,119,6,0.15)" }}
                                                >
                                                    <span className="text-base">{FOLLOWUP_ICON[f.type] ?? <ClipboardList className="h-3.5 w-3.5" />}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-[600] truncate" style={{ color: "var(--amber)" }}>
                                                            {leadMap[f.leadId] ?? "Lead"}
                                                        </p>
                                                        <p className="text-[10px] mt-px" style={{ color: "var(--fg-500)" }}>Today · {f.type}</p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>

                        {/* Recent Leads */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.55, delay: 0.35, ease: "easeOut" }}
                        >
                            <div className="glass-panel rounded-2xl overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                                    <div>
                                        <h2 className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: "var(--fg-900)" }}>
                                            Recent Leads
                                        </h2>
                                        <p className="text-[11px] mt-px" style={{ color: "var(--fg-400)" }}>
                                            Latest activity across your pipeline
                                        </p>
                                    </div>
                                    <Link href="/dashboard/orders" className="text-[12px] font-[600] flex items-center gap-1" style={{ color: "var(--brand)" }}>
                                        View all <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>

                                {leads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--brand-bg)" }}>
                                            <Users className="h-5 w-5" style={{ color: "var(--brand)" }} />
                                        </div>
                                        <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>No leads yet</p>
                                        <a
                                            href={`/${tenant.id}/estimate`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[12px] font-[600] hover:underline"
                                            style={{ color: "var(--brand)" }}
                                        >
                                            Share your estimate link to get your first lead ↗
                                        </a>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-[10px] font-[700] uppercase tracking-widest" style={{ borderBottom: "1px solid var(--glass-border-in)", color: "var(--fg-400)" }}>
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
                                                        style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = "var(--glass-border-in)"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
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
                                                                    <p className="text-[13px] font-[600]" style={{ color: "var(--fg-900)" }}>{lead.name}</p>
                                                                    {lead.city && <p className="text-[11px]" style={{ color: "var(--fg-400)" }}>{lead.city}</p>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 hidden md:table-cell">
                                                            <p className="text-xs" style={{ color: "var(--fg-700)" }}>{lead.phone}</p>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <span
                                                                className="inline-block text-[11px] font-[600] px-2.5 py-[3px] rounded-full capitalize"
                                                                style={{
                                                                    background: STAGE_BAR[lead.stage] + "18",
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
                                                                        background: lead.temperature === "hot" ? "var(--red)"
                                                                            : lead.temperature === "warm" ? "var(--amber)"
                                                                            : "var(--brand)",
                                                                    }}
                                                                />
                                                                <span className="text-[12px] capitalize" style={{ color: "var(--fg-700)" }}>
                                                                    {lead.temperature}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                                                            <span className="text-[13px] font-[700] tabular-nums" style={{ color: "var(--fg-900)" }}>
                                                                {lead.estimatedValue ? formatRupees(lead.estimatedValue) : "—"}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3.5 text-right">
                                                            <span className="text-[11px]" style={{ color: "var(--fg-400)" }}>{timeAgo(lead.createdAt)}</span>
                                                        </td>
                                                    </motion.tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Quick Actions */}
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
                                                <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: action.color + "15" }}>
                                                    <action.Icon className="h-4 w-4" style={{ color: action.color }} />
                                                </div>
                                                <p className="text-[13px] font-[600]" style={{ color: "var(--fg-900)" }}>{action.label}</p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--fg-200)" }} />
                                        </motion.div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </>
                )}

                {/* SALES SECTION */}
                {isSales && (
                    <>
                        {isOwner && <SectionDivider label="Sales Overview" />}
                        <SalesSection
                            myLeads={myLeads}
                            overdueFollowUps={overdueFollowUps}
                            todayFollowUps={todayFollowUps}
                            leadStats={leadStats}
                        />
                    </>
                )}

                {/* PROJECT MANAGER SECTION */}
                {isPM && !isOwner && (
                    <>
                        <SectionDivider label="Project Management" />
                        <PMSection projects={projects} />
                    </>
                )}

                {/* DESIGNER SECTION */}
                {isDesigner && (
                    <>
                        {(isOwner || isSales || isPM) && <SectionDivider label="My Design Projects" />}
                        <DesignerSection myProjects={myDesignerProjects} />
                    </>
                )}

                {/* SITE SUPERVISOR SECTION */}
                {isSupervisor && (
                    <>
                        {(isOwner || isSales || isPM || isDesigner) && <SectionDivider label="My Sites" />}
                        <SupervisorSection myProjects={mySupervisorProjects} />
                    </>
                )}

                {/* ACCOUNTANT SECTION */}
                {isAccountant && (
                    <>
                        {(isOwner || isSales || isPM || isDesigner || isSupervisor) && <SectionDivider label="Finance Overview" />}
                        <AccountantSection
                            financeStats={financeStats}
                            overdueInvoices={overdueInvoices}
                            pendingBills={pendingBills}
                            totalInvoiced={totalInvoiced}
                            totalCollected={totalCollected}
                        />
                    </>
                )}

                {/* Fallback: no role detected */}
                {!isOwner && !isSales && !isDesigner && !isSupervisor && !isPM && !isAccountant && (
                    <div className="text-center py-16">
                        <p className="text-[14px]" style={{ color: "var(--fg-500)" }}>
                            Welcome! Your dashboard is being set up.
                        </p>
                    </div>
                )}

            </div>

            {/* Bottom spacer */}
            <div className="h-4" />
        </div>
    );
}
