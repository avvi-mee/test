"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useContracts } from "@/hooks/useContracts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { logActivity, recordSignature } from "@/lib/services/contractService";
import type {
  Contract,
  ContractClause,
  ContractActivityLog,
  PaymentMilestone,
} from "@/types/contracts";
import {
  ArrowLeft,
  Send,
  Download,
  PenLine,
  Lock,
  ChevronUp,
  ChevronDown,
  Trash2,
  Loader2,
  CheckCircle,
  Clock,
  FileSignature,
  X,
} from "lucide-react";

// ── Status Pill ───────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  draft:      "bg-[#F3F4F6] text-[#6B7280]",
  sent:       "bg-[#E8F4FD] text-[#1D6FA4]",
  viewed:     "bg-[#FFF8E8] text-[#A0700A]",
  signed:     "bg-[#EEF2FF] text-[#4B56D2]",
  active:     "bg-[#EDFBF3] text-[#1A7A47]",
  completed:  "bg-[#EDFBF3] text-[#1A7A47]",
  terminated: "bg-[#FFF0F0] text-[#B83232]",
  expired:    "bg-[#FFF0F0] text-[#B83232]",
  renewed:    "bg-[#EDFBF3] text-[#1A7A47]",
};

const TYPE_PILL: Record<string, string> = {
  client:     "bg-[#EEF2FF] text-[#4B56D2]",
  employee:   "bg-[#EDFBF3] text-[#1A7A47]",
  contractor: "bg-[#FFF8E8] text-[#A0700A]",
  vendor:     "bg-[#F3F0FF] text-[#6B4FBB]",
};

// ── Signature Pad ─────────────────────────────────────────────────────────────

