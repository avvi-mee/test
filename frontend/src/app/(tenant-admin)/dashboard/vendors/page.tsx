"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  Building2,
  Phone,
  Mail,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useVendors, type Vendor, type VendorInput } from "@/hooks/useVendors";
import { useFinance } from "@/hooks/useFinance";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Materials", "Labour", "Equipment", "Other"] as const;

const CATEGORY_PILL: Record<string, string> = {
  Materials:  "bg-blue-50 text-blue-700",
  Labour:     "bg-emerald-50 text-emerald-700",
  Equipment:  "bg-amber-50 text-amber-700",
  Other:      "bg-gray-100 text-gray-600",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  if (!v) return "₹0";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

// ─── Blank form ───────────────────────────────────────────────────────────────

const BLANK_FORM: VendorInput = {
  name: "",
  category: "Other",
  phone: "",
  email: "",
  gstNumber: "",
  address: "",
  creditDays: 30,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id ?? null;
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors(tenantId);
  const { vendorBills } = useFinance(tenantId);
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorInput>(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return vendors.filter(v => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (q && ![v.name, v.phone, v.email, v.gstNumber].some(f => f?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [vendors, search, categoryFilter]);

  const billsByVendor = useMemo(() => {
    const map = new Map<string, typeof vendorBills>();
    for (const bill of vendorBills) {
      // Link by vendorId or vendorName
      const key = (bill as any).vendorId ?? bill.vendorName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(bill);
    }
    return map;
  }, [vendorBills]);

  // Get bills for a vendor (by vendorId field if present, else by name)
  function getBillsForVendor(v: Vendor) {
    const byId = (vendorBills as any[]).filter(b => b.vendorId === v.id);
    if (byId.length > 0) return byId;
    return vendorBills.filter(b => b.vendorName === v.name);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(BLANK_FORM);
    setModalOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditTarget(v);
    setForm({
      name: v.name,
      category: v.category,
      phone: v.phone,
      email: v.email,
      gstNumber: v.gstNumber ?? "",
      address: v.address ?? "",
      creditDays: v.creditDays,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // Stats bar
  const totalBilled = vendors.reduce((s, v) => s + v.totalBilled, 0);
  const totalPaid   = vendors.reduce((s, v) => s + v.totalPaid, 0);
  const outstanding = totalBilled - totalPaid;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500 mt-0.5">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
        </div>
        <Button
          className="bg-gray-900 hover:bg-gray-800 text-white gap-1.5 h-9"
          onClick={openAdd}
        >
          <Plus className="h-4 w-4" /> Add Vendor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Billed",  value: totalBilled,  color: "text-gray-900" },
          { label: "Total Paid",    value: totalPaid,    color: "text-emerald-700" },
          { label: "Outstanding",   value: outstanding,  color: outstanding > 0 ? "text-red-600" : "text-gray-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
            <p className={cn("text-2xl font-black tabular-nums", s.color)}>{formatCurrency(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, phone, email, GST..."
            className="pl-10 bg-white border-gray-200 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] bg-white h-9 text-sm">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Vendor List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            <Building2 className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-400">No vendors found</p>
            <button onClick={openAdd} className="mt-2 text-sm text-blue-600 hover:underline">Add your first vendor</button>
          </div>
        )}

        {filtered.map(vendor => {
          const expanded = expandedId === vendor.id;
          const bills = getBillsForVendor(vendor);
          const vOutstanding = vendor.totalBilled - vendor.totalPaid;

          return (
            <div key={vendor.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Vendor row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
                onClick={() => setExpandedId(expanded ? null : vendor.id)}
              >
                {/* Avatar */}
                <div className="h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm shrink-0">
                  {vendor.name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-gray-900 text-sm truncate">{vendor.name}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", CATEGORY_PILL[vendor.category] ?? CATEGORY_PILL.Other)}>
                      {vendor.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    {vendor.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{vendor.phone}</span>}
                    {vendor.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{vendor.email}</span>}
                    {vendor.gstNumber && <span className="font-mono">{vendor.gstNumber}</span>}
                    <span className="text-gray-400">Net {vendor.creditDays}d</span>
                  </div>
                </div>

                {/* Finance summary */}
                <div className="hidden sm:flex items-center gap-6 shrink-0 text-right">
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Billed</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(vendor.totalBilled)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Paid</p>
                    <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(vendor.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Due</p>
                    <p className={cn("text-sm font-bold tabular-nums", vOutstanding > 0 ? "text-red-600" : "text-gray-400")}>
                      {formatCurrency(vOutstanding)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700" onClick={() => openEdit(vendor)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => setDeleteTarget(vendor)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
              </div>

              {/* Expanded: bills */}
              {expanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/40">
                  {vendor.address && (
                    <p className="text-xs text-gray-500 mb-3">{vendor.address}</p>
                  )}
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Bills ({bills.length})
                  </p>
                  {bills.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No bills linked to this vendor.</p>
                  ) : (
                    <div className="space-y-1">
                      {bills.map(bill => (
                        <div key={bill.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{bill.description || bill.category || "Bill"}</p>
                            <p className="text-[10px] text-gray-400">{bill.status}</p>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-xs font-bold text-gray-900">{formatCurrency(bill.amount)}</p>
                            <p className="text-[10px] text-emerald-700">Paid {formatCurrency(bill.paidAmount)}</p>
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

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Name *</label>
              <Input
                placeholder="Vendor name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Category</label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as VendorInput["category"] }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Credit Days</label>
                <Input
                  type="number"
                  value={form.creditDays}
                  onChange={e => setForm(f => ({ ...f, creditDays: Number(e.target.value) }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Phone</label>
                <Input placeholder="+91 98765..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Email</label>
                <Input type="email" placeholder="vendor@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">GST Number</label>
                <Input placeholder="27AAPFU0939F1ZV" value={form.gstNumber ?? ""} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Address</label>
              <textarea
                rows={2}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
                placeholder="Full address..."
                value={form.address ?? ""}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              className="bg-gray-900 hover:bg-gray-800 text-white"
              disabled={saving || !form.name.trim()}
              onClick={handleSave}
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : editTarget ? "Save Changes" : "Add Vendor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Deleting...</> : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
