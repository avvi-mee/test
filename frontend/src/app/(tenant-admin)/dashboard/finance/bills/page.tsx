"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X, Package, CheckCircle, CreditCard, Download, Upload, Loader2 } from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useFinance } from "@/hooks/useFinance";
import { useVendors } from "@/hooks/useVendors";
import { useProjects } from "@/hooks/useProjects";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { exportCSV, parseCSV } from "@/lib/csvUtils";
import type { VendorPayment, VendorBill } from "@/lib/services/vendorBillService";

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

type FilterType = "all" | "received" | "approved" | "partial" | "paid" | "disputed";

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "received", label: "Received" },
  { key: "approved", label: "Approved" },
  { key: "partial",  label: "Partial"  },
  { key: "paid",     label: "Paid"     },
  { key: "disputed", label: "Disputed" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  received: { bg: "rgba(8,145,178,0.12)",  color: "var(--brand)" },
  approved: { bg: "rgba(245,158,11,0.12)", color: "var(--amber)" },
  partial:  { bg: "rgba(139,92,246,0.12)", color: "#8B5CF6"      },
  paid:     { bg: "rgba(22,163,74,0.12)",  color: "var(--green)" },
  disputed: { bg: "rgba(220,38,38,0.12)",  color: "var(--red)"   },
};

// ── Inner Component ───────────────────────────────────────────────────────────

