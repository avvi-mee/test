"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useContracts } from "@/hooks/useContracts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { ContractCard } from "@/components/dashboard/contracts/ContractCard";
import { ContractStatusBadge } from "@/components/dashboard/contracts/ContractStatusBadge";
import { ContractDetailDrawer } from "@/components/dashboard/contracts/ContractDetailDrawer";
import { CreateClientContractDrawer } from "@/components/dashboard/contracts/CreateClientContractDrawer";
import { CreateEmployeeContractDrawer } from "@/components/dashboard/contracts/CreateEmployeeContractDrawer";
import { CreateContractorDrawer } from "@/components/dashboard/contracts/CreateContractorDrawer";
import { CreateVendorAgreementDrawer } from "@/components/dashboard/contracts/CreateVendorAgreementDrawer";
import type { Contract, ContractType } from "@/types/contracts";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Eye,
  Send,
  Download,
  Loader2,
  FileText,
  ChevronDown,
} from "lucide-react";

// ── Static Config ─────────────────────────────────────────────────────────────

const CONTRACT_TYPE_CONFIG: Record<ContractType, {
  label: string;
  pill: string;
  icon: string;
}> = {
  client:     { label: "CLIENT",     pill: "bg-[#EEF2FF] text-[#4B56D2]",   icon: "👤" },
  employee:   { label: "EMPLOYEE",   pill: "bg-[#EDFBF3] text-[#1A7A47]",   icon: "👷" },
  contractor: { label: "CONTRACTOR", pill: "bg-[#FFF8E8] text-[#A0700A]",   icon: "🔧" },
  vendor:     { label: "VENDOR",     pill: "bg-[#F3F0FF] text-[#6B4FBB]",   icon: "📦" },
};

const TYPE_FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "client", label: "Client" },
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "vendor", label: "Vendor" },
];

const STATUS_FILTER_TABS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "active", label: "Active" },
  { value: "terminated", label: "Terminated" },
];

// ── New Contract dropdown items ────────────────────────────────────────────────

