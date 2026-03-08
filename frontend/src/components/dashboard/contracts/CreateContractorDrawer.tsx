"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClausesEditor } from "./ClausesEditor";
import { useToast } from "@/hooks/use-toast";
import { useContracts } from "@/hooks/useContracts";
import { generateContractNumber } from "@/lib/services/contractService";
import { getDefaultClauses } from "@/lib/contracts/defaultClauses";
import {
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Loader2,
  Trash2,
  AlertCircle,
  Download,
} from "lucide-react";
import type { ContractClause, PaymentMilestone, ContractorFields } from "@/types/contracts";
import { generateContractPdf } from "@/lib/generateContractPdf";

interface CreateContractorDrawerProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  partyAName: string;
  partyAEmail: string;
  onCreated: (contractId: string) => void;
}

type Step = 1 | 2 | 3;

interface FormState {
  title: string;
  partyAName: string;
  partyAEmail: string;
  partyBName: string;
  partyBEmail: string;
  partyBPhone: string;
  // Engagement
  scopeOfWork: string;
  startDate: string;
  endDate: string;
  penaltyClause: string;
  // Fees
  totalValue: number | "";
  paymentSchedule: PaymentMilestone[];
  terminationNoticeDays: number | "";
  // Clauses
  clauses: ContractClause[];
}

const EMPTY: FormState = {
  title: "",
  partyAName: "",
  partyAEmail: "",
  partyBName: "",
  partyBEmail: "",
  partyBPhone: "",
  scopeOfWork: "",
  startDate: "",
  endDate: "",
  penaltyClause: "",
  totalValue: "",
  paymentSchedule: [],
  terminationNoticeDays: 15,
  clauses: [],
};

