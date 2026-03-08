"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead } from "@/hooks/useLeads";
import { createProjectFromLead } from "@/lib/services/projectService";
import { getDb } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface Employee {
  id: string;
  name: string;
  role: string;
  roles: string[];
  isActive: boolean;
}

interface Milestone {
  name: string;
  amount: string;
  dueDate: string;
}

interface ConvertToProjectModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  tenantId: string;
  employees: Employee[];
  estimateData?: any | null;
  onConverted: (projectId: string) => void;
}

export function ConvertToProjectModal({
  open,
  onClose,
  lead,
  tenantId,
  employees,
  estimateData,
  onConverted,
}: ConvertToProjectModalProps) {
  const router = useRouter();

  const [projectName, setProjectName] = useState(`${lead.name} - Interior`);
  const [description, setDescription] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [designerId, setDesignerId] = useState("none");
  const [supervisorId, setSupervisorId] = useState("none");
  const [managerId, setManagerId] = useState("none");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { name: "", amount: "", dueDate: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const designers   = employees.filter(e => e.isActive && (e.roles.includes("designer")       || e.role === "designer"));
  const supervisors = employees.filter(e => e.isActive && (e.roles.includes("site_supervisor") || e.role === "site_supervisor"));
  const managers    = employees.filter(e => e.isActive && (e.roles.includes("project_manager") || e.role === "project_manager"));

  function addMilestone() {
    if (milestones.length >= 3) return;
    setMilestones(m => [...m, { name: "", amount: "", dueDate: "" }]);
  }

  function removeMilestone(idx: number) {
    setMilestones(m => m.filter((_, i) => i !== idx));
  }

  function updateMilestone(idx: number, field: keyof Milestone, value: string) {
    setMilestones(m => m.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSubmit() {
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      const db = getDb();

      const projectId = await createProjectFromLead(lead, tenantId);

      const updates: Record<string, any> = {
        name: projectName.trim(),
        updatedAt: serverTimestamp(),
      };
      if (description)              updates.description       = description;
      if (siteAddress)              updates.address           = siteAddress;
      if (startDate)                updates.startDate          = startDate;
      if (endDate)                  updates.targetEndDate      = endDate;
      if (designerId !== "none")    updates.designerId         = designerId;
      if (supervisorId !== "none")  updates.supervisorId       = supervisorId;
      if (managerId !== "none")     updates.managerId          = managerId;

      const validMilestones = milestones.filter(m => m.name.trim() && m.amount.trim());
      if (validMilestones.length > 0) {
        updates.paymentMilestones = validMilestones;
      }

      await updateDoc(doc(db, `tenants/${tenantId}/projects`, projectId), updates);
      await updateDoc(doc(db, `tenants/${tenantId}/leads`, lead.id), {
        projectId,
        updatedAt: serverTimestamp(),
      });

      onConverted(projectId);
      onClose();
      router.push("/dashboard/projects");
    } catch (err) {
      console.error("Error converting lead to project:", err);
    } finally {
      setSaving(false);
    }
  }

  // Parse estimate summary from data
  const est = estimateData;
  const hasCostSummary = est && (est.materialCost || est.labourCost || est.designFee || est.total);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-emerald-600" /> Convert to Project
          </DialogTitle>
          <DialogDescription>
            Create a project from this won lead. Default phases and tasks will be added automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Project Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Project Name *</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project name" />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Scope / Description</label>
            <textarea
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2"
              style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
              placeholder="Brief scope of work..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Site Address */}
          <div className="space-y-1">
            <label className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Site Address</label>
            <Input
              placeholder="Project site address"
              value={siteAddress}
              onChange={e => setSiteAddress(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Expected End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Client info (read-only) */}
          <div
            className="rounded-lg px-3 py-2.5 text-xs space-y-0.5"
            style={{ background: "var(--brand-bg)", border: "1px solid var(--glass-border-in)", color: "var(--fg-500)" }}
          >
            <p><span className="font-semibold" style={{ color: "var(--fg-700)" }}>Client:</span> {lead.name}</p>
            {lead.email && <p><span className="font-semibold" style={{ color: "var(--fg-700)" }}>Email:</span> {lead.email}</p>}
            {lead.phone && <p><span className="font-semibold" style={{ color: "var(--fg-700)" }}>Phone:</span> {lead.phone}</p>}
            {lead.estimatedValue > 0 && (
              <p><span className="font-semibold" style={{ color: "var(--fg-700)" }}>Budget:</span> ₹{lead.estimatedValue.toLocaleString("en-IN")}</p>
            )}
          </div>

          {/* Cost Breakdown (from estimate) */}
          {hasCostSummary && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Cost Breakdown (from Estimate)</p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--glass-border-in)" }}>
                <table className="w-full text-xs">
                  <tbody>
                    {[
                      { label: "Material", val: est.materialCost },
                      { label: "Labour",   val: est.labourCost },
                      { label: "Design Fee", val: est.designFee },
                      { label: "GST",      val: est.gst },
                    ].map(row => row.val != null && (
                      <tr key={row.label} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                        <td className="px-3 py-1.5" style={{ color: "var(--fg-500)" }}>{row.label}</td>
                        <td className="px-3 py-1.5 text-right" style={{ color: "var(--fg-700)" }}>
                          ₹{Number(row.val).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {est.total != null && (
                      <tr style={{ background: "var(--brand-bg)" }}>
                        <td className="px-3 py-1.5 font-bold" style={{ color: "var(--fg-900)" }}>Total</td>
                        <td className="px-3 py-1.5 text-right font-bold" style={{ color: "var(--brand)" }}>
                          ₹{Number(est.total).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Milestones */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Payment Milestones (max 3)</p>
              {milestones.length < 3 && (
                <button
                  type="button"
                  onClick={addMilestone}
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--brand)" }}
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
            <div className="space-y-2">
              {milestones.map((m, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_80px_100px_24px] gap-2 items-center">
                  <Input
                    placeholder="Milestone name"
                    className="h-8 text-xs"
                    value={m.name}
                    onChange={e => updateMilestone(idx, "name", e.target.value)}
                  />
                  <Input
                    placeholder="₹ Amount"
                    type="number"
                    className="h-8 text-xs"
                    value={m.amount}
                    onChange={e => updateMilestone(idx, "amount", e.target.value)}
                  />
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={m.dueDate}
                    onChange={e => updateMilestone(idx, "dueDate", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeMilestone(idx)}
                    className="flex items-center justify-center rounded p-1 transition-colors hover:bg-red-50"
                    style={{ color: "var(--red)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Team assignment */}
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Team Assignment</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "Designer", value: designerId, setter: setDesignerId, list: designers },
                { label: "Site Supervisor", value: supervisorId, setter: setSupervisorId, list: supervisors },
                { label: "Project Manager", value: managerId, setter: setManagerId, list: managers },
              ].map(({ label, value, setter, list }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs w-28 shrink-0" style={{ color: "var(--fg-500)" }}>{label}</span>
                  <Select value={value} onValueChange={setter}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(list.length > 0 ? list : employees.filter(e => e.isActive)).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            disabled={saving || !projectName.trim()}
            onClick={handleSubmit}
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Creating...</> : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