const CREATE_OPTIONS: { type: ContractType; label: string; icon: string }[] = [
  { type: "client",     label: "Client Contract",     icon: "👤" },
  { type: "employee",   label: "Employee Contract",   icon: "👷" },
  { type: "contractor", label: "Contractor Agreement", icon: "🔧" },
  { type: "vendor",     label: "Vendor Agreement",    icon: "📦" },
];

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({
  contracts,
  onView,
  onSend,
  onDownload,
  onDelete,
  sending,
}: {
  contracts: Contract[];
  onView: (c: Contract) => void;
  onSend: (c: Contract) => void;
  onDownload: (c: Contract) => void;
  onDelete: (c: Contract) => void;
  sending: string | null;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Contract #</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Party B</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c) => {
            const typeConf = CONTRACT_TYPE_CONFIG[c.type];
            const cf = c.customFields as any;
            const value = cf?.totalValue ?? cf?.salary ?? null;
            const isSending = sending === c.id;

            return (
              <TableRow key={c.id} className="group">
                <TableCell className="font-mono text-xs text-[#8A8A8A]">{c.contractNumber}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${typeConf.pill}`}>
                    {typeConf.icon} {typeConf.label}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{c.partyB.name}</p>
                    <p className="text-xs text-gray-400">{c.partyB.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <ContractStatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-sm text-gray-700">
                  {value != null ? `₹${Number(value).toLocaleString("en-IN")}` : "—"}
                </TableCell>
                <TableCell className="text-xs text-gray-500">{c.startDate || "—"}</TableCell>
                <TableCell className="text-xs text-gray-500">{c.endDate || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => onView(c)} className="h-7 px-2">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSend(c)}
                      disabled={isSending || c.status === "signed" || c.status === "active"}
                      className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDownload(c)} className="h-7 px-2 text-violet-600 hover:bg-violet-50">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(c)} className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { tenant } = useTenantAuth();
  const { can } = useCurrentUser();
  const { toast } = useToast();
  const tenantId = tenant?.id ?? null;

  const { contracts, stats, loading, sendForSigning, deleteContract, activateContract } =
    useContracts(tenantId);

  const [view, setView] = useState<"cards" | "table">("cards");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create drawers: which type is open (null = closed)
  const [createType, setCreateType] = useState<ContractType | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // Detail drawer
  const [detailContract, setDetailContract] = useState<Contract | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Sending state
  const [sending, setSending] = useState<string | null>(null);

  const canManage = can("manage_contracts");

  const filteredContracts = useMemo(
    () =>
      contracts.filter((c) => {
        if (typeFilter !== "all" && c.type !== typeFilter) return false;
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const match =
            c.title?.toLowerCase().includes(q) ||
            c.contractNumber?.toLowerCase().includes(q) ||
            c.partyB?.name?.toLowerCase().includes(q) ||
            c.partyB?.email?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      }),
    [contracts, typeFilter, statusFilter, searchQuery]
  );

  const handleSendForSigning = async (contract: Contract) => {
    if (!tenantId) return;
    setSending(contract.id);
    try {
      const token = await sendForSigning(contract.id);
      if (token) {
        const signingUrl = `${window.location.origin}/sign/${token}`;
        fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "contract_signing",
            partyBName: contract.partyB.name,
            to: contract.partyB.email,
            contractTitle: contract.title,
            contractNumber: contract.contractNumber,
            signingUrl,
            tenantBusinessName: tenant?.name,
          }),
        }).catch(() => {});
        toast({
          title: "Sent for signing",
          description: `Link sent to ${contract.partyB.email}`,
        });
      }
    } catch {
      toast({ title: "Error sending for signing", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      await deleteContract(deleteTarget.id);
      toast({ title: "Contract deleted" });
      setDeleteTarget(null);
    } catch {
      toast({ title: "Error deleting contract", variant: "destructive" });
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleDownloadPdf = async (contract: Contract) => {
    if (contract.pdfUrl) {
      window.open(contract.pdfUrl, "_blank");
    } else {
      try {
        const { generateContractPdf } = await import("@/lib/generateContractPdf");
        await generateContractPdf(contract, {
          download: true,
          uploadToStorage: true,
          tenantId: tenantId!,
        });
      } catch {
        toast({ title: "PDF generation failed", variant: "destructive" });
      }
    }
  };

  const handleActivateContract = async (contract: Contract) => {
    if (!tenantId) return;
    await activateContract(contract.id);
    toast({ title: "Contract activated" });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-bold text-[#0A0A0A] flex items-center gap-2">
            Contracts
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded text-[11px] font-semibold bg-black/[0.06] text-[#3D3D3D]">
              {contracts.length}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center border border-black/[0.08] rounded-lg p-0.5 gap-0.5 bg-white">
            <button
              onClick={() => setView("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "cards" ? "bg-[#0A0A0A] text-white" : "text-[#8A8A8A] hover:text-[#0A0A0A]"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "table" ? "bg-[#0A0A0A] text-white" : "text-[#8A8A8A] hover:text-[#0A0A0A]"
              }`}
            >
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>

          {/* New Contract dropdown */}
          {canManage && (
            <div className="relative">
              <Button
                onClick={() => setShowCreateDropdown((v) => !v)}
                className="bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] gap-1.5"
              >
                <Plus className="h-4 w-4" /> New Contract <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {showCreateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCreateDropdown(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white border border-black/[0.08] rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    {CREATE_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => {
                          setCreateType(opt.type);
                          setShowCreateDropdown(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#3D3D3D] hover:bg-gray-50 transition-colors text-left"
                      >
                        <span>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Contracts", value: stats.total, icon: "📄" },
          { label: "Active", value: stats.active, icon: "✅" },
          { label: "Awaiting Signature", value: stats.awaitingSignature, icon: "✍️" },
          { label: "Expiring in 30 Days", value: stats.expiring, icon: "⏳" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3"
          >
            <span className="text-xl">{s.icon}</span>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-bold text-gray-900 text-lg">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FILTERS + SEARCH */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {TYPE_FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === tab.value
                  ? "bg-[#0A0A0A] text-white"
                  : "text-[#8A8A8A] hover:text-[#0A0A0A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="w-px bg-black/[0.08] mx-1" />
          {STATUS_FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.value
                  ? "bg-[#4B56D2] text-white"
                  : "text-[#8A8A8A] hover:text-[#0A0A0A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8A8A]" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm border-black/[0.08]"
          />
        </div>
      </div>

      {/* CONTENT */}
      {contracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <FileText className="h-8 w-8 text-gray-300" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900">No contracts yet</h3>
            <p className="text-sm text-gray-500 mt-1">Create your first contract to get started.</p>
          </div>
          {canManage && (
            <Button
              onClick={() => setShowCreateDropdown(true)}
              className="bg-gray-900 text-white hover:bg-gray-800 gap-1.5"
            >
              <Plus className="h-4 w-4" /> New Contract
            </Button>
          )}
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-gray-400 text-sm">No contracts match your filters.</p>
          <button
            onClick={() => { setTypeFilter("all"); setStatusFilter("all"); setSearchQuery(""); }}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Clear filters
          </button>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              onView={() => setDetailContract(c)}
              onSend={() => handleSendForSigning(c)}
              onDownload={() => handleDownloadPdf(c)}
              onDelete={() => setDeleteTarget(c)}
              onActivate={() => handleActivateContract(c)}
              sending={sending === c.id}
            />
          ))}
        </div>
      ) : (
        <TableView
          contracts={filteredContracts}
          onView={(c) => setDetailContract(c)}
          onSend={handleSendForSigning}
          onDownload={handleDownloadPdf}
          onDelete={(c) => setDeleteTarget(c)}
          sending={sending}
        />
      )}

      {/* CREATE DRAWERS (one per type) */}
      {tenantId && (
        <>
          <CreateClientContractDrawer
            open={createType === "client"}
            onClose={() => setCreateType(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail={""}
            onCreated={(id) => { setCreateType(null); setDetailContract(contracts.find((c) => c.id === id) ?? null); }}
          />
          <CreateEmployeeContractDrawer
            open={createType === "employee"}
            onClose={() => setCreateType(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail={""}
            onCreated={(id) => { setCreateType(null); setDetailContract(contracts.find((c) => c.id === id) ?? null); }}
          />
          <CreateContractorDrawer
            open={createType === "contractor"}
            onClose={() => setCreateType(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail={""}
            onCreated={(id) => { setCreateType(null); setDetailContract(contracts.find((c) => c.id === id) ?? null); }}
          />
          <CreateVendorAgreementDrawer
            open={createType === "vendor"}
            onClose={() => setCreateType(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail={""}
            onCreated={(id) => { setCreateType(null); setDetailContract(contracts.find((c) => c.id === id) ?? null); }}
          />
        </>
      )}

      {/* DETAIL DRAWER */}
      {tenantId && (
        <ContractDetailDrawer
          contract={detailContract}
          tenantId={tenantId}
          onClose={() => setDetailContract(null)}
          onUpdated={() => {
            // The realtime listener will update contracts automatically
            // Update the detailContract from the refreshed list
          }}
        />
      )}

      {/* DELETE DIALOG */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.contractNumber}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mt-1">
            This will permanently delete the contract. This action cannot be undone.
          </p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">Cancel</Button>
            <Button
              onClick={handleDelete}
              disabled={deleteSaving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
