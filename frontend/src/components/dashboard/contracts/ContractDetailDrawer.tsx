"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Loader2,
  Download,
  Copy,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ContractStatusBadge } from "./ContractStatusBadge";
import { ClausesEditor } from "./ClausesEditor";
import { useContracts } from "@/hooks/useContracts";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { getDefaultClauses } from "@/lib/contracts/defaultClauses";
import { generateContractPdf } from "@/lib/generateContractPdf";
import type {
  Contract,
  ContractClause,
  ContractActivityLog,
  ContractStatus,
  ContractType,
} from "@/types/contracts";

// ── Status Timeline ────────────────────────────────────────────────────────────

const TIMELINE_STEPS: { status: ContractStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "sent", label: "Sent" },
  { status: "viewed", label: "Viewed" },
  { status: "signed", label: "Signed" },
  { status: "active", label: "Active" },
];

const STATUS_ORDER: ContractStatus[] = ["draft", "sent", "viewed", "signed", "active", "completed", "expired", "terminated"];

function statusIndex(s: ContractStatus): number {
  return STATUS_ORDER.indexOf(s);
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ContractType, { label: string; pill: string; icon: string }> = {
  client:     { label: "CLIENT",     pill: "bg-[#EEF2FF] text-[#4B56D2]",   icon: "👤" },
  employee:   { label: "EMPLOYEE",   pill: "bg-[#EDFBF3] text-[#1A7A47]",   icon: "👷" },
  contractor: { label: "CONTRACTOR", pill: "bg-[#FFF8E8] text-[#A0700A]",   icon: "🔧" },
  vendor:     { label: "VENDOR",     pill: "bg-[#F3F0FF] text-[#6B4FBB]",   icon: "📦" },
};

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "overview" | "clauses" | "activity";

// ── Component ────────────────────────────────────────────────────────────────

interface ContractDetailDrawerProps {
  contract: Contract | null;
  tenantId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function ContractDetailDrawer({
  contract,
  tenantId,
  onClose,
  onUpdated,
}: ContractDetailDrawerProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editedClauses, setEditedClauses] = useState<ContractClause[]>([]);
  const [clausesDirty, setClausesDirty] = useState(false);
  const [activityLog, setActivityLog] = useState<ContractActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [savingClauses, setSavingClauses] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [renewDate, setRenewDate] = useState("");
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [notes, setNotes] = useState("");

  const { can } = useCurrentUser();
  const { toast } = useToast();
  const { updateClauses, activateContract, terminateContract, renewContract, sendForSigning, updateContract, fetchActivityLog } =
    useContracts(tenantId);

  const canManage = can("manage_contracts");

  // Sync notes + clauses when contract changes
  useEffect(() => {
    if (!contract) return;
    setNotes(contract.notes ?? "");
    setEditedClauses(contract.clauses ?? []);
    setClausesDirty(false);
  }, [contract?.id, contract?.notes, contract?.clauses]);

  // Load activity log when tab switches
  useEffect(() => {
    if (tab !== "activity" || !contract) return;
    setActivityLoading(true);
    fetchActivityLog(contract.id)
      .then((log) => setActivityLog(log))
      .catch(console.error)
      .finally(() => setActivityLoading(false));
  }, [tab, contract?.id]);

  const handleSaveClauses = async () => {
    if (!contract) return;
    setSavingClauses(true);
    try {
      await updateClauses(contract.id, editedClauses);
      setClausesDirty(false);
      toast({ title: "Clauses saved" });
      onUpdated();
    } catch {
      toast({ title: "Error saving clauses", variant: "destructive" });
    } finally {
      setSavingClauses(false);
    }
  };

  const handleActivate = async () => {
    if (!contract) return;
    await activateContract(contract.id);
    toast({ title: "Contract activated" });
    onUpdated();
  };

  const handleTerminate = async () => {
    if (!contract || !terminateReason) return;
    await terminateContract(contract.id, terminateReason);
    setShowTerminateModal(false);
    setTerminateReason("");
    toast({ title: "Contract terminated" });
    onUpdated();
  };

  const handleRenew = async () => {
    if (!contract || !renewDate) return;
    await renewContract(contract.id, renewDate);
    setShowRenewModal(false);
    setRenewDate("");
    toast({ title: "Contract renewed" });
    onUpdated();
  };

  const handleGeneratePdf = async () => {
    if (!contract) return;
    setPdfLoading(true);
    try {
      await generateContractPdf(contract, { download: true, uploadToStorage: true, tenantId });
      toast({ title: "PDF generated" });
      onUpdated();
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopySignLink = useCallback(() => {
    if (!contract?.signToken) return;
    const url = `${window.location.origin}/sign/${contract.signToken}`;
    navigator.clipboard.writeText(url).then(() => toast({ title: "Signing link copied" }));
  }, [contract?.signToken, toast]);

  const handleResend = async () => {
    if (!contract) return;
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
        }),
      }).catch(() => {});
      toast({ title: "Signing email resent" });
    }
  };

  const handleNotesBlur = () => {
    if (!contract || notes === (contract.notes ?? "")) return;
    updateContract(contract.id, { notes }).catch(console.error);
  };

  const timeAgo = (date: any): string => {
    if (!date) return "";
    const d: Date = date?.toDate ? date.toDate() : new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (!contract) return null;

  const typeConf = TYPE_CONFIG[contract.type];
  const cf = contract.customFields as any;
  const currentStatusIdx = statusIndex(contract.status);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[560px] max-w-full bg-white z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-black/[0.06] flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide shrink-0", typeConf.pill)}>
                {typeConf.icon} {typeConf.label}
              </span>
              <span className="text-[12px] font-mono text-[#8A8A8A] shrink-0">{contract.contractNumber}</span>
              <ContractStatusBadge status={contract.status} className="shrink-0" />
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="font-bold text-[#0A0A0A] text-[15px] truncate">{contract.title}</h2>
          <p className="text-[12px] text-[#3D3D3D]">
            {contract.partyB.name}
            {contract.partyB.email && <span className="text-[#8A8A8A]"> · {contract.partyB.email}</span>}
          </p>
        </div>

        {/* Tab bar */}
        <div className="shrink-0 flex border-b border-black/[0.06] px-6">
          {(["overview", "clauses", "activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-3 text-[13px] font-medium transition-colors capitalize",
                tab === t
                  ? "border-b-2 border-[#E8A020] text-[#0A0A0A]"
                  : "text-[#8A8A8A] hover:text-[#3D3D3D]"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Overview Tab ── */}
          {tab === "overview" && (
            <>
              {/* Status timeline */}
              <div>
                <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Progress</p>
                <div className="flex items-start gap-0">
                  {TIMELINE_STEPS.map((step, i) => {
                    const stepIdx = statusIndex(step.status);
                    const isPast = stepIdx < currentStatusIdx;
                    const isCurrent = step.status === contract.status;
                    const isFuture = stepIdx > currentStatusIdx;
                    return (
                      <div key={step.status} className="flex-1 flex flex-col items-center">
                        <div className="flex items-center w-full">
                          {i > 0 && (
                            <div className={cn(
                              "flex-1 h-0.5",
                              isPast || isCurrent ? "bg-[#E8A020]" : "bg-gray-200"
                            )} />
                          )}
                          <div className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2",
                            isCurrent
                              ? "bg-[#E8A020] border-[#E8A020] animate-pulse"
                              : isPast
                              ? "bg-[#E8A020] border-[#E8A020]"
                              : "bg-white border-gray-200"
                          )}>
                            {(isPast || isCurrent) && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                          {i < TIMELINE_STEPS.length - 1 && (
                            <div className={cn(
                              "flex-1 h-0.5",
                              isPast ? "bg-[#E8A020]" : "bg-gray-200"
                            )} />
                          )}
                        </div>
                        <span className={cn(
                          "text-[10px] mt-1 font-medium",
                          isCurrent ? "text-[#E8A020]" : isPast ? "text-[#8A8A8A]" : isFuture ? "text-gray-300" : "text-gray-400"
                        )}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Key details */}
              <div className="bg-[rgba(0,0,0,0.02)] rounded-[10px] p-4 space-y-3">
                <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Key Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {contract.type === "client" && (
                    <>
                      {cf?.projectName && <Detail label="Project" value={cf.projectName} />}
                      {cf?.totalValue != null && <Detail label="Total Value" value={`₹${Number(cf.totalValue).toLocaleString("en-IN")}`} />}
                      {cf?.completionDate && <Detail label="Completion" value={cf.completionDate} />}
                      {cf?.warrantyPeriodDays != null && <Detail label="Warranty" value={`${cf.warrantyPeriodDays} days`} />}
                    </>
                  )}
                  {contract.type === "employee" && (
                    <>
                      {cf?.designation && <Detail label="Designation" value={cf.designation} />}
                      {cf?.salary != null && <Detail label="Salary" value={`₹${Number(cf.salary).toLocaleString("en-IN")}/mo`} />}
                      {cf?.joiningDate && <Detail label="Joining Date" value={cf.joiningDate} />}
                      {cf?.noticePeriodDays != null && <Detail label="Notice Period" value={`${cf.noticePeriodDays} days`} />}
                    </>
                  )}
                  {contract.type === "contractor" && (
                    <>
                      {cf?.scopeOfWork && <Detail label="Scope" value={cf.scopeOfWork} className="col-span-2" />}
                      {cf?.totalValue != null && <Detail label="Total Fees" value={`₹${Number(cf.totalValue).toLocaleString("en-IN")}`} />}
                      {cf?.penaltyClause && <Detail label="Penalty" value={cf.penaltyClause} />}
                    </>
                  )}
                  {contract.type === "vendor" && (
                    <>
                      {cf?.vendorCategory && <Detail label="Category" value={cf.vendorCategory} />}
                      {cf?.supplyItems && <Detail label="Supply Items" value={cf.supplyItems} />}
                      {cf?.creditPeriodDays != null && <Detail label="Credit Period" value={`${cf.creditPeriodDays} days`} />}
                      {cf?.deliveryTerms && <Detail label="Delivery Terms" value={cf.deliveryTerms} />}
                    </>
                  )}
                  {contract.startDate && <Detail label="Start Date" value={contract.startDate} />}
                  {contract.endDate && <Detail label="End Date" value={contract.endDate} />}
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[rgba(0,0,0,0.02)] rounded-[10px] p-3">
                  <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-1.5">Party A (Studio)</p>
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">{contract.partyA.name}</p>
                  <p className="text-[11px] text-[#8A8A8A]">{contract.partyA.email}</p>
                </div>
                <div className="bg-[rgba(0,0,0,0.02)] rounded-[10px] p-3">
                  <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-1.5">Party B</p>
                  <p className="text-[13px] font-semibold text-[#0A0A0A]">{contract.partyB.name}</p>
                  <p className="text-[11px] text-[#8A8A8A]">{contract.partyB.email}</p>
                  {contract.partyB.phone && <p className="text-[11px] text-[#8A8A8A]">{contract.partyB.phone}</p>}
                </div>
              </div>

              {/* Signatures */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Signatures</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Party A */}
                  <div className="border border-gray-100 rounded-[10px] p-3 space-y-2">
                    <p className="text-[11px] text-[#8A8A8A]">Party A</p>
                    {contract.partyASignature ? (
                      <img src={contract.partyASignature} alt="Party A signature" className="h-10 object-contain" />
                    ) : (
                      <p className="text-[12px] text-gray-400">Not signed</p>
                    )}
                  </div>

                  {/* Party B */}
                  <div className="border border-gray-100 rounded-[10px] p-3 space-y-2">
                    <p className="text-[11px] text-[#8A8A8A]">Party B</p>
                    {contract.signedByPartyB ? (
                      <>
                        {contract.partyBSignature && (
                          <img src={contract.partyBSignature} alt="Party B signature" className="h-10 object-contain" />
                        )}
                        <p className="text-[10px] text-[#1A7A47]">
                          Signed {contract.partyBSignedAt ? timeAgo(contract.partyBSignedAt) : ""}
                        </p>
                        {contract.partyBSignedIP && (
                          <p className="text-[10px] text-gray-300">IP: {contract.partyBSignedIP}</p>
                        )}
                      </>
                    ) : contract.status === "sent" || contract.status === "viewed" ? (
                      <div className="space-y-1.5">
                        <p className="text-[12px] text-amber-600">Awaiting signature</p>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={handleCopySignLink}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Copy Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[11px] px-2"
                            onClick={handleResend}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Resend
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12px] text-gray-400">Not yet sent</p>
                    )}
                  </div>
                </div>
              </div>

              {/* PDF section */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">PDF</p>
                {contract.pdfUrl ? (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-[11px] text-[#8A8A8A]">
                      Generated {contract.pdfGeneratedAt ? timeAgo(contract.pdfGeneratedAt) : ""}
                    </span>
                    <a
                      href={contract.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-medium text-[#4B56D2] hover:underline"
                    >
                      <Download className="h-3 w-3" /> Download
                    </a>
                    <button
                      onClick={handleGeneratePdf}
                      disabled={pdfLoading}
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
                    >
                      {pdfLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      Regenerate
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={pdfLoading}
                    className="h-7 text-xs"
                  >
                    {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}
                    Generate PDF
                  </Button>
                )}
              </div>

              {/* Status actions */}
              {canManage && (
                <div className="flex gap-2 flex-wrap">
                  {(contract.status === "draft" || contract.status === "sent" || contract.status === "viewed" || contract.status === "signed") && (
                    <Button
                      size="sm"
                      className="bg-[#1A7A47] hover:bg-[#145f38] text-white h-7 text-xs gap-1"
                      onClick={handleActivate}
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Activate
                    </Button>
                  )}
                  {contract.status === "active" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50 h-7 text-xs gap-1"
                        onClick={() => setShowTerminateModal(true)}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Terminate
                      </Button>
                      {contract.endDate && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-200 text-amber-700 hover:bg-amber-50 h-7 text-xs gap-1"
                          onClick={() => setShowRenewModal(true)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Renew
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Notes</p>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#4B56D2]/30"
                  placeholder="Add internal notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesBlur}
                />
              </div>
            </>
          )}

          {/* ── Clauses Tab ── */}
          {tab === "clauses" && (
            <div className="space-y-4">
              <ClausesEditor
                clauses={editedClauses}
                onChange={(c) => { setEditedClauses(c); setClausesDirty(true); }}
                contractType={contract.type}
                onResetToDefaults={() => {
                  setEditedClauses(getDefaultClauses(contract.type));
                  setClausesDirty(true);
                }}
              />
              {clausesDirty && (
                <Button
                  onClick={handleSaveClauses}
                  disabled={savingClauses}
                  className="w-full bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
                >
                  {savingClauses && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              )}
            </div>
          )}

          {/* ── Activity Tab ── */}
          {tab === "activity" && (
            <div className="space-y-3">
              {activityLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : activityLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
              ) : (
                activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-[#E8A020] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[#0A0A0A]">{entry.summary}</p>
                      <p className="text-[11px] text-[#8A8A8A]">
                        {entry.actorId} · {timeAgo(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Terminate Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowTerminateModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-[#0A0A0A]">Terminate Contract</h3>
            <p className="text-sm text-gray-500">Provide a reason for termination:</p>
            <textarea
              className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="Reason for termination..."
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTerminateModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleTerminate}
                disabled={!terminateReason}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Terminate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowRenewModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-[#0A0A0A]">Renew Contract</h3>
            <p className="text-sm text-gray-500">Choose a new end date:</p>
            <input
              type="date"
              value={renewDate}
              onChange={(e) => setRenewDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRenewModal(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={handleRenew}
                disabled={!renewDate}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Renew
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Detail label/value row ─────────────────────────────────────────────────────

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide">{label}</p>
      <p className="text-[13px] font-medium text-[#0A0A0A]">{value}</p>
    </div>
  );
}
