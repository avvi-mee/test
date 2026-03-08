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
  Download,
} from "lucide-react";
import type { ContractClause, VendorAgreementFields } from "@/types/contracts";
import { generateContractPdf } from "@/lib/generateContractPdf";

interface CreateVendorAgreementDrawerProps {
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
  // Agreement
  vendorCategory: string;
  supplyItems: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  renewalNoticeDays: number | "";
  // Commercial
  creditPeriodDays: number | "";
  deliveryTerms: string;
  discountPercent: number | "";
  // Quality
  qualityStandards: string;
  exclusivity: boolean;
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
  vendorCategory: "",
  supplyItems: "",
  startDate: "",
  endDate: "",
  autoRenew: false,
  renewalNoticeDays: 30,
  creditPeriodDays: 30,
  deliveryTerms: "",
  discountPercent: "",
  qualityStandards: "",
  exclusivity: false,
  clauses: [],
};

export function CreateVendorAgreementDrawer({
  open,
  onClose,
  tenantId,
  partyAName,
  partyAEmail,
  onCreated,
}: CreateVendorAgreementDrawerProps) {
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

  const step1Valid = form.title && form.partyBName;
  const step2Valid = form.startDate;

  const goStep3 = () => {
    if (form.clauses.length === 0) {
      setForm((f) => ({ ...f, clauses: getDefaultClauses("vendor") }));
    }
    setStep(3);
  };

  const buildContractData = (contractNumber: string) => {
    const customFields: VendorAgreementFields = {
      vendorCategory: form.vendorCategory || undefined,
      supplyItems: form.supplyItems || undefined,
      creditPeriodDays: typeof form.creditPeriodDays === "number" ? form.creditPeriodDays : undefined,
      discountPercent: typeof form.discountPercent === "number" ? form.discountPercent : undefined,
      deliveryTerms: form.deliveryTerms || undefined,
      qualityStandards: form.qualityStandards || undefined,
      exclusivity: form.exclusivity || undefined,
    };
    return {
      tenantId,
      contractNumber,
      type: "vendor" as const,
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
      autoRenew: form.autoRenew || undefined,
      renewalNoticeDays: form.autoRenew && typeof form.renewalNoticeDays === "number" ? form.renewalNoticeDays : undefined,
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
              <FileSignature className="h-5 w-5 text-[#6B4FBB]" />
              New Vendor Agreement
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2">
            {([1, 2, 3] as const).map((s) => (
              <div
                key={s}
                className={`h-2 w-2 rounded-full transition-colors ${
                  step === s ? "bg-[#6B4FBB]" : step > s ? "bg-[#6B4FBB]/40" : "bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* ── Step 1: Parties ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Agreement Title *</Label>
                <Input
                  placeholder="e.g. Furniture Supply Agreement"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor (Party B)</Label>
                <Input
                  placeholder="Vendor name *"
                  value={form.partyBName}
                  onChange={(e) => setForm((f) => ({ ...f, partyBName: e.target.value }))}
                  className="text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    placeholder="Email"
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
                  Next: Details <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 2: Agreement + Commercial ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Vendor Category</Label>
                  <Input
                    placeholder="e.g. Furniture, Lighting"
                    value={form.vendorCategory}
                    onChange={(e) => setForm((f) => ({ ...f, vendorCategory: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Supply Items</Label>
                  <Input
                    placeholder="e.g. Sofas, chairs"
                    value={form.supplyItems}
                    onChange={(e) => setForm((f) => ({ ...f, supplyItems: e.target.value }))}
                  />
                </div>
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={form.autoRenew}
                  onChange={(e) => setForm((f) => ({ ...f, autoRenew: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="autoRenew" className="cursor-pointer">Auto-renew on expiry</Label>
                {form.autoRenew && (
                  <div className="flex items-center gap-1 ml-4">
                    <Label className="text-xs text-gray-500 whitespace-nowrap">Notice (days):</Label>
                    <Input
                      type="number"
                      value={form.renewalNoticeDays}
                      onChange={(e) => setForm((f) => ({ ...f, renewalNoticeDays: Number(e.target.value) }))}
                      className="w-20 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Credit Period (days)</Label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={form.creditPeriodDays}
                    onChange={(e) => setForm((f) => ({ ...f, creditPeriodDays: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Discount (%)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.discountPercent}
                    onChange={(e) => setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Delivery Terms</Label>
                <Input
                  placeholder="e.g. Ex-works, FOB"
                  value={form.deliveryTerms}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryTerms: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Quality Standards</Label>
                <Input
                  placeholder="e.g. ISO 9001, ISI certified"
                  value={form.qualityStandards}
                  onChange={(e) => setForm((f) => ({ ...f, qualityStandards: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="exclusivity"
                  checked={form.exclusivity}
                  onChange={(e) => setForm((f) => ({ ...f, exclusivity: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="exclusivity" className="cursor-pointer">Exclusivity agreement</Label>
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
                contractType="vendor"
                onResetToDefaults={() => setForm((f) => ({ ...f, clauses: getDefaultClauses("vendor") }))}
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
