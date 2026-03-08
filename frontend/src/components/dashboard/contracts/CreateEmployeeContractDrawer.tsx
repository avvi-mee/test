"use client";

import { useState, useCallback, useEffect } from "react";
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
  Download,
} from "lucide-react";
import type { ContractClause, EmployeeContractFields } from "@/types/contracts";
import { generateContractPdf } from "@/lib/generateContractPdf";

interface CreateEmployeeContractDrawerProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  partyAName: string;
  partyAEmail: string;
  onCreated: (contractId: string) => void;
  prefill?: {
    employeeId?: string;
    title?: string;
    partyBName?: string;
    partyBEmail?: string;
    partyBPhone?: string;
    designation?: string;
    joiningDate?: string;
  };
}

type Step = 1 | 2 | 3;

interface FormState {
  title: string;
  partyAName: string;
  partyAEmail: string;
  partyBName: string;
  partyBEmail: string;
  partyBPhone: string;
  // Custom fields
  designation: string;
  department: string;
  joiningDate: string;
  probationDays: number | "";
  noticePeriodDays: number | "";
  salary: number | "";
  leaveEntitlement: number | "";
  workingHoursPerWeek: number | "";
  startDate: string;
  endDate: string;
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
  designation: "",
  department: "",
  joiningDate: "",
  probationDays: 90,
  noticePeriodDays: 30,
  salary: "",
  leaveEntitlement: 21,
  workingHoursPerWeek: 48,
  startDate: "",
  endDate: "",
  clauses: [],
};

export function CreateEmployeeContractDrawer({
  open,
  onClose,
  tenantId,
  partyAName,
  partyAEmail,
  onCreated,
  prefill,
}: CreateEmployeeContractDrawerProps) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY, partyAName, partyAEmail });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { createContract } = useContracts(tenantId);

  const reset = useCallback(() => {
    setStep(1);
    setForm({ ...EMPTY, partyAName, partyAEmail });
  }, [partyAName, partyAEmail]);

  useEffect(() => {
    if (!open || !prefill) return;
    setForm((f) => ({
      ...f,
      title:       prefill.title       || f.title,
      partyBName:  prefill.partyBName  || f.partyBName,
      partyBEmail: prefill.partyBEmail || f.partyBEmail,
      partyBPhone: prefill.partyBPhone || f.partyBPhone,
      designation: prefill.designation || f.designation,
      joiningDate: prefill.joiningDate || f.joiningDate,
    }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => { onClose(); reset(); };

  const step1Valid = form.title && form.partyBName && form.partyBEmail;
  const step2Valid = form.designation && form.salary && form.joiningDate;

  const goStep3 = () => {
    if (form.clauses.length === 0) {
      setForm((f) => ({ ...f, clauses: getDefaultClauses("employee") }));
    }
    setStep(3);
  };

  const buildContractData = (contractNumber: string) => {
    const customFields: EmployeeContractFields = {
      employeeId: prefill?.employeeId,
      designation: form.designation,
      department: form.department || undefined,
      salary: typeof form.salary === "number" ? form.salary : 0,
      salaryBreakdown: [],
      joiningDate: form.joiningDate,
      probationDays: typeof form.probationDays === "number" ? form.probationDays : undefined,
      noticePeriodDays: typeof form.noticePeriodDays === "number" ? form.noticePeriodDays : undefined,
      workingHoursPerWeek: typeof form.workingHoursPerWeek === "number" ? form.workingHoursPerWeek : undefined,
      leaveEntitlement: typeof form.leaveEntitlement === "number" ? form.leaveEntitlement : undefined,
    };
    return {
      tenantId,
      contractNumber,
      type: "employee" as const,
      title: form.title,
      status: "draft" as const,
      partyA: { name: form.partyAName || partyAName, email: form.partyAEmail || partyAEmail },
      partyB: {
        name: form.partyBName,
        email: form.partyBEmail,
        phone: form.partyBPhone || undefined,
      },
      startDate: form.startDate || form.joiningDate || undefined,
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
              <FileSignature className="h-5 w-5 text-[#1A7A47]" />
              New Employee Contract
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  step === s ? "bg-[#1A7A47]" : step > s ? "bg-[#1A7A47]/40" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Parties + Title ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Contract Title *</Label>
                <Input
                  placeholder="e.g. Employment Agreement – John Doe"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Employee (Party B)</Label>
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
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Company (Party A)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Company name"
                    value={form.partyAName}
                    onChange={(e) => setForm((f) => ({ ...f, partyAName: e.target.value }))}
                    className="text-sm"
                  />
                  <Input
                    type="email"
                    placeholder="Company email"
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
                  Next: Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Compensation + Position ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Designation *</Label>
                  <Input
                    placeholder="e.g. Interior Designer"
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Input
                    placeholder="e.g. Design"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Gross Salary (₹/month) *</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.salary}
                    onChange={(e) => setForm((f) => ({ ...f, salary: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Joining Date *</Label>
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => setForm((f) => ({ ...f, joiningDate: e.target.value, startDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Probation (days)</Label>
                  <Input
                    type="number"
                    placeholder="90"
                    value={form.probationDays}
                    onChange={(e) => setForm((f) => ({ ...f, probationDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notice Period (days)</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={form.noticePeriodDays}
                    onChange={(e) => setForm((f) => ({ ...f, noticePeriodDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Leave Days/yr</Label>
                  <Input
                    type="number"
                    placeholder="21"
                    value={form.leaveEntitlement}
                    onChange={(e) => setForm((f) => ({ ...f, leaveEntitlement: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Working Hours/Week</Label>
                  <Input
                    type="number"
                    placeholder="48"
                    value={form.workingHoursPerWeek}
                    onChange={(e) => setForm((f) => ({ ...f, workingHoursPerWeek: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date (if fixed-term)</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
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
                contractType="employee"
                onResetToDefaults={() => setForm((f) => ({ ...f, clauses: getDefaultClauses("employee") }))}
              />

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={saving}
                  className="flex-1"
                >
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