function BillsInner() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id ?? null;
  const currentUser = useCurrentUser();
  const searchParams = useSearchParams();
  const { vendorBills, loading, createVendorBill, recordVendorPayment } = useFinance(tenantId);
  const { vendors } = useVendors(tenantId);
  const { projects } = useProjects(tenantId);

  // Filter
  const [filter, setFilter] = useState<FilterType>("all");

  // Add Bill drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [billForm, setBillForm] = useState({
    vendorName: "", vendorId: "", projectId: "",
    billNumber: "", amount: "", description: "",
    dueDate: "", category: "materials" as string,
  });
  const [billError, setBillError] = useState("");
  const [saving, setSaving] = useState(false);

  // Payment modal
  const [paymentBill, setPaymentBill] = useState<VendorBill | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", method: "bank_transfer" as VendorPayment["method"], reference: "",
  });
  const [paymentError, setPaymentError] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);

  // Import state
  const [importOpen, setImportOpen]   = useState(false);
  const [importRows, setImportRows]   = useState<Record<string, string>[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting]     = useState(false);

  // Open drawer when URL has ?create=1
  useEffect(() => {
    if (searchParams.get("create") === "1") setDrawerOpen(true);
  }, [searchParams]);

  // Filtered & counts
  const filtered = useMemo(() => {
    if (filter === "all") return vendorBills;
    return vendorBills.filter((b) => b.status === filter);
  }, [vendorBills, filter]);

  const counts = useMemo(() => ({
    all:      vendorBills.length,
    received: vendorBills.filter((b) => b.status === "received").length,
    approved: vendorBills.filter((b) => b.status === "approved").length,
    partial:  vendorBills.filter((b) => b.status === "partial").length,
    paid:     vendorBills.filter((b) => b.status === "paid").length,
    disputed: vendorBills.filter((b) => b.status === "disputed").length,
  }), [vendorBills]);

  function openPayment(bill: VendorBill) {
    setPaymentBill(bill);
    setPaymentForm({ amount: String(bill.amount - bill.paidAmount), method: "bank_transfer", reference: "" });
    setPaymentError("");
  }

  async function handleCreateBill() {
    if (!billForm.vendorName || !billForm.amount) {
      setBillError("Vendor name and amount are required.");
      return;
    }
    setBillError(""); setSaving(true);
    try {
      await createVendorBill({
        vendorName:  billForm.vendorName,
        vendorId:    billForm.vendorId || undefined,
        projectId:   billForm.projectId || undefined,
        billNumber:  billForm.billNumber,
        amount:      Number(billForm.amount),
        description: billForm.description,
        dueDate:     billForm.dueDate ? new Date(billForm.dueDate) : undefined,
        category:    billForm.category,
        status:      "received",
      });
      setDrawerOpen(false);
      setBillForm({ vendorName: "", vendorId: "", projectId: "", billNumber: "", amount: "", description: "", dueDate: "", category: "materials" });
    } catch (err: any) {
      setBillError(err.message || "Failed to create bill");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment() {
    if (!paymentBill) return;
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) { setPaymentError("Enter a valid amount."); return; }
    setPaymentError(""); setPayingSaving(true);
    try {
      await recordVendorPayment(paymentBill.id, {
        amount:    amt,
        paidOn:    new Date(),
        method:    paymentForm.method,
        reference: paymentForm.reference || undefined,
        createdBy: currentUser.firebaseUser?.uid,
      });
      setPaymentBill(null);
    } catch (err: any) {
      setPaymentError(err.message || "Payment failed");
    } finally {
      setPayingSaving(false);
    }
  }

  function handleExport() {
    const rows = filtered.map((b) => ({
      "Vendor":    b.vendorName || "",
      "Bill #":    b.billNumber || "",
      "Amount":    b.amount,
      "Paid":      b.paidAmount,
      "Balance":   b.amount - b.paidAmount,
      "Due Date":  b.dueDate ? new Date(toMs(b.dueDate)).toLocaleDateString("en-IN") : "",
      "Status":    b.status,
      "Category":  (b as any).category || "",
    }));
    exportCSV(rows, `vendor-bills-${new Date().toISOString().slice(0, 10)}`);
  }

  async function handleImportConfirm() {
    if (!tenantId || importRows.length === 0) return;
    setImporting(true);
    try {
      for (const row of importRows) {
        await createVendorBill({
          vendorName: row["vendorName"] || row["Vendor"]  || "",
          billNumber: row["billNumber"] || row["Bill #"]  || "",
          amount:     Number(row["amount"]     || row["Amount"]   || 0),
          paidAmount: Number(row["paidAmount"] || row["Paid"]     || 0),
          dueDate:    (row["dueDate"] || row["Due Date"]) ? new Date(row["dueDate"] || row["Due Date"]) : undefined,
          status:     (row["status"] || row["Status"] || "received") as any,
          category:   row["category"] || row["Category"] || "materials",
        });
      }
      setImportOpen(false); setImportRows([]); setImportError("");
    } catch (err: any) {
      setImportError(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (!currentUser.loading && !currentUser.can("manage_vendor_bills") && !currentUser.can("view_invoices")) {
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
          <h1 className="text-2xl font-black" style={{ color: "var(--fg-900)" }}>Vendor Bills</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-500)" }}>Track and pay vendor invoices and bills</p>
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
          <button onClick={() => { setBillError(""); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--brand)", color: "#fff" }}>
            <Plus className="h-4 w-4" /> Add Bill
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={filter === t.key ? { background: "var(--brand)", color: "#fff" } : { ...GLASS, color: "var(--fg-700)" }}>
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
          <p className="p-8 text-center text-sm" style={{ color: "var(--fg-400)" }}>Loading bills…</p>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--fg-300)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--fg-400)" }}>No bills found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                  {["Vendor", "Project", "Bill #", "Amount", "Paid", "Balance", "Due Date", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-bold uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "var(--fg-400)", fontSize: "9px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const ss      = STATUS_STYLE[b.status] ?? STATUS_STYLE.received;
                  const balance = b.amount - b.paidAmount;
                  const proj    = projects.find((p) => p.id === b.projectId);
                  return (
                    <tr key={b.id} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                      <td className="px-4 py-3 max-w-[140px] truncate font-medium" style={{ color: "var(--fg-900)" }}>
                        {b.vendorName || "—"}
                      </td>
                      <td className="px-4 py-3 max-w-[130px] truncate" style={{ color: "var(--fg-700)" }}>
                        {proj?.projectName || proj?.clientName || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--fg-700)" }}>
                        {b.billNumber || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap" style={{ color: "var(--fg-900)" }}>
                        {formatRupees(b.amount)}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ color: "var(--green)" }}>
                        {formatRupees(b.paidAmount)}
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap"
                        style={{ color: balance > 0 ? "var(--amber)" : "var(--fg-400)" }}>
                        {formatRupees(balance)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fg-500)" }}>
                        {formatDate(b.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize"
                          style={{ background: ss.bg, color: ss.color }}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(b.status === "approved" || b.status === "received" || b.status === "partial") && (
                            <button title="Record Payment"
                              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                              style={{ color: "var(--brand)" }}
                              onClick={() => openPayment(b)}>
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {b.status === "received" && (
                            <button title="Approve Bill"
                              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                              style={{ color: "var(--green)" }}
                              onClick={async () => {
                                const { getDb } = await import("@/lib/firebase");
                                const { doc: fbDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
                                const db = getDb();
                                await updateDoc(fbDoc(db, `tenants/${tenantId}/vendorBills`, b.id), {
                                  status: "approved", updatedAt: serverTimestamp(),
                                });
                              }}>
                              <CheckCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
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

      {/* ── Add Bill Drawer ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDrawerOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto"
              style={DRAWER}>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold" style={{ color: "var(--fg-900)" }}>Add Vendor Bill</h2>
                  <button onClick={() => setDrawerOpen(false)} style={{ color: "var(--fg-500)" }}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {[
                  { label: "Vendor Name *", key: "vendorName", placeholder: "e.g. ABC Tiles" },
                  { label: "Bill Number",   key: "billNumber", placeholder: "e.g. BILL-001" },
                  { label: "Amount (₹) *",  key: "amount",     placeholder: "e.g. 50000", type: "number" },
                  { label: "Due Date",      key: "dueDate",    placeholder: "", type: "date" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>{label}</label>
                    <input
                      type={type || "text"}
                      placeholder={placeholder}
                      value={(billForm as any)[key]}
                      onChange={(e) => setBillForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none focus:ring-1"
                      style={{ ...INPUT, borderColor: "var(--glass-border-in)" }}
                    />
                  </div>
                ))}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Project</label>
                  <select value={billForm.projectId}
                    onChange={(e) => setBillForm((f) => ({ ...f, projectId: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                    style={{ ...INPUT, borderColor: "var(--glass-border-in)" }}>
                    <option value="">— No project —</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName || p.clientName}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Description</label>
                  <textarea value={billForm.description}
                    onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3} placeholder="What is this bill for?"
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none resize-none"
                    style={{ ...INPUT, borderColor: "var(--glass-border-in)" }} />
                </div>

                {billError && <p className="text-xs" style={{ color: "var(--red)" }}>{billError}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setDrawerOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
                    Cancel
                  </button>
                  <button onClick={handleCreateBill} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: "var(--brand)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Add Bill"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Record Payment Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {paymentBill && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setPaymentBill(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={GLASS}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>Record Payment</h2>
                  <button onClick={() => setPaymentBill(null)} style={{ color: "var(--fg-500)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs space-y-1" style={{ color: "var(--fg-500)" }}>
                  <p className="font-semibold" style={{ color: "var(--fg-900)" }}>{paymentBill.vendorName}</p>
                  <p>Balance: <span className="font-bold" style={{ color: "var(--amber)" }}>{formatRupees(paymentBill.amount - paymentBill.paidAmount)}</span></p>
                </div>
                {[
                  { label: "Amount (₹) *", key: "amount", type: "number" },
                  { label: "Reference",    key: "reference", type: "text" },
                ].map(({ label, key, type }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>{label}</label>
                    <input type={type} value={(paymentForm as any)[key]}
                      onChange={(e) => setPaymentForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                      style={{ ...INPUT, borderColor: "var(--glass-border-in)" }} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Method</label>
                  <select value={paymentForm.method}
                    onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value as any }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                    style={{ ...INPUT, borderColor: "var(--glass-border-in)" }}>
                    {["bank_transfer","upi","cash","cheque","card"].map((m) => (
                      <option key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                {paymentError && <p className="text-xs" style={{ color: "var(--red)" }}>{paymentError}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setPaymentBill(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}>
                    Cancel
                  </button>
                  <button onClick={handleRecordPayment} disabled={payingSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ background: "var(--green)", color: "#fff", opacity: payingSaving ? 0.7 : 1 }}>
                    {payingSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Record Payment"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Import CSV Preview Modal ───────────────────────────────────────────── */}
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
                    Expected columns: vendorName, billNumber, amount, dueDate, paidAmount, status, category
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
                    {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing…</> : `Import ${importRows.length} Bill${importRows.length !== 1 ? "s" : ""}`}
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

export default function BillsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm" style={{ color: "var(--fg-400)" }}>Loading…</div>}>
      <BillsInner />
    </Suspense>
  );
}
