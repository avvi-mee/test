"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Download, Mail, CreditCard, X, FileText, Upload, Loader2,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useFinance } from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { generateInvoicePdf } from "@/lib/generateInvoicePdf";
import { exportCSV, parseCSV } from "@/lib/csvUtils";
import type { InvoiceLineItem, InvoiceType, Payment, Invoice } from "@/lib/services/invoiceService";

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
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatDate(d: any): string {
  if (!d) return "—";
  const ms = toMs(d);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const GLASS: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

const DRAWER: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  borderLeft: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

const INPUT: React.CSSProperties = {
  background: "var(--glass)",
  color: "var(--fg-900)",
  borderColor: "var(--glass-border-in)",
};

type FilterType = "all" | "draft" | "sent" | "overdue" | "paid" | "partial";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:   { bg: "rgba(148,163,184,0.15)", color: "var(--fg-400)"  },
  sent:    { bg: "rgba(8,145,178,0.12)",   color: "var(--brand)"   },
  partial: { bg: "rgba(245,158,11,0.12)",  color: "var(--amber)"   },
  paid:    { bg: "rgba(16,185,129,0.12)",  color: "var(--green)"   },
  overdue: { bg: "rgba(239,68,68,0.12)",   color: "var(--red)"     },
};

const PAYMENT_METHODS: Payment["method"][] = [
  "cash", "bank_transfer", "upi", "cheque", "card", "other",
];

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "sent",    label: "Sent"    },
  { key: "partial", label: "Partial" },
  { key: "overdue", label: "Overdue" },
  { key: "paid",    label: "Paid"    },
  { key: "draft",   label: "Draft"   },
];

// ── Inner component (uses useSearchParams) ───────────────────────────────────