function SignaturePad({
  onSign,
  onCancel,
}: {
  onSign: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
    const clientY = "clientY" in e ? e.clientY : (e as Touch).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos(
        "touches" in e ? (e as TouchEvent).touches[0] : (e as MouseEvent),
        canvas
      );
      lastPos.current = pos;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos(
        "touches" in e ? (e as TouchEvent).touches[0] : (e as MouseEvent),
        canvas
      );
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    };
    const end = () => { drawing.current = false; lastPos.current = null; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Draw your signature below:</p>
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={480}
          height={160}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={clearCanvas} className="flex-1 text-xs">
          Clear
        </Button>
        <Button variant="outline" onClick={onCancel} className="flex-1 text-xs">
          Cancel
        </Button>
        <Button
          onClick={confirmSign}
          className="flex-1 text-xs bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
        >
          Confirm Signature
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(ts: any): string {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

function relativeTime(ts: any): string {
  if (!ts) return "";
  try {
    const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN");
  } catch {
    return "";
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId as string;
  const { tenant } = useTenantAuth();
  const { can } = useCurrentUser();
  const { toast } = useToast();
  const tenantId = tenant?.id ?? null;

  const { contracts, updateContract, sendForSigning, fetchActivityLog } =
    useContracts(tenantId);

  const contract = contracts.find((c) => c.id === contractId) ?? null;

  const [activeTab, setActiveTab] = useState<"info" | "clauses" | "payment">("info");
  const [activityLog, setActivityLog] = useState<ContractActivityLog[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Clauses editor state
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [clausesChanged, setClausesChanged] = useState(false);

  // Notes
  const [notes, setNotes] = useState("");

  // Signature pad
  const [showSignPad, setShowSignPad] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);

  const canManage = can("manage_contracts");

  useEffect(() => {
    if (contract) {
      setClauses(contract.clauses ?? []);
      setNotes(contract.notes ?? "");
    }
  }, [contract?.id]);

  useEffect(() => {
    if (!tenantId || !contractId) return;
    fetchActivityLog(contractId).then((logs) => {
      setActivityLog(logs);
      setLogLoading(false);
    });
  }, [tenantId, contractId, fetchActivityLog]);

  const handleSendForSigning = async () => {
    if (!contract) return;
    setSending(true);
    try {
      const token = await sendForSigning(contract.id);
      if (token) {
        const signingUrl = `${window.location.origin}/sign/${token}`;
        fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "contract_signing",
            to: contract.partyB.email,
            partyBName: contract.partyB.name,
            contractTitle: contract.title,
            contractNumber: contract.contractNumber,
            signingUrl,
            tenantBusinessName: tenant?.name,
          }),
        }).catch(() => {});
        toast({ title: "Sent for signing", description: `Link emailed to ${contract.partyB.email}` });
        // Log activity
        if (tenantId) {
          await logActivity(tenantId, contract.id, {
            action: "sent_for_signing",
            summary: `Contract sent to ${contract.partyB.name} for signing`,
            actorId: "",
          });
        }
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSaveClauses = async () => {
    if (!contract || !tenantId) return;
    setSaving(true);
    try {
      await updateContract(contract.id, { clauses });
      setClausesChanged(false);
      toast({ title: "Clauses saved" });
    } catch {
      toast({ title: "Error saving clauses", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!contract || !tenantId) return;
    setSaving(true);
    try {
      await updateContract(contract.id, { notes });
      toast({ title: "Notes saved" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMilestone = async (idx: number) => {
    if (!contract || !tenantId) return;
    const cf = contract.customFields as any;
    const schedule: PaymentMilestone[] = [...(cf?.paymentSchedule ?? [])];
    schedule[idx] = { ...schedule[idx], isPaid: !schedule[idx].isPaid };
    await updateContract(contract.id, {
      customFields: { ...cf, paymentSchedule: schedule },
    });
  };

  const handleSign = async (dataUrl: string) => {
    if (!contract || !tenantId) return;
    setSigSaving(true);
    try {
      // Upload signature to Firebase Storage
      let signatureUrl = dataUrl;
      try {
        const uploadRes = await fetch("/api/contracts/upload-signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantId,
            contractId: contract.id,
            dataUrl,
            filename: "signature-partyA.png",
          }),
        });
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          if (url) signatureUrl = url;
        }
      } catch {
        // fall back to dataUrl if upload fails
      }

      // Update contract: Party A fields + status → active
      await updateContract(contract.id, {
        partyASignature: signatureUrl,
        partyASignedAt: new Date().toISOString(),
        status: "active",
      } as any);

      await logActivity(tenantId, contract.id, {
        action: "counter_signed",
        summary: "Contract counter-signed by studio (Party A) — now active",
        actorId: "",
      });
      toast({ title: "Contract is now active" });
      setShowSignPad(false);
    } catch {
      toast({ title: "Error saving signature", variant: "destructive" });
    } finally {
      setSigSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!contract || !tenantId) return;
    if (contract.pdfUrl) {
      window.open(contract.pdfUrl, "_blank");
      return;
    }
    try {
      const { generateContractPdf } = await import("@/lib/generateContractPdf");
      await generateContractPdf(contract, {
        download: true,
        uploadToStorage: true,
        tenantId,
      });
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    }
  };

  const moveClause = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= clauses.length) return;
    const arr = [...clauses];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setClauses(arr.map((c, idx) => ({ ...c, order: idx + 1 })));
    setClausesChanged(true);
  };

  const updateClause = (i: number, upd: Partial<ContractClause>) => {
    setClauses((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...upd } : c))
    );
    setClausesChanged(true);
  };

  const removeClause = (i: number) => {
    setClauses((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((c, idx) => ({ ...c, order: idx + 1 }))
    );
    setClausesChanged(true);
  };

  const addCustomClause = () => {
    setClauses((prev) => [
      ...prev,
      { order: prev.length + 1, title: "Custom Clause", body: "", isRequired: false, isEditable: true },
    ]);
    setClausesChanged(true);
  };

  if (!contract && contracts.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-gray-500">Contract not found.</p>
        <Button onClick={() => router.push("/dashboard/contracts")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Contracts
        </Button>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4B56D2]" />
      </div>
    );
  }

  const cf = contract.customFields as any;
  const typePill = TYPE_PILL[contract.type] ?? TYPE_PILL.client;
  const statusClass = STATUS_PILL[contract.status] ?? STATUS_PILL.draft;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/contracts")}
            className="text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${typePill}`}>
                {contract.type.toUpperCase()}
              </span>
              <span className="font-mono text-sm text-[#8A8A8A]">{contract.contractNumber}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClass}`}>
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0A0A0A]">{contract.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManage && contract.status !== "signed" && contract.status !== "active" && (
            <Button
              onClick={handleSendForSigning}
              disabled={sending}
              variant="outline"
              className="gap-1.5"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for Signing
            </Button>
          )}
          <Button onClick={handleDownloadPdf} variant="outline" className="gap-1.5">
            <Download className="h-4 w-4" /> PDF
          </Button>
          {canManage && contract.status === "signed" && !contract.partyASignature && (
            <Button
              onClick={() => setShowSignPad(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-700 gap-1.5"
            >
              <PenLine className="h-4 w-4" /> Sign as Studio
            </Button>
          )}
        </div>
      </div>

      {/* SIGNATURE PAD MODAL */}
      {showSignPad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Sign as Party A (Studio)</h3>
              <button onClick={() => setShowSignPad(false)}>
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            {sigSaving ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#4B56D2]" />
              </div>
            ) : (
              <SignaturePad onSign={handleSign} onCancel={() => setShowSignPad(false)} />
            )}
          </div>
        </div>
      )}

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left / Main ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-black/[0.06]">
            {(["info", "clauses", "payment"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "text-[#0A0A0A] border-[#0A0A0A]"
                    : "text-[#8A8A8A] border-transparent hover:text-[#0A0A0A]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* ── Tab: Info ── */}
          {activeTab === "info" && (
            <div className="space-y-6">
              {/* Parties */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Party A (Studio)", party: contract.partyA },
                  { label: "Party B (Counterparty)", party: contract.partyB },
                ].map(({ label, party }) => (
                  <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                    <p className="font-bold text-gray-900">{party.name}</p>
                    <p className="text-sm text-gray-500">{party.email}</p>
                    {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
                  </div>
                ))}
              </div>

              {/* Dates */}
              {(contract.startDate || contract.endDate) && (
                <div className="grid grid-cols-2 gap-4">
                  {contract.startDate && (
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Start Date</p>
                      <p className="font-semibold text-gray-900">{contract.startDate}</p>
                    </div>
                  )}
                  {contract.endDate && (
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">End Date</p>
                      <p className="font-semibold text-gray-900">{contract.endDate}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Type-specific fields */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {contract.type.charAt(0).toUpperCase() + contract.type.slice(1)} Details
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {contract.type === "client" && (
                    <>
                      {cf.projectName && <><span className="text-gray-500">Project</span><span className="font-medium">{cf.projectName}</span></>}
                      {cf.totalValue && <><span className="text-gray-500">Total Value</span><span className="font-medium">₹{Number(cf.totalValue).toLocaleString("en-IN")}</span></>}
                      {cf.completionDate && <><span className="text-gray-500">Completion</span><span className="font-medium">{cf.completionDate}</span></>}
                      {cf.warrantyPeriodDays && <><span className="text-gray-500">Warranty</span><span className="font-medium">{cf.warrantyPeriodDays} days</span></>}
                    </>
                  )}
                  {contract.type === "employee" && (
                    <>
                      {cf.designation && <><span className="text-gray-500">Designation</span><span className="font-medium">{cf.designation}</span></>}
                      {cf.department && <><span className="text-gray-500">Department</span><span className="font-medium">{cf.department}</span></>}
                      {cf.salary && <><span className="text-gray-500">Salary</span><span className="font-medium">₹{Number(cf.salary).toLocaleString("en-IN")}/mo</span></>}
                      {cf.joiningDate && <><span className="text-gray-500">Joining Date</span><span className="font-medium">{cf.joiningDate}</span></>}
                      {cf.noticePeriodDays && <><span className="text-gray-500">Notice Period</span><span className="font-medium">{cf.noticePeriodDays} days</span></>}
                    </>
                  )}
                  {contract.type === "contractor" && (
                    <>
                      {cf.projectName && <><span className="text-gray-500">Project</span><span className="font-medium">{cf.projectName}</span></>}
                      {cf.totalValue && <><span className="text-gray-500">Total Value</span><span className="font-medium">₹{Number(cf.totalValue).toLocaleString("en-IN")}</span></>}
                      {cf.scopeOfWork && (
                        <>
                          <span className="text-gray-500 self-start">Scope</span>
                          <span className="font-medium col-span-1">{cf.scopeOfWork}</span>
                        </>
                      )}
                    </>
                  )}
                  {contract.type === "vendor" && (
                    <>
                      {cf.vendorCategory && <><span className="text-gray-500">Category</span><span className="font-medium">{cf.vendorCategory}</span></>}
                      {cf.creditPeriodDays && <><span className="text-gray-500">Credit Period</span><span className="font-medium">{cf.creditPeriodDays} days</span></>}
                      {cf.discountPercent && <><span className="text-gray-500">Discount</span><span className="font-medium">{cf.discountPercent}%</span></>}
                      {cf.deliveryTerms && <><span className="text-gray-500">Delivery Terms</span><span className="font-medium">{cf.deliveryTerms}</span></>}
                    </>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Notes</Label>
                <textarea
                  className="w-full min-h-[80px] text-sm text-gray-700 border-0 resize-none focus:outline-none"
                  placeholder="Add internal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={!canManage}
                />
                {canManage && notes !== (contract.notes ?? "") && (
                  <Button
                    onClick={handleSaveNotes}
                    disabled={saving}
                    size="sm"
                    className="mt-2 bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] text-xs"
                  >
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Save Notes
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Clauses ── */}
          {activeTab === "clauses" && (
            <div className="space-y-3">
              {clauses.map((clause, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 w-5">{clause.order}.</span>
                    <Input
                      value={clause.title}
                      onChange={(e) => updateClause(i, { title: e.target.value })}
                      className="text-sm font-semibold flex-1"
                      disabled={!clause.isEditable || !canManage}
                    />
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveClause(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveClause(i, 1)} disabled={i === clauses.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        {clause.isRequired ? (
                          <Lock className="h-3.5 w-3.5 text-gray-300" />
                        ) : (
                          <button onClick={() => removeClause(i)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <textarea
                    className="w-full min-h-[60px] px-2 py-1.5 text-xs text-gray-600 border border-gray-100 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#4B56D2]/30 bg-gray-50"
                    value={clause.body}
                    onChange={(e) => updateClause(i, { body: e.target.value })}
                    disabled={!clause.isEditable || !canManage}
                  />
                </div>
              ))}

              {canManage && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={addCustomClause}
                    className="w-full text-xs text-[#4B56D2] border border-dashed border-[#4B56D2] rounded-lg py-2.5 hover:bg-[#EEF2FF] transition-colors"
                  >
                    + Add Custom Clause
                  </button>
                  {clausesChanged && (
                    <Button
                      onClick={handleSaveClauses}
                      disabled={saving}
                      className="w-full bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                      Save Changes
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Payment ── */}
          {activeTab === "payment" && (
            <div className="space-y-3">
              {(!cf?.paymentSchedule || cf.paymentSchedule.length === 0) ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No payment schedule for this contract type.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Milestone</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">%</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cf.paymentSchedule as PaymentMilestone[]).map((m, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-4 py-3 text-gray-800">{m.label}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{m.percentage}%</td>
                          <td className="px-4 py-3 text-right font-medium">₹{Number(m.amount).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => canManage && handleToggleMilestone(i)}
                              className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                                m.isPaid
                                  ? "bg-[#EDFBF3] text-[#1A7A47]"
                                  : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                              } ${!canManage ? "cursor-default" : "cursor-pointer"}`}
                            >
                              {m.isPaid ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-5">
          {/* Signing Status */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1">
              <FileSignature className="h-3.5 w-3.5" /> Signing Status
            </p>
            <div className="space-y-3">
              {/* Party A */}
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Party A — Studio</p>
                <p className="text-sm font-medium text-gray-800">{contract.partyA.name}</p>
                {contract.partyASignature ? (
                  <div className="mt-2">
                    <img src={contract.partyASignature} alt="Party A signature" className="h-10 rounded border" />
                    <p className="text-[10px] text-gray-400 mt-1">Signed {formatTs(contract.partyASignedAt)}</p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">Not yet signed</p>
                )}
              </div>
              {/* Party B */}
              <div className="border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Party B — Counterparty</p>
                <p className="text-sm font-medium text-gray-800">{contract.partyB.name}</p>
                <p className="text-[11px] text-gray-400">{contract.partyB.email}</p>
                {contract.partyBSignature ? (
                  <div className="mt-2">
                    <img src={contract.partyBSignature} alt="Party B signature" className="h-10 rounded border" />
                    <p className="text-[10px] text-gray-400 mt-1">Signed {formatTs(contract.partyBSignedAt)}</p>
                    {contract.partyBSignedIP && (
                      <p className="text-[10px] text-gray-300">IP: {contract.partyBSignedIP}</p>
                    )}
                  </div>
                ) : contract.sentAt ? (
                  <p className="text-[11px] text-amber-600 mt-1">Awaiting signature (sent {formatTs(contract.sentAt)})</p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">Not yet sent</p>
                )}
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity Log</p>
            {logLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
              </div>
            ) : activityLog.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4B56D2] mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-800">{entry.summary}</p>
                      <p className="text-[10px] text-gray-400">{relativeTime(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