export function CreateContractorDrawer({
  open,
  onClose,
  tenantId,
  partyAName,
  partyAEmail,
  onCreated,
}: CreateContractorDrawerProps) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY, partyAName, partyAEmail });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { createContract } = useContracts(tenantId);

  const reset = useCallback(() => {
    setStep(1);
    setForm({ ...EMPTY, partyAName, partyAEmail });
  }, [partyAName, partyAEmail]);

  const handleClose = () => { onClose(); reset(); };

  const step1Valid = form.title && form.partyBName && form.partyBEmail;
  const step2Valid = form.scopeOfWork && form.startDate;

  const tv = typeof form.totalValue === "number" ? form.totalValue : 0;
  const totalPct = form.paymentSchedule.reduce((s, m) => s + (m.percentage || 0), 0);

  const goStep3 = () => {
    if (form.clauses.length === 0) {
      setForm((f) => ({ ...f, clauses: getDefaultClauses("contractor") }));
    }
    setStep(3);
  };

  const addMilestone = () => {
    const remaining = Math.max(0, 100 - totalPct);
    setForm((f) => ({
      ...f,
      paymentSchedule: [
        ...f.paymentSchedule,
        {
          label: `Milestone ${f.paymentSchedule.length + 1}`,
          percentage: remaining,
          amount: (remaining / 100) * tv,
          isPaid: false,
        },
      ],
    }));
  };

  const updateMilestone = (i: number, upd: Partial<PaymentMilestone>) => {
    setForm((f) => ({
      ...f,
      paymentSchedule: f.paymentSchedule.map((m, idx) => {
        if (idx !== i) return m;
        const merged = { ...m, ...upd };
        if (upd.percentage !== undefined) merged.amount = ((upd.percentage ?? 0) / 100) * tv;
        return merged;
      }),
    }));
  };

  const removeMilestone = (i: number) => {
    setForm((f) => ({ ...f, paymentSchedule: f.paymentSchedule.filter((_, idx) => idx !== i) }));
  };

  const buildContractData = (contractNumber: string) => {
    const customFields: ContractorFields = {
      scopeOfWork: form.scopeOfWork,
      totalValue: typeof form.totalValue === "number" ? form.totalValue : 0,
      paymentSchedule: form.paymentSchedule,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      penaltyClause: form.penaltyClause || undefined,
    };
    return {
      tenantId,
      contractNumber,
      type: "contractor" as const,
      title: form.title,
      status: "draft" as const,
      partyA: { name: form.partyAName || partyAName, email: form.partyAEmail || partyAEmail },
      partyB: {
        name: form.partyBName,
        email: form.partyBEmail,
        phone: form.partyBPhone || undefined,
      },
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      clauses: form.clauses,
      customFields,
    };
  };

  const handleSaveAsDraft = async () => {
    setSaving(true);
    try {
      const contractNumber = await generateContractNumber(tenantId);
      const data = buildContractData(contractNumber);
      const id = await createContract(data);
      if (id) {
        toast({ title: "Contract created", description: contractNumber });
        reset();
        onCreated(id);
      }
    } catch {
      toast({ title: "Error creating contract", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndDownload = async () => {
    setSaving(true);
    try {
      const contractNumber = await generateContractNumber(tenantId);
      const data = buildContractData(contractNumber);
      const id = await createContract(data);
      if (id) {
        const fullContract = { ...data, id, createdAt: new Date().toISOString() } as any;
        await generateContractPdf(fullContract, { download: true, uploadToStorage: true, tenantId });
        toast({ title: "Contract created & PDF downloaded", description: contractNumber });
        reset();
        onCreated(id);
      }
    } catch {
      toast({ title: "Error creating contract", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg sm:mr-0 sm:ml-auto sm:h-screen sm:rounded-l-2xl sm:rounded-r-none p-0 overflow-y-auto">
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-[#A0700A]" />
              New Contractor Agreement
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  step === s ? "bg-[#A0700A]" : step > s ? "bg-[#A0700A]/40" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Contract Title *</Label>
                <Input
                  placeholder="e.g. Site Work Agreement – Phase 1"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contractor (Party B)</Label>
                <Input
                  placeholder="Full name *"
                  value={form.partyBName}
                  onChange={(e) => setForm((f) => ({ ...f, partyBName: e.target.value }))}
                  className="text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    placeholder="Email *"
                    value={form.partyBEmail}
                    onChange={(e) => setForm((f) => ({ ...f, partyBEmail: e.target.value }))}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Phone"
                    value={form.partyBPhone}
                    onChange={(e) => setForm((f) => ({ ...f, partyBPhone: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Studio (Party A)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Studio name"
                    value={form.partyAName}
                    onChange={(e) => setForm((f) => ({ ...f, partyAName: e.target.value }))}
                    className="text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="Studio email"
                    value={form.partyAEmail}
                    onChange={(e) => setForm((f) => ({ ...f, partyAEmail: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!step1Valid}
                  className="flex-1 bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
                >
                  Next: Engagement <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Engagement + Fees ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Scope of Work *</Label>
                <textarea
                  className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#A0700A]/30"
                  placeholder="Describe the work scope..."
                  value={form.scopeOfWork}
                  onChange={(e) => setForm((f) => ({ ...f, scopeOfWork: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Total Fees (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.totalValue}
                    onChange={(e) => {
                      const newTv = Number(e.target.value);
                      setForm((f) => ({
                        ...f,
                        totalValue: newTv,
                        paymentSchedule: f.paymentSchedule.map((m) => ({
                          ...m,
                          amount: (m.percentage / 100) * newTv,
                        })),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Termination Notice (days)</Label>
                  <Input
                    type="number"
                    placeholder="15"
                    value={form.terminationNoticeDays}
                    onChange={(e) => setForm((f) => ({ ...f, terminationNoticeDays: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Penalty Clause</Label>
                <Input
                  placeholder="e.g. ₹500/day for delays"
                  value={form.penaltyClause}
                  onChange={(e) => setForm((f) => ({ ...f, penaltyClause: e.target.value }))}
                />
              </div>

              {/* Payment schedule */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Payment Schedule</Label>
                  {totalPct !== 100 && form.paymentSchedule.length > 0 && (
                    <span className="text-[11px] text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Total: {totalPct}%
                    </span>
                  )}
                </div>
                {form.paymentSchedule.map((m, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-center">
                    <Input
                      placeholder="Label"
                      value={m.label}
                      onChange={(e) => updateMilestone(i, { label: e.target.value })}
                      className="col-span-2 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="%"
                      value={m.percentage}
                      onChange={(e) => updateMilestone(i, { percentage: Number(e.target.value) })}
                      className="text-xs"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-[#8A8A8A] truncate">₹{Math.round(m.amount).toLocaleString("en-IN")}</span>
                      <button type="button" onClick={() => removeMilestone(i)} className="text-red-400 hover:text-red-600 ml-auto">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMilestone}
                  className="w-full text-xs text-[#A0700A] border border-dashed border-[#A0700A] rounded-lg py-2 hover:bg-[#FFF8E8] transition-colors"
                >
                  + Add Milestone
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  onClick={goStep3}
                  disabled={!step2Valid}
                  className="flex-1 bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
                >
                  Next: Clauses <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Clauses ── */}
          {step === 3 && (
            <div className="space-y-4">
              <ClausesEditor
                clauses={form.clauses}
                onChange={(clauses) => setForm((f) => ({ ...f, clauses }))}
                contractType="contractor"
                onResetToDefaults={() => setForm((f) => ({ ...f, clauses: getDefaultClauses("contractor") }))}
              />

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button variant="outline" onClick={handleSaveAsDraft} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Save as Draft
                </Button>
                <Button
                  onClick={handleSaveAndDownload}
                  disabled={saving}
                  className="flex-1 bg-[#0A0A0A] text-white hover:bg-[#1A1A1A]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                  Save & PDF
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