function InvoicesInner() {
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const {
    invoices, loading, createInvoice, recordInvoicePayment, sendPaymentReminder,
  } = useFinance(tenantId);
  const { projects } = useProjects(tenantId);

  const [filter, setFilter]         = useState<FilterType>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paymentInv, setPaymentInv] = useState<Invoice | null>(null);

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState({
    projectId: "", clientName: "", type: "advance" as InvoiceType,
    dueDate: "", gstPercent: 18, notes: "",
  });
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: "", quantity: 1, unit: "nos", unitRate: 0, amount: 0 },
  ]);
  const [invoiceError, setInvoiceError] = useState("");
  const [saving, setSaving]             = useState(false);

  // Import state
  const [importOpen, setImportOpen]   = useState(false);
  const [importRows, setImportRows]   = useState<Record<string,string>[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting]     = useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    amount: "", method: "bank_transfer" as Payment["method"], reference: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);
  const [sendingId, setSendingId]       = useState<string | null>(null);

  // Open drawer when URL has ?create=1
  useEffect(() => {
    if (searchParams.get("create") === "1") setDrawerOpen(true);
  }, [searchParams]);

  // Line item totals
  const lineTotal   = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstAmount   = Math.round(lineTotal * invoiceForm.gstPercent) / 100;
  const totalAmount = lineTotal + gstAmount;

  // Filtered & counts
  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter((i) => i.status === filter);
  }, [invoices, filter]);

  const counts = useMemo(() => ({
    all:     invoices.length,
    draft:   invoices.filter((i) => i.status === "draft").length,
    sent:    invoices.filter((i) => i.status === "sent").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    paid:    invoices.filter((i) => i.status === "paid").length,
    partial: invoices.filter((i) => i.status === "partial").length,
  }), [invoices]);

  function updateLineItem(idx: number, field: keyof InvoiceLineItem, value: string | number) {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "quantity" || field === "unitRate") {
        item.amount = Math.round(Number(item.quantity) * Number(item.unitRate) * 100) / 100;
      }
      next[idx] = item;
      return next;
    });
  }

  async function handleCreateInvoice() {
    const hasItems = lineItems.some((i) => i.description.trim() && i.amount > 0);
    if (!invoiceForm.projectId || !invoiceForm.dueDate || !hasItems) {
      setInvoiceError("Please fill in project, line items, and due date.");
      return;
    }
    setInvoiceError("");
    setSaving(true);
    try {
      const project = projects.find((p) => p.id === invoiceForm.projectId);
      await createInvoice({
        projectId:   invoiceForm.projectId,
        clientId:    (project as any)?.customerId || "",
        clientEmail: project?.clientEmail || "",
        clientName:  invoiceForm.clientName || project?.clientName || "",
        amount:      totalAmount,
        lineItems:   lineItems.filter((i) => i.description.trim()),
        gstPercent:  invoiceForm.gstPercent,
        gstAmount,
        type:        invoiceForm.type,
        dueDate:     new Date(invoiceForm.dueDate),
        description: invoiceForm.notes || undefined,
      });
      setDrawerOpen(false);
      setInvoiceForm({ projectId: "", clientName: "", type: "advance", dueDate: "", gstPercent: 18, notes: "" });
      setLineItems([{ description: "", quantity: 1, unit: "nos", unitRate: 0, amount: 0 }]);
    } catch (err: any) {
      setInvoiceError(err.message || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  }

  function openPayment(inv: Invoice) {
    setPaymentInv(inv);
    setPaymentForm({ amount: String(inv.amount - inv.paidAmount), method: "bank_transfer", reference: "" });
    setPaymentError("");
  }

  async function handleRecordPayment() {
    if (!paymentInv) return;
    const amt = parseFloat(paymentForm.amount);
    const out = paymentInv.amount - paymentInv.paidAmount;
    if (!amt || amt <= 0)   { setPaymentError("Enter a valid amount"); return; }
    if (amt > out)          { setPaymentError(`Exceeds outstanding ${formatRupees(out)}`); return; }
    setPaymentError("");
    setPayingSaving(true);
    try {
      await recordInvoicePayment(paymentInv.id, {
        amount:    amt,
        paidOn:    new Date(),
        method:    paymentForm.method,
        reference: paymentForm.reference || undefined,
        createdBy: currentUser.firebaseUser?.uid,
      });
      setPaymentInv(null);
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed");
    } finally {
      setPayingSaving(false);
    }
  }

  async function handleSendReminder(inv: Invoice) {
    setSendingId(inv.id);
    await sendPaymentReminder({ type: "invoice", id: inv.id });
    setSendingId(null);
  }

  function handleExport() {
    const rows = filtered.map((inv) => ({
      "Invoice #":  inv.invoiceNumber,
      "Client":     inv.clientName || "",
      "Amount":     inv.amount,
      "Paid":       inv.paidAmount,
      "Balance":    inv.amount - inv.paidAmount,
      "Due Date":   inv.dueDate ? new Date(toMs(inv.dueDate)).toLocaleDateString("en-IN") : "",
      "Status":     inv.status,
      "Type":       inv.type || "",
    }));
    exportCSV(rows, `invoices-${new Date().toISOString().slice(0, 10)}`);
  }

  async function handleImportConfirm() {
    if (!tenantId || importRows.length === 0) return;
    setImporting(true);
    try {
      const { getDb } = await import("@/lib/firebase");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      const db = getDb();
      for (const row of importRows) {
        const dueDateStr = row["dueDate"] || row["Due Date"];
        const amt = Number(row["amount"] || row["Amount"] || 0);
        const paid = Number(row["paidAmount"] || row["Paid"] || 0);
        await addDoc(collection(db, `tenants/${tenantId}/invoices`), {
          tenantId,
          clientName:    row["clientName"]    || row["Client"]    || "",
          invoiceNumber: row["invoiceNumber"] || row["Invoice #"] || "",
          amount:        amt,
          paidAmount:    paid,
          balance:       amt - paid,
          dueDate:       dueDateStr ? new Date(dueDateStr).toISOString().split("T")[0] : null,
          status:        row["status"] || row["Status"] || "draft",
          type:          row["type"]   || row["Type"]   || "standard",
          projectId:     row["projectId"] || null,
          clientId:      row["clientId"] || null,
          clientEmail:   row["clientEmail"] || null,
          createdAt:     serverTimestamp(),
          updatedAt:     serverTimestamp(),
        });
      }
      setImportOpen(false);
      setImportRows([]);
      setImportError("");
    } catch (err: any) {
      setImportError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (!currentUser.loading && !currentUser.can("view_invoices")) {
    return (
      <div className="py-24 text-center">
        <p className="text-sm font-semibold" style={{ color: "var(--fg-500)" }}>Access denied</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--fg-900)" }}>Invoices</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-500)" }}>Manage, send and track client invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
            <Download className="h-4 w-4" /> Export
          </button>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold cursor-pointer"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".csv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const rows = parseCSV(ev.target?.result as string);
                if (rows.length === 0) { setImportError("No valid rows found"); return; }
                setImportRows(rows); setImportError(""); setImportOpen(true);
              };
              reader.readAsText(file); e.target.value = "";
            }} />
          </label>
          <button onClick={() => { setInvoiceError(""); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand)", color: "#fff" }}>
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={filter === t.key ? { background: "var(--brand)", color: "#fff" } : { ...GLASS, color: "var(--fg-700)" }}
          >
            {t.label}
            <span className="rounded-full text-[9px] font-black px-1.5 py-0.5"
              style={{
                background: filter === t.key ? "rgba(255,255,255,0.25)" : "rgba(148,163,184,0.18)",
                color: filter === t.key ? "#fff" : "var(--fg-500)",
              }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={GLASS}>
        {loading ? (
          <p className="p-8 text-center text-sm" style={{ color: "var(--fg-400)" }}>Loading invoices…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--fg-300)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--fg-400)" }}>No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                  {["Invoice #", "Project", "Client", "Type", "Amount", "Paid", "Balance", "Due Date", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const ss      = STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft;
                  const balance = inv.amount - inv.paidAmount;
                  const proj    = projects.find((p) => p.id === inv.projectId);
                  return (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap" style={{ color: "var(--fg-900)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 max-w-[140px] truncate" style={{ color: "var(--fg-700)" }}>
                        {proj?.projectName || proj?.clientName || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[120px] truncate" style={{ color: "var(--fg-700)" }}>
                        {inv.clientName || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize" style={{ color: "var(--fg-500)" }}>{inv.type || "—"}</td>
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap" style={{ color: "var(--fg-900)" }}>
                        {formatRupees(inv.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--green)" }}>
                        {formatRupees(inv.paidAmount)}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap"
                        style={{ color: balance > 0 ? "var(--amber)" : "var(--fg-400)" }}>
                        {formatRupees(balance)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fg-500)" }}>
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize"
                          style={{ background: ss.bg, color: ss.color }}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            title="Download PDF"
                            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                            style={{ color: "var(--fg-500)" }}
                            onClick={() => generateInvoicePdf(inv, {
                              download: true,
                              companyName: tenant?.name || "Interior Design Studio",
                            })}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {inv.status !== "paid" && (
                            <button
                              title="Record Payment"
                              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                              style={{ color: "var(--brand)" }}
                              onClick={() => openPayment(inv)}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            title="Send Reminder"
                            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                            style={{ color: sendingId === inv.id ? "var(--amber)" : "var(--fg-500)" }}
                            onClick={() => handleSendReminder(inv)}
                            disabled={sendingId === inv.id}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Invoice Drawer ──────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] overflow-y-auto"
              style={DRAWER}
            >
              {/* Drawer header */}
              <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b z-10"
                style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", borderColor: "var(--glass-border-in)" }}>
                <h2 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>New Invoice</h2>
                <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-lg hover:opacity-70"
                  style={{ color: "var(--fg-500)" }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Project *</label>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={INPUT}
                    value={invoiceForm.projectId}
                    onChange={(e) => {
                      const proj = projects.find((p) => p.id === e.target.value);
                      setInvoiceForm((f) => ({ ...f, projectId: e.target.value, clientName: proj?.clientName || "" }));
                    }}
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.projectName || p.clientName}</option>
                    ))}
                  </select>
                </div>

                {/* Client Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Client Name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={INPUT}
                    value={invoiceForm.clientName}
                    placeholder="Auto-filled from project"
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, clientName: e.target.value }))}
                  />
                </div>

                {/* Invoice Type */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Invoice Type</label>
                  <div className="flex gap-2">
                    {(["advance", "progress", "final"] as InvoiceType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setInvoiceForm((f) => ({ ...f, type: t }))}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                        style={invoiceForm.type === t
                          ? { background: "var(--brand)", color: "#fff" }
                          : { ...GLASS, color: "var(--fg-700)" }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Line Items *</label>
                  <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--glass-border-in)" }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--glass-border-in)", background: "rgba(148,163,184,0.06)" }}>
                          <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--fg-500)" }}>Description</th>
                          <th className="px-2 py-2 text-center font-semibold w-14" style={{ color: "var(--fg-500)" }}>Qty</th>
                          <th className="px-2 py-2 text-right font-semibold w-20" style={{ color: "var(--fg-500)" }}>Rate</th>
                          <th className="px-2 py-2 text-right font-semibold w-20" style={{ color: "var(--fg-500)" }}>Amt</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                            <td className="px-3 py-2">
                              <input
                                className="w-full bg-transparent text-xs outline-none"
                                style={{ color: "var(--fg-900)" }}
                                placeholder="Item description"
                                value={item.description}
                                onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min={0}
                                className="w-full bg-transparent text-xs text-center outline-none"
                                style={{ color: "var(--fg-900)" }}
                                value={item.quantity}
                                onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number" min={0}
                                className="w-full bg-transparent text-xs text-right outline-none"
                                style={{ color: "var(--fg-900)" }}
                                value={item.unitRate}
                                onChange={(e) => updateLineItem(idx, "unitRate", parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-mono whitespace-nowrap"
                              style={{ color: "var(--fg-700)" }}>
                              ₹{item.amount.toLocaleString("en-IN")}
                            </td>
                            <td className="pr-2 text-center">
                              {lineItems.length > 1 && (
                                <button
                                  onClick={() => setLineItems((p) => p.filter((_, i) => i !== idx))}
                                  className="p-0.5 rounded hover:opacity-60"
                                  style={{ color: "var(--red)" }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => setLineItems((p) => [...p, { description: "", quantity: 1, unit: "nos", unitRate: 0, amount: 0 }])}
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: "var(--brand)" }}
                  >
                    <Plus className="h-3 w-3" /> Add Row
                  </button>

                  {/* Totals */}
                  <div className="space-y-1 pt-2 border-t" style={{ borderColor: "var(--glass-border-in)" }}>
                    <div className="flex justify-between text-xs" style={{ color: "var(--fg-500)" }}>
                      <span>Subtotal</span>
                      <span className="font-mono">₹{lineTotal.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--fg-500)" }}>GST</span>
                        <input
                          type="number" min={0} max={100}
                          className="w-14 rounded-lg border px-2 py-1 text-xs text-center outline-none"
                          style={INPUT}
                          value={invoiceForm.gstPercent}
                          onChange={(e) => setInvoiceForm((f) => ({ ...f, gstPercent: parseFloat(e.target.value) || 0 }))}
                        />
                        <span className="text-xs" style={{ color: "var(--fg-500)" }}>%</span>
                      </div>
                      <span className="text-xs font-mono" style={{ color: "var(--fg-700)" }}>
                        ₹{gstAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-1 border-t"
                      style={{ borderColor: "var(--glass-border-in)" }}>
                      <span style={{ color: "var(--fg-900)" }}>Total</span>
                      <span className="font-mono" style={{ color: "var(--brand)" }}>
                        ₹{totalAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Due Date *</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={INPUT}
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Notes</label>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                    style={INPUT}
                    placeholder="Optional notes…"
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>

                {invoiceError && (
                  <p className="text-xs font-semibold" style={{ color: "var(--red)" }}>{invoiceError}</p>
                )}
              </div>

              {/* Drawer footer */}
              <div className="sticky bottom-0 flex gap-3 justify-end px-6 py-4 border-t"
                style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", borderColor: "var(--glass-border-in)" }}>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={GLASS}
                >
                  <span style={{ color: "var(--fg-700)" }}>Cancel</span>
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
                  style={{ background: "var(--brand)", color: "#fff", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Creating…" : "Create Invoice"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Record Payment Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {paymentInv && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setPaymentInv(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed z-50 w-full max-w-sm"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              <div className="rounded-2xl p-6 space-y-4" style={GLASS}>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>Record Payment</h3>
                  <button onClick={() => setPaymentInv(null)} className="p-1 rounded hover:opacity-70"
                    style={{ color: "var(--fg-400)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--fg-500)" }}>
                  {paymentInv.invoiceNumber} · Outstanding:{" "}
                  <strong style={{ color: "var(--amber)" }}>
                    {formatRupees(paymentInv.amount - paymentInv.paidAmount)}
                  </strong>
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Amount (₹)</label>
                    <input
                      type="number" min={0}
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={INPUT}
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Method</label>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={INPUT}
                      value={paymentForm.method}
                      onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as Payment["method"] }))}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Reference / UTR</label>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                      style={INPUT}
                      placeholder="Optional"
                      value={paymentForm.reference}
                      onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                    />
                  </div>
                  {paymentError && (
                    <p className="text-xs font-semibold" style={{ color: "var(--red)" }}>{paymentError}</p>
                  )}
                </div>
                <div className="flex gap-3 justify-end pt-1">
                  <button
                    onClick={() => setPaymentInv(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={GLASS}
                  >
                    <span style={{ color: "var(--fg-700)" }}>Cancel</span>
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={payingSaving}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
                    style={{ background: "var(--green)", color: "#fff", opacity: payingSaving ? 0.7 : 1 }}
                  >
                    {payingSaving ? "Saving…" : "Record Payment"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Import CSV Preview Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {importOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => setImportOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
                style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
                <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--glass-border-in)" }}>
                  <h2 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>
                    Import Preview — {importRows.length} row{importRows.length !== 1 ? "s" : ""}
                  </h2>
                  <button onClick={() => setImportOpen(false)} style={{ color: "var(--fg-500)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <p className="text-xs mb-3" style={{ color: "var(--fg-500)" }}>
                    Expected columns: clientName, invoiceNumber, amount, dueDate, paidAmount, status, type
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {Object.keys(importRows[0] ?? {}).map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-bold border"
                              style={{ borderColor: "var(--glass-border-in)", color: "var(--fg-700)", background: "var(--glass)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-3 py-2 border"
                                style={{ borderColor: "var(--glass-border-in)", color: "var(--fg-700)" }}>{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 10 && <p className="text-xs mt-2" style={{ color: "var(--fg-400)" }}>+ {importRows.length - 10} more rows</p>}
                  </div>
                  {importError && <p className="text-xs mt-2" style={{ color: "var(--red)" }}>{importError}</p>}
                </div>
                <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ borderColor: "var(--glass-border-in)" }}>
                  <button onClick={() => setImportOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
                    Cancel
                  </button>
                  <button onClick={handleImportConfirm} disabled={importing}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                    style={{ background: "var(--brand)", opacity: importing ? 0.7 : 1 }}>
                    {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</> : `Import ${importRows.length} Invoice${importRows.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}

// ── Page export (Suspense wrapper for useSearchParams) ────────────────────────

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: "var(--fg-400)" }}>Loading…</div>}>
      <InvoicesInner />
    </Suspense>
  );
}
