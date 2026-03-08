"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Search, Edit, Trash2, ChevronDown, ChevronUp,
  Building2, Phone, Mail, FileText, Loader2, X,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useVendors, type Vendor, type VendorInput } from "@/hooks/useVendors";
import { useFinance } from "@/hooks/useFinance";
import { useToast } from "@/hooks/use-toast";

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ["Materials", "Labour", "Equipment", "Other"] as const;

const CATEGORY_COLOR: Record<string, string> = {
  Materials: "var(--brand)",
  Labour:    "var(--green)",
  Equipment: "var(--amber)",
  Other:     "var(--fg-400)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  if (!v) return "₹0";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

const GLASS: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

const INPUT: React.CSSProperties = {
  background: "var(--glass)",
  color: "var(--fg-900)",
  border: "1px solid var(--glass-border-in)",
};

// ── Blank form ────────────────────────────────────────────────────────────────

const BLANK_FORM: VendorInput = {
  name: "", category: "Other", phone: "", email: "",
  gstNumber: "", address: "", creditDays: 30,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors(tenantId);
  const { vendorBills } = useFinance(tenantId);
  const { toast } = useToast();

  const [search, setSearch]           = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Vendor | null>(null);
  const [form, setForm]               = useState<VendorInput>(BLANK_FORM);
  const [saving, setSaving]           = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (q && ![v.name, v.phone, v.email, v.gstNumber].some((f) => f?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [vendors, search, categoryFilter]);

  function getBillsForVendor(v: Vendor) {
    const byId = (vendorBills as any[]).filter((b) => b.vendorId === v.id);
    if (byId.length > 0) return byId;
    return vendorBills.filter((b) => b.vendorName === v.name);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditTarget(v);
    setForm({
      name: v.name, category: v.category, phone: v.phone, email: v.email,
      gstNumber: v.gstNumber ?? "", address: v.address ?? "", creditDays: v.creditDays,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateVendor(editTarget.id, form);
        toast({ title: "Vendor updated" });
      } else {
        await addVendor(form);
        toast({ title: "Vendor added" });
      }
      setModalOpen(false);
    } catch {
      toast({ title: "Failed to save vendor", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVendor(deleteTarget.id);
      toast({ title: "Vendor deleted" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Failed to delete vendor", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-xl" style={{ background: "var(--glass)" }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 w-full rounded-2xl" style={{ background: "var(--glass)" }} />
        ))}
      </div>
    );
  }

  const totalBilled  = vendors.reduce((s, v) => s + v.totalBilled, 0);
  const totalPaid    = vendors.reduce((s, v) => s + v.totalPaid, 0);
  const outstanding  = totalBilled - totalPaid;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black" style={{ color: "var(--fg-900)" }}>Vendors</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-500)" }}>
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "var(--brand)", color: "#fff" }}
        >
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Billed", value: totalBilled,  color: "var(--fg-900)" },
          { label: "Total Paid",   value: totalPaid,    color: "var(--green)"  },
          { label: "Outstanding",  value: outstanding,  color: outstanding > 0 ? "var(--red)" : "var(--fg-400)" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4" style={GLASS}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--fg-400)" }}>
              {s.label}
            </p>
            <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>
              {formatCurrency(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--fg-400)" }} />
          <input
            placeholder="Search name, phone, email, GST…"
            className="w-full pl-10 pr-3 py-2 rounded-xl text-sm outline-none"
            style={INPUT}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={INPUT}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Vendor List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed"
            style={{ borderColor: "var(--glass-border-in)" }}>
            <Building2 className="h-8 w-8 mb-2" style={{ color: "var(--fg-300)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--fg-400)" }}>No vendors found</p>
            <button onClick={openAdd} className="mt-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
              Add your first vendor
            </button>
          </div>
        )}

        {filtered.map((vendor) => {
          const expanded   = expandedId === vendor.id;
          const bills      = getBillsForVendor(vendor);
          const vOutstanding = vendor.totalBilled - vendor.totalPaid;

          return (
            <div key={vendor.id} className="rounded-2xl overflow-hidden" style={GLASS}>
              {/* Vendor row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-opacity hover:opacity-90"
                onClick={() => setExpandedId(expanded ? null : vendor.id)}
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                  style={{ background: "var(--brand)" }}>
                  {vendor.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-semibold text-sm truncate" style={{ color: "var(--fg-900)" }}>
                      {vendor.name}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${CATEGORY_COLOR[vendor.category] ?? CATEGORY_COLOR.Other} 15%, transparent)`,
                        color: CATEGORY_COLOR[vendor.category] ?? CATEGORY_COLOR.Other,
                      }}>
                      {vendor.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "var(--fg-500)" }}>
                    {vendor.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />{vendor.phone}
                      </span>
                    )}
                    {vendor.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />{vendor.email}
                      </span>
                    )}
                    {vendor.gstNumber && <span className="font-mono">{vendor.gstNumber}</span>}
                    <span style={{ color: "var(--fg-400)" }}>Net {vendor.creditDays}d</span>
                  </div>
                </div>

                {/* Finance summary */}
                <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--fg-400)" }}>Billed</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--fg-900)" }}>
                      {formatCurrency(vendor.totalBilled)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--fg-400)" }}>Paid</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: "var(--green)" }}>
                      {formatCurrency(vendor.totalPaid)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--fg-400)" }}>Due</p>
                    <p className="text-sm font-bold tabular-nums"
                      style={{ color: vOutstanding > 0 ? "var(--red)" : "var(--fg-400)" }}>
                      {formatCurrency(vOutstanding)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: "var(--fg-400)" }}
                    onClick={() => openEdit(vendor)}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: "var(--fg-400)" }}
                    onClick={() => setDeleteTarget(vendor)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expanded
                    ? <ChevronUp  className="h-4 w-4" style={{ color: "var(--fg-400)" }} />
                    : <ChevronDown className="h-4 w-4" style={{ color: "var(--fg-400)" }} />}
                </div>
              </div>

              {/* Expanded: bills */}
              {expanded && (
                <div className="border-t px-5 py-4" style={{ borderColor: "var(--glass-border-in)", background: "rgba(0,0,0,0.03)" }}>
                  {vendor.address && (
                    <p className="text-xs mb-3" style={{ color: "var(--fg-500)" }}>{vendor.address}</p>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5"
                    style={{ color: "var(--fg-400)" }}>
                    <FileText className="h-3 w-3" /> Bills ({bills.length})
                  </p>
                  {bills.length === 0 ? (
                    <p className="text-xs italic" style={{ color: "var(--fg-400)" }}>No bills linked to this vendor.</p>
                  ) : (
                    <div className="space-y-1">
                      {bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between rounded-xl px-3 py-2"
                          style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: "var(--fg-900)" }}>
                              {bill.description || bill.category || "Bill"}
                            </p>
                            <p className="text-[10px] capitalize" style={{ color: "var(--fg-400)" }}>{bill.status}</p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-xs font-bold tabular-nums" style={{ color: "var(--fg-900)" }}>
                              {formatCurrency(bill.amount)}
                            </p>
                            <p className="text-[10px] tabular-nums" style={{ color: "var(--green)" }}>
                              Paid {formatCurrency(bill.paidAmount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed z-50 w-full max-w-md"
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              <div className="rounded-2xl p-6" style={GLASS}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>
                    {editTarget ? "Edit Vendor" : "Add Vendor"}
                  </h2>
                  <button onClick={() => setModalOpen(false)} className="p-1 rounded hover:opacity-70"
                    style={{ color: "var(--fg-400)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Name *</label>
                    <input
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={INPUT}
                      placeholder="Vendor name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Category</label>
                      <select
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={INPUT}
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorInput["category"] }))}
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Credit Days</label>
                      <input
                        type="number" min={0}
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={INPUT}
                        value={form.creditDays}
                        onChange={(e) => setForm((f) => ({ ...f, creditDays: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Phone</label>
                      <input
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={INPUT}
                        placeholder="+91 98765…"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Email</label>
                      <input
                        type="email"
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                        style={INPUT}
                        placeholder="vendor@example.com"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>GST Number</label>
                      <input
                        className="w-full rounded-xl px-3 py-2 text-sm outline-none font-mono"
                        style={INPUT}
                        placeholder="27AAPFU0939F1ZV"
                        value={form.gstNumber ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Address</label>
                    <textarea
                      rows={2}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={INPUT}
                      placeholder="Full address…"
                      value={form.address ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-5">
                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ ...GLASS, color: "var(--fg-700)" }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving || !form.name.trim()}
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
                    style={{ background: "var(--brand)", color: "#fff", opacity: saving || !form.name.trim() ? 0.65 : 1 }}
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Vendor"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDeleteTarget(null)}
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
                <h3 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>Delete Vendor</h3>
                <p className="text-sm" style={{ color: "var(--fg-700)" }}>
                  Are you sure you want to delete{" "}
                  <strong style={{ color: "var(--fg-900)" }}>{deleteTarget.name}</strong>?
                  This cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ ...GLASS, color: "var(--fg-700)" }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleting}
                    onClick={handleDelete}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity"
                    style={{ background: "var(--red)", color: "#fff", opacity: deleting ? 0.65 : 1 }}
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {deleting ? "Deleting…" : "Delete"}
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
