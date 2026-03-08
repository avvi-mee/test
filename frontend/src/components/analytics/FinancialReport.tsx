"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { useFinance } from "@/hooks/useFinance";
import { exportCSV } from "@/lib/csvUtils";

const GLASS: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

const MONTH_LABELS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

function toMs(d: any): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "string") {
    const ms = new Date(d).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  if (typeof d?.toMillis === "function") return d.toMillis();
  return 0;
}

function formatRupees(n: number): string {
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: any): string {
  if (!d) return "—";
  const ms = toMs(d);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Get current Indian FY year number (e.g. 26 for FY26)
function getCurrentFY(): number {
  const now = new Date();
  return now.getMonth() >= 3
    ? now.getFullYear() - 1999
    : now.getFullYear() - 2000;
}

// Get FY date range: fyYear=26 → Apr 1 2025 – Mar 31 2026
function getFYRange(fyYear: number): { start: Date; end: Date } {
  const startYear = 2000 + fyYear - 1;
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59),
  };
}

// Get month boundaries for month index 0-11 (0=Apr, 11=Mar)
function getMonthBounds(fyYear: number, mIdx: number): [number, number] {
  const startYear = 2000 + fyYear - 1;
  let year: number, month: number;
  if (mIdx <= 8) {
    year = startYear;
    month = mIdx + 3; // Apr(3)..Dec(11)
  } else {
    year = startYear + 1;
    month = mIdx - 9; // Jan(0)..Mar(2)
  }
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
  return [start, end];
}

// Get aging bucket label from days overdue
function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return "Current";
  if (daysOverdue <= 30) return "1-30 days";
  if (daysOverdue <= 60) return "31-60 days";
  if (daysOverdue <= 90) return "61-90 days";
  return "90+ days";
}

