"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FolderOpen } from "lucide-react";
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

interface ConvertToProjectModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  tenantId: string;
  employees: Employee[];
  onConverted: (projectId: string) => void;
}

export function ConvertToProjectModal({
  open,
  onClose,
  lead,
  tenantId,
  employees,
  onConverted,
}: ConvertToProjectModalProps) {
  const router = useRouter();

  const [projectName, setProjectName] = useState(`${lead.name} - Interior`);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [designerId, setDesignerId] = useState("none");
  const [supervisorId, setSupervisorId] = useState("none");
  const [managerId, setManagerId] = useState("none");
  const [saving, setSaving] = useState(false);

  const designers   = employees.filter(e => e.isActive && (e.roles.includes("designer")          || e.role === "designer"));
  const supervisors = employees.filter(e => e.isActive && (e.roles.includes("site_supervisor")    || e.role === "site_supervisor"));
  const managers    = employees.filter(e => e.isActive && (e.roles.includes("project_manager")    || e.role === "project_manager"));

  async function handleSubmit() {
    if (!projectName.trim()) return;
    setSaving(true);
    try {
      const db = getDb();

      // 1. Create project (with default phases/tasks)
      const projectId = await createProjectFromLead(lead, tenantId);

      // 2. Patch with additional fields from modal
      const updates: Record<string, any> = {
        name: projectName.trim(),
        updatedAt: serverTimestamp(),
      };
      if (description)            updates.description   = description;
      if (startDate)              updates.startDate      = startDate;
      if (endDate)                updates.targetEndDate  = endDate;
      if (designerId !== "none")  updates.designerId     = designerId;
      if (supervisorId !== "none") updates.supervisorId  = supervisorId;
      if (managerId !== "none")   updates.managerId      = managerId;

      await updateDoc(doc(db, `tenants/${tenantId}/projects`, projectId), updates);

      // 3. Link lead → project
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

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-emerald-600" /> Convert to Project
          </DialogTitle>
          <DialogDescription>
            Create a project from this won lead. Default phases and tasks will be added automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Project Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Project Name *</label>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Project name"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600">Scope / Description</label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
              placeholder="Brief scope of work..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Start Date</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Expected End Date</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Client info (read-only) */}
          <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2.5 text-xs text-gray-500 space-y-0.5">
            <p><span className="font-semibold text-gray-700">Client:</span> {lead.name}</p>
            {lead.email && <p><span className="font-semibold text-gray-700">Email:</span> {lead.email}</p>}
            {lead.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {lead.phone}</p>}
            {lead.estimatedValue > 0 && (
              <p><span className="font-semibold text-gray-700">Budget:</span> ₹{lead.estimatedValue.toLocaleString("en-IN")}</p>
            )}
          </div>

          {/* Team assignment */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Team Assignment</p>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 shrink-0">Designer</span>
                <Select value={designerId} onValueChange={setDesignerId}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {designers.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    {designers.length === 0 && employees.filter(e => e.isActive).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 shrink-0">Site Supervisor</span>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {supervisors.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    {supervisors.length === 0 && employees.filter(e => e.isActive).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-28 shrink-0">Project Manager</span>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {managers.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    {managers.length === 0 && employees.filter(e => e.isActive).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
