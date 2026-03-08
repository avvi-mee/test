"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Clock,
  FileText, Package, Plus, CheckCircle, ArrowRight, Download,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useFinance } from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { exportCSV } from "@/lib/csvUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMs(d: any): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "string") { const ms = new Date(d).getTime(); return isNaN(ms) ? 0 : ms; }
  if (typeof d?.toMillis === "function") return d.toMillis();
  return 0;
}

function formatRupees(n: number): string {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

function formatDate(d: any): string {
  if (!d) return "—";
  const ms = toMs(d);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function last6MonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function sumByMonth(
  items: { createdAt: any; amount: number; paidAmount: number }[],
  monthKey: string,
  field: "amount" | "paidAmount"
): number {
  return items
    .filter((i) => {
      const ms = toMs(i.createdAt);
      if (!ms) return false;
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === monthKey;
    })
    .reduce((s, i) => s + i[field], 0);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" as const, delay },
  };
}

const GLASS: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const { invoices, vendorBills, loading, getProjectFinanceSummary } = useFinance(tenantId);
  const { projects } = useProjects(tenantId);
  const currentUser = useCurrentUser();

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = thisMonthStart;

    const totalInvoiced  = invoices.reduce((s, i) => s + i.amount, 0);
    const totalCollected = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding    = totalInvoiced - totalCollected;
    const totalExpenses  = vendorBills.reduce((s, b) => s + b.amount, 0);
    const netProfit      = totalCollected - totalExpenses;

    const thisMonthInvoiced = invoices
      .filter((i) => toMs(i.createdAt) >= thisMonthStart)
      .reduce((s, i) => s + i.amount, 0);
    const lastMonthInvoiced = invoices
      .filter((i) => toMs(i.createdAt) >= lastMonthStart && toMs(i.createdAt) < lastMonthEnd)
      .reduce((s, i) => s + i.amount, 0);
    const invoicedMoM =
      lastMonthInvoiced > 0
        ? Math.round(((thisMonthInvoiced - lastMonthInvoiced) / lastMonthInvoiced) * 100)
        : null;

    const thisMonthCollected = invoices
      .filter((i) => toMs(i.updatedAt ?? i.createdAt) >= thisMonthStart && i.paidAmount > 0)
      .reduce((s, i) => s + i.paidAmount, 0);
    const lastMonthCollected = invoices
      .filter(
        (i) =>
          toMs(i.updatedAt ?? i.createdAt) >= lastMonthStart &&
          toMs(i.updatedAt ?? i.createdAt) < lastMonthEnd &&
          i.paidAmount > 0
      )
      .reduce((s, i) => s + i.paidAmount, 0);
    const collectedMoM =
      lastMonthCollected > 0
        ? Math.round(((thisMonthCollected - lastMonthCollected) / lastMonthCollected) * 100)
        : null;

    return { totalInvoiced, totalCollected, outstanding, totalExpenses, netProfit, invoicedMoM, collectedMoM };
  }, [invoices, vendorBills]);

  // ── Revenue chart (last 6 months) ───────────────────────────────────────────
  const chartData = useMemo(() => {
    const keys = last6MonthKeys();
    const invoiced  = keys.map((k) => sumByMonth(invoices, k, "amount"));
    const collected = keys.map((k) => sumByMonth(invoices, k, "paidAmount"));
    const maxVal = Math.max(...invoiced, ...collected, 1);
    return { keys, invoiced, collected, maxVal };
  }, [invoices]);

  // ── Client invoice quick-view (grouped by clientName) ───────────────────────
  const clientInvoiceGroups = useMemo(() => {
    const map = new Map<string, { overdue: number; delayed: number; received: number; total: number }>();
    for (const inv of invoices) {
      const key = inv.clientName || "Unknown";
      const prev = map.get(key) ?? { overdue: 0, delayed: 0, received: 0, total: 0 };
      const outstanding = inv.amount - inv.paidAmount;
      prev.total    += inv.amount;
      prev.received += inv.paidAmount;
      if (inv.status === "overdue")                                    prev.overdue  += outstanding;
      if (["overdue", "sent", "partial"].includes(inv.status))         prev.delayed  += outstanding;
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .map(([client, v]) => ({ client, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  // ── Vendor bill quick-view (grouped by vendorName) ───────────────────────────
  const vendorBillGroups = useMemo(() => {
    const map = new Map<string, { delayed: number; paid: number; total: number }>();
    for (const b of vendorBills) {
      const key = b.vendorName || "Unknown";
      const prev = map.get(key) ?? { delayed: 0, paid: 0, total: 0 };
      prev.total += b.amount;
      prev.paid  += b.paidAmount;
      if (b.paidAmount < b.amount) prev.delayed += (b.amount - b.paidAmount);
      map.set(key, prev);
    }
    return Array.from(map.entries())
      .map(([vendor, v]) => ({ vendor, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [vendorBills]);

  // ── Derived lists ────────────────────────────────────────────────────────────
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status !== "completed" && p.status !== "cancelled").slice(0, 8),
    [projects]
  );
  const overdueInvoices = useMemo(
    () => invoices.filter((i) => i.status === "overdue").slice(0, 5),
    [invoices]
  );
  const pendingBills = useMemo(
    () => vendorBills.filter((b) => b.status === "received" || b.status === "approved"),
    [vendorBills]
  );
  const recentPayments = useMemo(
    () =>
      invoices
        .filter((i) => i.paidAmount > 0)
        .sort((a, b) => toMs(b.updatedAt ?? b.createdAt) - toMs(a.updatedAt ?? a.createdAt))
        .slice(0, 5),
    [invoices]
  );

  if (!currentUser.loading && !currentUser.can("view_invoices")) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-base font-bold" style={{ color: "var(--fg-700)" }}>Access Denied</p>
        <p className="text-sm" style={{ color: "var(--fg-400)" }}>You don&apos;t have permission to view financial data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-xl" style={{ background: "var(--glass)" }} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--glass)" }} />)}
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: "Total Invoiced", value: kpis.totalInvoiced, mom: kpis.invoicedMoM,  color: "var(--brand)", icon: FileText   },
    { label: "Collected",      value: kpis.totalCollected, mom: kpis.collectedMoM, color: "var(--green)", icon: TrendingUp  },
    { label: "Outstanding",    value: kpis.outstanding,    mom: null,              color: "var(--amber)", icon: Clock       },
    { label: "Expenses",       value: kpis.totalExpenses,  mom: null,              color: "var(--fg-500)", icon: Package    },
    { label: "Net Profit",     value: kpis.netProfit,      mom: null,
      color: kpis.netProfit >= 0 ? "var(--green)" : "var(--red)", icon: DollarSign },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--fg-900)" }}>Finance</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-500)" }}>Revenue, expenses, and project finance overview</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div key={kpi.label} {...fadeUp(0.05 * i)} className="rounded-2xl p-4" style={GLASS}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="h-3.5 w-3.5 shrink-0" style={{ color: kpi.color }} />
              <p className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: "var(--fg-400)" }}>
                {kpi.label}
              </p>
            </div>
            <p className="text-2xl font-black tabular-nums" style={{ color: kpi.color }}>
              {formatRupees(kpi.value)}
            </p>
            {kpi.mom !== null ? (
              <div className="flex items-center gap-1 mt-1">
                {kpi.mom >= 0
                  ? <TrendingUp  className="h-3 w-3" style={{ color: "var(--green)" }} />
                  : <TrendingDown className="h-3 w-3" style={{ color: "var(--red)"   }} />}
                <span className="text-[10px] font-bold"
                  style={{ color: kpi.mom >= 0 ? "var(--green)" : "var(--red)" }}>
                  {kpi.mom >= 0 ? "+" : ""}{kpi.mom}% MoM
                </span>
              </div>
            ) : <div className="h-4 mt-1" />}
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <motion.div {...fadeUp(0.3)} className="flex flex-wrap gap-3">
        <Link href="/dashboard/finance/invoices?create=1">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand)", color: "#fff" }}>
            <Plus className="h-4 w-4" /> Raise Invoice
          </button>
        </Link>
        <Link href="/dashboard/finance/invoices">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand-bg)", color: "var(--brand)" }}>
            <CheckCircle className="h-4 w-4" /> Record Payment
          </button>
        </Link>
        <Link href="/dashboard/finance/bills?create=1">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={GLASS}>
            <Package className="h-4 w-4" style={{ color: "var(--fg-700)" }} />
            <span style={{ color: "var(--fg-700)" }}>Add Vendor Bill</span>
          </button>
        </Link>
        <Link href="/dashboard/vendors">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={GLASS}>
            <Plus className="h-4 w-4" style={{ color: "var(--fg-700)" }} />
            <span style={{ color: "var(--fg-700)" }}>Add Vendor</span>
          </button>
        </Link>
      </motion.div>

      {/* Revenue Chart */}
      <motion.div {...fadeUp(0.35)} className="rounded-2xl p-6" style={GLASS}>
        <h2 className="text-sm font-bold mb-5" style={{ color: "var(--fg-700)" }}>Revenue — Last 6 Months</h2>
        <div className="flex items-end gap-2 h-36">
          {chartData.keys.map((key, i) => {
            const invH  = (chartData.invoiced[i]  / chartData.maxVal) * 100;
            const colH  = (chartData.collected[i] / chartData.maxVal) * 100;
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end gap-0.5 h-28">
                  <div className="flex-1 rounded-t transition-all duration-700 min-h-[2px]"
                    style={{ height: `${invH}%`, background: "var(--brand)", opacity: 0.4 }}
                    title={`Invoiced: ${formatRupees(chartData.invoiced[i])}`} />
                  <div className="flex-1 rounded-t transition-all duration-700 min-h-[2px]"
                    style={{ height: `${colH}%`, background: "var(--green)", opacity: 0.85 }}
                    title={`Collected: ${formatRupees(chartData.collected[i])}`} />
                </div>
                <span className="text-[9px] font-bold" style={{ color: "var(--fg-400)" }}>{monthLabel(key)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-5 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--brand)", opacity: 0.4 }} />
            <span className="text-[10px]" style={{ color: "var(--fg-500)" }}>Invoiced</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--green)", opacity: 0.85 }} />
            <span className="text-[10px]" style={{ color: "var(--fg-500)" }}>Collected</span>
          </div>
        </div>
      </motion.div>

      {/* Active Projects Table */}
      <motion.div {...fadeUp(0.4)} className="rounded-2xl overflow-hidden" style={GLASS}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "var(--glass-border-in)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Active Projects — Financial Status</h2>
        </div>
        {activeProjects.length === 0 ? (
          <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--fg-400)" }}>No active projects</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                  {["Project", "Budget", "Invoiced", "Collected", "Outstanding", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-widest"
                      style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeProjects.map((p) => {
                  const pf = getProjectFinanceSummary(p.id);
                  const hasOut = pf.outstanding > 0;
                  return (
                    <tr key={p.id} className="text-xs" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                      <td className="px-4 py-3">
                        <p className="font-semibold truncate max-w-[160px]" style={{ color: "var(--fg-900)" }}>
                          {p.projectName || p.clientName}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--fg-400)" }}>{p.clientName}</p>
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--fg-700)" }}>{formatRupees(p.totalAmount)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--brand)" }}>{formatRupees(pf.totalInvoiced)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: "var(--green)" }}>{formatRupees(pf.totalReceived)}</td>
                      <td className="px-4 py-3 font-mono" style={{ color: hasOut ? "var(--amber)" : "var(--fg-400)" }}>
                        {formatRupees(pf.outstanding)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            background: hasOut ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)",
                            color: hasOut ? "var(--amber)" : "var(--green)",
                          }}>
                          {hasOut ? "Outstanding" : "Clear"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Client Invoice Quick View ─────────────────────────────────────── */}
      <motion.div {...fadeUp(0.42)} className="rounded-2xl overflow-hidden" style={GLASS}>
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--glass-border-in)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Client Invoice Quick View</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--fg-400)" }}>Total Clients: {clientInvoiceGroups.length}</p>
          </div>
          <button
            onClick={() => exportCSV(clientInvoiceGroups.map((r) => ({
              Client: r.client,
              "Overdue (₹)": r.overdue,
              "Delayed (₹)": r.delayed,
              "Received (₹)": r.received,
              "Grand Total (₹)": r.total,
            })), "client-invoice-quick-view")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        {clientInvoiceGroups.length === 0 ? (
          <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--fg-400)" }}>No client invoices yet</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-x" style={{ borderColor: "var(--glass-border-in)" }}>
            {/* Left: Coming up for receipt (overdue) */}
            <div>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--glass-border-in)", background: "rgba(220,38,38,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--red)" }}>Client Invoices Coming up for Receipt</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                      {["Client", "Overdue", "Grand Total"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold uppercase tracking-widest"
                          style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoiceGroups.map((r) => (
                      <tr key={r.client} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <td className="px-4 py-2.5 font-medium truncate max-w-[160px]" style={{ color: "var(--fg-900)" }}>{r.client}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: r.overdue > 0 ? "var(--red)" : "var(--fg-400)" }}>{formatRupees(r.overdue)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: "var(--fg-700)" }}>{formatRupees(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Right: Invoice status */}
            <div>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--glass-border-in)", background: "rgba(8,145,178,0.05)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--brand)" }}>Client Invoice Status</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                      {["Client", "Delayed", "Received", "Grand Total"].map((h) => (
                        <th key={h} className="px-4 py-2 text-left font-bold uppercase tracking-widest"
                          style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoiceGroups.map((r) => (
                      <tr key={r.client} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <td className="px-4 py-2.5 font-medium truncate max-w-[120px]" style={{ color: "var(--fg-900)" }}>{r.client}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: r.delayed > 0 ? "var(--amber)" : "var(--fg-400)" }}>{formatRupees(r.delayed)}</td>
                        <td className="px-4 py-2.5 font-mono" style={{ color: "var(--green)" }}>{formatRupees(r.received)}</td>
                        <td className="px-4 py-2.5 font-mono font-bold" style={{ color: "var(--fg-700)" }}>{formatRupees(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Vendor Invoice Quick View ─────────────────────────────────────── */}
      <motion.div {...fadeUp(0.44)} className="rounded-2xl overflow-hidden" style={GLASS}>
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--glass-border-in)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Vendor Invoice Status</h2>
          <button
            onClick={() => exportCSV(vendorBillGroups.map((r) => ({
              Vendor: r.vendor,
              "Delayed (₹)": r.delayed,
              "Paid (₹)": r.paid,
              "Grand Total (₹)": r.total,
            })), "vendor-invoice-quick-view")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        {vendorBillGroups.length === 0 ? (
          <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--fg-400)" }}>No vendor bills yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                  {["Vendor", "Delayed", "Paid", "Grand Total"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-widest"
                      style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendorBillGroups.map((r) => (
                  <tr key={r.vendor} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]" style={{ color: "var(--fg-900)" }}>{r.vendor}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: r.delayed > 0 ? "var(--amber)" : "var(--fg-400)" }}>{formatRupees(r.delayed)}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: "var(--green)" }}>{formatRupees(r.paid)}</td>
                    <td className="px-4 py-3 font-mono font-bold" style={{ color: "var(--fg-700)" }}>{formatRupees(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Overdue Invoices (2 cols) */}
        <motion.div {...fadeUp(0.45)} className="lg:col-span-2 rounded-2xl" style={GLASS}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--glass-border-in)" }}>
            <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Overdue Invoices</h2>
            <Link href="/dashboard/finance/invoices"
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--brand)" }}>
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {overdueInvoices.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: "var(--fg-400)" }}>No overdue invoices</p>
          ) : (
            <div>
              {overdueInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3 border-b gap-3"
                  style={{ borderColor: "var(--glass-border-in)" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "var(--fg-900)" }}>{inv.invoiceNumber}</p>
                    <p className="text-[10px]" style={{ color: "var(--fg-400)" }}>
                      {inv.clientName} · Due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black tabular-nums" style={{ color: "var(--red)" }}>
                      {formatRupees(inv.amount - inv.paidAmount)}
                    </p>
                    <p className="text-[9px]" style={{ color: "var(--fg-400)" }}>outstanding</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Pending Bills */}
          <motion.div {...fadeUp(0.5)} className="rounded-2xl" style={GLASS}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--glass-border-in)" }}>
              <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Pending Bills</h2>
              <Link href="/dashboard/finance/bills" className="text-xs font-semibold" style={{ color: "var(--brand)" }}>
                View all
              </Link>
            </div>
            <div className="px-5 py-4">
              <p className="text-2xl font-black tabular-nums"
                style={{ color: pendingBills.length > 0 ? "var(--amber)" : "var(--fg-400)" }}>
                {pendingBills.length}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--fg-500)" }}>bills need attention</p>
            </div>
            {pendingBills.slice(0, 3).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-2 border-t"
                style={{ borderColor: "var(--glass-border-in)" }}>
                <p className="text-xs truncate max-w-[120px]" style={{ color: "var(--fg-700)" }}>{b.vendorName}</p>
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--amber)" }}>
                  {formatRupees(b.amount - b.paidAmount)}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Recent Payments */}
          <motion.div {...fadeUp(0.55)} className="rounded-2xl" style={GLASS}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "var(--glass-border-in)" }}>
              <h2 className="text-sm font-bold" style={{ color: "var(--fg-700)" }}>Recent Payments</h2>
            </div>
            {recentPayments.length === 0 ? (
              <p className="px-5 py-4 text-xs" style={{ color: "var(--fg-400)" }}>No payments recorded yet</p>
            ) : (
              recentPayments.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-2.5 border-b gap-2"
                  style={{ borderColor: "var(--glass-border-in)" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: "var(--fg-900)" }}>{inv.invoiceNumber}</p>
                    <p className="text-[9px]" style={{ color: "var(--fg-400)" }}>{inv.clientName}</p>
                  </div>
                  <p className="text-xs font-bold tabular-nums shrink-0" style={{ color: "var(--green)" }}>
                    {formatRupees(inv.paidAmount)}
                  </p>
                </div>
              ))
            )}
          </motion.div>

        </div>
      </div>
    </div>
  );
}