export default function FinancialReport({ tenantId }: { tenantId: string }) {
  const { invoices, vendorBills, loading } = useFinance(tenantId);
  const [fyYear, setFyYear] = useState(getCurrentFY());

  const fyRange = useMemo(() => getFYRange(fyYear), [fyYear]);

  // Filter invoices/bills by dueDate in the selected FY
  const fyInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        const ms = toMs(inv.dueDate);
        return ms >= fyRange.start.getTime() && ms <= fyRange.end.getTime();
      }),
    [invoices, fyRange]
  );

  const fyBills = useMemo(
    () =>
      vendorBills.filter((b) => {
        const ms = toMs(b.dueDate);
        return ms >= fyRange.start.getTime() && ms <= fyRange.end.getTime();
      }),
    [vendorBills, fyRange]
  );

  // ─── Monthly data for charts ─────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const now = Date.now();
    return MONTH_LABELS.map((label, mIdx) => {
      const [mStart, mEnd] = getMonthBounds(fyYear, mIdx);

      const mInvoices = fyInvoices.filter((i) => {
        const ms = toMs(i.dueDate);
        return ms >= mStart && ms <= mEnd;
      });
      const mBills = fyBills.filter((b) => {
        const ms = toMs(b.dueDate);
        return ms >= mStart && ms <= mEnd;
      });

      // Client outstanding = sum of (amount - paidAmount)
      const clientOutstanding = mInvoices.reduce(
        (s, i) => s + Math.max(0, i.amount - i.paidAmount),
        0
      );
      // Vendor past due = sum of (amount - paidAmount) for bills in this month
      const vendorPastDue = mBills.reduce(
        (s, b) => s + Math.max(0, b.amount - b.paidAmount),
        0
      );

      // Avg receivable days: days between createdAt (invoice date) and payment/today
      const recDays = mInvoices
        .filter((i) => toMs(i.createdAt))
        .map((i) => {
          const created = toMs(i.createdAt);
          const resolved =
            i.paidAmount >= i.amount
              ? toMs(i.updatedAt ?? i.createdAt)
              : now;
          return Math.max(0, (resolved - created) / 86400000);
        });
      const avgRecDays =
        recDays.length > 0
          ? Math.round(recDays.reduce((s, d) => s + d, 0) / recDays.length)
          : 0;

      const payDays = mBills
        .filter((b) => toMs(b.createdAt))
        .map((b) => {
          const created = toMs(b.createdAt);
          const resolved =
            b.paidAmount >= b.amount
              ? toMs(b.updatedAt ?? b.createdAt)
              : now;
          return Math.max(0, (resolved - created) / 86400000);
        });
      const avgPayDays =
        payDays.length > 0
          ? Math.round(payDays.reduce((s, d) => s + d, 0) / payDays.length)
          : 0;

      // Accrued, Due, Collected for invoices
      const accrued = fyInvoices
        .filter((i) => {
          const ms = toMs(i.createdAt);
          return ms >= mStart && ms <= mEnd;
        })
        .reduce((s, i) => s + i.amount, 0);
      const collected = mInvoices.reduce((s, i) => s + i.paidAmount, 0);
      const cei = accrued > 0 ? Math.round((collected / accrued) * 100) : 0;
      const lateReceipts = mInvoices.filter((i) => {
        const paid = toMs(i.updatedAt);
        const due = toMs(i.dueDate);
        return paid && due && paid > due && i.paidAmount >= i.amount;
      }).length;
      const avgOrderValue =
        mInvoices.length > 0
          ? Math.round(
              mInvoices.reduce((s, i) => s + i.amount, 0) / mInvoices.length
            )
          : 0;

      // Vendor metrics
      const billsAccrued = fyBills
        .filter((b) => {
          const ms = toMs(b.createdAt);
          return ms >= mStart && ms <= mEnd;
        })
        .reduce((s, b) => s + b.amount, 0);
      const billsSettled = mBills.reduce((s, b) => s + b.paidAmount, 0);
      const pei =
        billsAccrued > 0
          ? Math.round((billsSettled / billsAccrued) * 100)
          : 0;
      const latePayments = mBills.filter((b) => {
        const paid = toMs(b.updatedAt);
        const due = toMs(b.dueDate);
        return paid && due && paid > due && b.paidAmount >= b.amount;
      }).length;
      const avgCostPerInv =
        mBills.length > 0
          ? Math.round(
              mBills.reduce((s, b) => s + b.amount, 0) / mBills.length
            )
          : 0;

      return {
        label,
        clientOutstanding,
        vendorPastDue,
        avgRecDays,
        avgPayDays,
        accrued,
        collected,
        cei,
        lateReceipts,
        avgOrderValue,
        billsAccrued,
        billsSettled,
        pei,
        latePayments,
        avgCostPerInv,
        invoiceCount: mInvoices.length,
        billCount: mBills.length,
      };
    });
  }, [fyInvoices, fyBills, fyYear]);

  // YTD totals
  const ytd = useMemo(() => {
    const totalClientOutstanding = fyInvoices.reduce(
      (s, i) => s + Math.max(0, i.amount - i.paidAmount),
      0
    );
    const totalVendorPastDue = fyBills.reduce(
      (s, b) => s + Math.max(0, b.amount - b.paidAmount),
      0
    );
    const now = Date.now();
    const allRecDays = fyInvoices
      .filter((i) => toMs(i.createdAt))
      .map((i) => {
        const c = toMs(i.createdAt);
        const r =
          i.paidAmount >= i.amount
            ? toMs(i.updatedAt ?? i.createdAt)
            : now;
        return Math.max(0, (r - c) / 86400000);
      });
    const avgRecDays =
      allRecDays.length > 0
        ? Math.round(
            allRecDays.reduce((s, d) => s + d, 0) / allRecDays.length
          )
        : 0;
    const allPayDays = fyBills
      .filter((b) => toMs(b.createdAt))
      .map((b) => {
        const c = toMs(b.createdAt);
        const r =
          b.paidAmount >= b.amount
            ? toMs(b.updatedAt ?? b.createdAt)
            : now;
        return Math.max(0, (r - c) / 86400000);
      });
    const avgPayDays =
      allPayDays.length > 0
        ? Math.round(
            allPayDays.reduce((s, d) => s + d, 0) / allPayDays.length
          )
        : 0;
    return {
      totalClientOutstanding,
      totalVendorPastDue,
      avgRecDays,
      avgPayDays,
    };
  }, [fyInvoices, fyBills]);

  // Invoice register
  const invoiceRegister = useMemo(() => {
    const now = Date.now();
    return [...fyInvoices]
      .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))
      .map((inv) => {
        const dueDateMs = toMs(inv.dueDate);
        const createdMs = toMs(inv.createdAt);
        const recDays = createdMs
          ? Math.max(
              0,
              Math.round(
                ((inv.paidAmount >= inv.amount
                  ? toMs(inv.updatedAt ?? inv.createdAt)
                  : now) -
                  createdMs) /
                  86400000
              )
            )
          : 0;
        const isLate =
          dueDateMs &&
          inv.paidAmount >= inv.amount &&
          toMs(inv.updatedAt) > dueDateMs;
        const daysOverdue =
          dueDateMs && now > dueDateMs && inv.paidAmount < inv.amount
            ? Math.round((now - dueDateMs) / 86400000)
            : 0;
        const d = new Date(dueDateMs);
        return {
          inv,
          recDays,
          isLate: !!isLate,
          daysOverdue,
          month: dueDateMs
            ? d.toLocaleDateString("en-IN", { month: "short" })
            : "—",
          year: dueDateMs ? d.getFullYear() : "—",
          aging: agingBucket(daysOverdue),
        };
      });
  }, [fyInvoices]);

  const totalReceivable = fyInvoices.reduce(
    (s, i) => s + Math.max(0, i.amount - i.paidAmount),
    0
  );

  if (loading)
    return (
      <div
        className="py-12 text-center text-sm"
        style={{ color: "var(--fg-400)" }}
      >
        Loading financial data…
      </div>
    );

  const fyOptions = [23, 24, 25, 26];

  return (
    <div className="space-y-8">
      {/* FY Selector */}
      <div className="flex items-center gap-3">
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--fg-700)" }}
        >
          Financial Year:
        </span>
        <div className="flex gap-1">
          {fyOptions.map((fy) => (
            <button
              key={fy}
              onClick={() => setFyYear(fy)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={
                fyYear === fy
                  ? { background: "var(--brand)", color: "#fff" }
                  : { ...GLASS, color: "var(--fg-700)" }
              }
            >
              FY{fy}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: "var(--fg-400)" }}>
          (Apr {2000 + fyYear - 1} – Mar {2000 + fyYear})
        </span>
      </div>

      {/* Charts row: 2/3 left + 1/3 right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Calendarized charts (2/3 width) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Chart 1: Client Outstanding vs Vendor Past Due */}
          <div className="rounded-2xl p-5" style={GLASS}>
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: "var(--fg-700)" }}
            >
              Client Outstanding vs Vendor Past Due — FY{fyYear}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={monthlyData}
                margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--fg-400)" }}
                />
                <YAxis
                  tickFormatter={(v) => formatRupees(v)}
                  tick={{ fontSize: 10, fill: "var(--fg-400)" }}
                  width={60}
                />
                <Tooltip
                  formatter={(v) => formatRupees(Number(v ?? 0))}
                  contentStyle={{
                    background: "var(--glass)",
                    border: "1px solid var(--glass-border-in)",
                    borderRadius: 8,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="clientOutstanding"
                  name="Client Outstanding"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="vendorPastDue"
                  name="Vendor Past Due"
                  stroke="var(--amber)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            {/* Data table below chart */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                  >
                    <th
                      className="py-1.5 text-left font-bold uppercase"
                      style={{ color: "var(--fg-400)" }}
                    >
                      Month
                    </th>
                    {MONTH_LABELS.map((m) => (
                      <th
                        key={m}
                        className="py-1.5 text-right font-bold"
                        style={{ color: "var(--fg-400)" }}
                      >
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr
                    style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                  >
                    <td
                      className="py-1.5 text-left font-semibold"
                      style={{ color: "var(--brand)" }}
                    >
                      Client Outstanding
                    </td>
                    {monthlyData.map((m, i) => (
                      <td
                        key={i}
                        className="py-1.5 text-right tabular-nums"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {formatRupees(m.clientOutstanding)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td
                      className="py-1.5 text-left font-semibold"
                      style={{ color: "var(--amber)" }}
                    >
                      Vendor Past Due
                    </td>
                    {monthlyData.map((m, i) => (
                      <td
                        key={i}
                        className="py-1.5 text-right tabular-nums"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {formatRupees(m.vendorPastDue)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart 2: Avg Receivable vs Payable Days */}
          <div className="rounded-2xl p-5" style={GLASS}>
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: "var(--fg-700)" }}
            >
              Avg. Receivable vs Payable Days — FY{fyYear}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={monthlyData}
                margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.15)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--fg-400)" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--fg-400)" }}
                  unit=" d"
                  width={45}
                />
                <Tooltip
                  formatter={(v) => `${Number(v ?? 0)} days`}
                  contentStyle={{
                    background: "var(--glass)",
                    border: "1px solid var(--glass-border-in)",
                    borderRadius: 8,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="avgRecDays"
                  name="Avg Receivable Days"
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="avgPayDays"
                  name="Avg Payable Days"
                  stroke="var(--red)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                  >
                    <th
                      className="py-1.5 text-left font-bold uppercase"
                      style={{ color: "var(--fg-400)" }}
                    >
                      Month
                    </th>
                    {MONTH_LABELS.map((m) => (
                      <th
                        key={m}
                        className="py-1.5 text-right font-bold"
                        style={{ color: "var(--fg-400)" }}
                      >
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr
                    style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                  >
                    <td
                      className="py-1.5 text-left font-semibold"
                      style={{ color: "var(--brand)" }}
                    >
                      Avg Rec. Days
                    </td>
                    {monthlyData.map((m, i) => (
                      <td
                        key={i}
                        className="py-1.5 text-right tabular-nums"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {m.avgRecDays || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td
                      className="py-1.5 text-left font-semibold"
                      style={{ color: "var(--red)" }}
                    >
                      Avg Pay. Days
                    </td>
                    {monthlyData.map((m, i) => (
                      <td
                        key={i}
                        className="py-1.5 text-right tabular-nums"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {m.avgPayDays || "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: YTD bar charts (1/3 width) */}
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={GLASS}>
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: "var(--fg-700)" }}
            >
              YTD Outstanding
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                layout="vertical"
                data={[
                  {
                    name: "Client Receivable",
                    value: ytd.totalClientOutstanding,
                  },
                  { name: "Vendor Payable", value: ytd.totalVendorPastDue },
                ]}
                margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "var(--fg-400)" }}
                  tickFormatter={(v) => formatRupees(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--fg-700)" }}
                  width={100}
                />
                <Tooltip
                  formatter={(v) => formatRupees(Number(v ?? 0))}
                  contentStyle={{
                    background: "var(--glass)",
                    border: "1px solid var(--glass-border-in)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  fill="var(--brand)"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--fg-500)" }}>
                  Client Receivable
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: "var(--brand)" }}
                >
                  {formatRupees(ytd.totalClientOutstanding)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--fg-500)" }}>Vendor Payable</span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: "var(--amber)" }}
                >
                  {formatRupees(ytd.totalVendorPastDue)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={GLASS}>
            <h3
              className="text-sm font-bold mb-4"
              style={{ color: "var(--fg-700)" }}
            >
              YTD Avg Days
            </h3>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart
                layout="vertical"
                data={[
                  { name: "Avg Rec. Days", value: ytd.avgRecDays },
                  { name: "Avg Pay. Days", value: ytd.avgPayDays },
                ]}
                margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: "var(--fg-400)" }}
                  unit="d"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "var(--fg-700)" }}
                  width={90}
                />
                <Tooltip
                  formatter={(v) => `${Number(v ?? 0)} days`}
                  contentStyle={{
                    background: "var(--glass)",
                    border: "1px solid var(--glass-border-in)",
                    borderRadius: 8,
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  fill="var(--brand)"
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--fg-500)" }}>
                  Avg Receivable Days
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: "var(--brand)" }}
                >
                  {ytd.avgRecDays}d
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: "var(--fg-500)" }}>
                  Avg Payable Days
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: "var(--red)" }}
                >
                  {ytd.avgPayDays}d
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Metrics Table */}
      <div className="rounded-2xl overflow-hidden" style={GLASS}>
        <div
          className="px-6 py-4 border-b"
          style={{ borderColor: "var(--glass-border-in)" }}
        >
          <h3
            className="text-sm font-bold"
            style={{ color: "var(--fg-700)" }}
          >
            Monthly Metrics — FY{fyYear}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr
                style={{ borderBottom: "1px solid var(--glass-border-in)" }}
              >
                <th
                  className="px-4 py-2.5 text-left font-bold uppercase sticky left-0 z-10 w-56"
                  style={{
                    color: "var(--fg-400)",
                    background: "var(--glass)",
                    minWidth: 200,
                  }}
                >
                  Metric
                </th>
                {MONTH_LABELS.map((m) => (
                  <th
                    key={m}
                    className="px-3 py-2.5 text-right font-bold uppercase"
                    style={{ color: "var(--fg-400)", minWidth: 64 }}
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Green section: Client Receivable */}
              <tr style={{ background: "rgba(22,163,74,0.10)" }}>
                <td
                  colSpan={13}
                  className="px-4 py-2 text-[9px] font-black uppercase tracking-widest"
                  style={{ color: "var(--green)" }}
                >
                  Client Receivable Metrics
                </td>
              </tr>
              {(
                [
                  {
                    label: "Total Client Receivable Outstanding",
                    key: "clientOutstanding",
                    fmt: formatRupees,
                  },
                  {
                    label: "Avg. Receivable Days",
                    key: "avgRecDays",
                    fmt: (v: number) => (v ? `${v}d` : "—"),
                  },
                  {
                    label: "Client Receivable Accrued",
                    key: "accrued",
                    fmt: formatRupees,
                  },
                  {
                    label: "Client Receivable Due",
                    key: "clientOutstanding",
                    fmt: formatRupees,
                  },
                  {
                    label: "Client Receivable Collected",
                    key: "collected",
                    fmt: formatRupees,
                  },
                  {
                    label: "Collection Effectiveness Index",
                    key: "cei",
                    fmt: (v: number) => `${v}%`,
                  },
                  {
                    label: "No. of Late Receipts",
                    key: "lateReceipts",
                    fmt: (v: number) => String(v),
                  },
                  {
                    label: "Avg. Order Value",
                    key: "avgOrderValue",
                    fmt: formatRupees,
                  },
                ] as { label: string; key: string; fmt: (v: number) => string }[]
              ).map(({ label, key, fmt }) => (
                <tr
                  key={label}
                  style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                >
                  <td
                    className="px-4 py-2 font-medium sticky left-0 z-10 truncate max-w-[200px]"
                    style={{
                      color: "var(--fg-700)",
                      background: "var(--glass)",
                    }}
                  >
                    {label}
                  </td>
                  {monthlyData.map((m, i) => (
                    <td
                      key={i}
                      className="px-3 py-2 text-right tabular-nums"
                      style={{ color: "var(--fg-700)" }}
                    >
                      {fmt((m as unknown as Record<string, number>)[key])}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Blue section: Vendor Payable */}
              <tr style={{ background: "rgba(8,145,178,0.10)" }}>
                <td
                  colSpan={13}
                  className="px-4 py-2 text-[9px] font-black uppercase tracking-widest"
                  style={{ color: "var(--brand)" }}
                >
                  Vendor Payable Metrics
                </td>
              </tr>
              {(
                [
                  {
                    label: "Total Vendor Payable Past Due",
                    key: "vendorPastDue",
                    fmt: formatRupees,
                  },
                  {
                    label: "Avg. Payable Days",
                    key: "avgPayDays",
                    fmt: (v: number) => (v ? `${v}d` : "—"),
                  },
                  {
                    label: "Vendor Payable Accrued",
                    key: "billsAccrued",
                    fmt: formatRupees,
                  },
                  {
                    label: "Vendor Payable Due",
                    key: "vendorPastDue",
                    fmt: formatRupees,
                  },
                  {
                    label: "Vendor Payable Settled",
                    key: "billsSettled",
                    fmt: formatRupees,
                  },
                  {
                    label: "Payment Effectiveness Index",
                    key: "pei",
                    fmt: (v: number) => `${v}%`,
                  },
                  {
                    label: "No. of Late Payments",
                    key: "latePayments",
                    fmt: (v: number) => String(v),
                  },
                  {
                    label: "Avg. Cost per Invoice",
                    key: "avgCostPerInv",
                    fmt: formatRupees,
                  },
                ] as { label: string; key: string; fmt: (v: number) => string }[]
              ).map(({ label, key, fmt }) => (
                <tr
                  key={label}
                  style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                >
                  <td
                    className="px-4 py-2 font-medium sticky left-0 z-10 truncate max-w-[200px]"
                    style={{
                      color: "var(--fg-700)",
                      background: "var(--glass)",
                    }}
                  >
                    {label}
                  </td>
                  {monthlyData.map((m, i) => (
                    <td
                      key={i}
                      className="px-3 py-2 text-right tabular-nums"
                      style={{ color: "var(--fg-700)" }}
                    >
                      {fmt((m as unknown as Record<string, number>)[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Register */}
      <div className="rounded-2xl overflow-hidden" style={GLASS}>
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ borderColor: "var(--glass-border-in)" }}
        >
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: "var(--fg-700)" }}
            >
              Invoice Register — FY{fyYear}
            </h3>
            <p
              className="text-[10px] mt-0.5"
              style={{ color: "var(--fg-400)" }}
            >
              Total Amount Receivable as on{" "}
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              :{" "}
              <span
                className="font-black"
                style={{ color: "var(--brand)" }}
              >
                {formatRupees(totalReceivable)}
              </span>
            </p>
          </div>
          <button
            onClick={() =>
              exportCSV(
                invoiceRegister.map(
                  ({ inv, recDays, isLate, daysOverdue, month, year, aging }) => ({
                    "Invoice #": inv.invoiceNumber || "",
                    "Invoice Date": formatDate(inv.createdAt),
                    "Client Name": inv.clientName || "",
                    Particulars: inv.type || "",
                    "Invoice Amount": inv.amount,
                    "Due Date": formatDate(inv.dueDate),
                    Month: month,
                    Year: year,
                    "Amount Receivable": Math.max(
                      0,
                      inv.amount - inv.paidAmount
                    ),
                    Status: inv.status,
                    "Late Receipt": isLate ? "Y" : "N",
                    "Receivable Days": recDays,
                    "Invoice Ageing": aging,
                    Remarks: "",
                  })
                ),
                `invoice-register-fy${fyYear}`
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: "var(--glass)",
              border: "1px solid var(--glass-border-in)",
              color: "var(--fg-700)",
            }}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        {invoiceRegister.length === 0 ? (
          <p
            className="px-6 py-8 text-sm text-center"
            style={{ color: "var(--fg-400)" }}
          >
            No invoices with due dates in FY{fyYear}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr
                  style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                >
                  {[
                    "Invoice #",
                    "Invoice Date",
                    "Client",
                    "Particulars",
                    "Amount",
                    "Due Date",
                    "Month",
                    "Year",
                    "Receivable",
                    "Status",
                    "Late?",
                    "Rec.Days",
                    "Ageing",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-bold uppercase whitespace-nowrap"
                      style={{ color: "var(--fg-400)", fontSize: "9px" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoiceRegister.map(
                  ({ inv, recDays, isLate, daysOverdue, month, year, aging }) => (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: "1px solid var(--glass-border-in)",
                      }}
                    >
                      <td
                        className="px-3 py-2.5 font-mono font-bold whitespace-nowrap"
                        style={{ color: "var(--fg-900)" }}
                      >
                        {inv.invoiceNumber}
                      </td>
                      <td
                        className="px-3 py-2.5 whitespace-nowrap"
                        style={{ color: "var(--fg-500)" }}
                      >
                        {formatDate(inv.createdAt)}
                      </td>
                      <td
                        className="px-3 py-2.5 max-w-[100px] truncate"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {inv.clientName || "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 capitalize"
                        style={{ color: "var(--fg-500)" }}
                      >
                        {inv.type || "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono font-bold whitespace-nowrap"
                        style={{ color: "var(--fg-900)" }}
                      >
                        {formatRupees(inv.amount)}
                      </td>
                      <td
                        className="px-3 py-2.5 whitespace-nowrap"
                        style={{ color: "var(--fg-500)" }}
                      >
                        {formatDate(inv.dueDate)}
                      </td>
                      <td
                        className="px-3 py-2.5"
                        style={{ color: "var(--fg-500)" }}
                      >
                        {month}
                      </td>
                      <td
                        className="px-3 py-2.5"
                        style={{ color: "var(--fg-500)" }}
                      >
                        {year}
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono font-bold whitespace-nowrap"
                        style={{ color: "var(--brand)" }}
                      >
                        {formatRupees(Math.max(0, inv.amount - inv.paidAmount))}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="px-1.5 py-0.5 rounded-full font-bold capitalize"
                          style={{
                            background:
                              inv.status === "paid"
                                ? "rgba(22,163,74,0.12)"
                                : inv.status === "overdue"
                                ? "rgba(220,38,38,0.12)"
                                : "rgba(8,145,178,0.12)",
                            color:
                              inv.status === "paid"
                                ? "var(--green)"
                                : inv.status === "overdue"
                                ? "var(--red)"
                                : "var(--brand)",
                          }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-bold"
                        style={{
                          color: isLate ? "var(--red)" : "var(--green)",
                        }}
                      >
                        {isLate ? "Y" : "N"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center tabular-nums"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {recDays}d
                      </td>
                      <td
                        className="px-3 py-2.5 whitespace-nowrap"
                        style={{
                          color:
                            daysOverdue > 0 ? "var(--red)" : "var(--fg-400)",
                        }}
                      >
                        {aging}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
