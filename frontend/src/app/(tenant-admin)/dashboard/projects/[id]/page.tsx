"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Check,
  Loader2,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  KeyRound,
  UserPlus,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { useInvoices } from "@/hooks/useInvoices";
import { useFinance } from "@/hooks/useFinance";
import { useEmployees } from "@/hooks/useEmployees";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Color constants ──────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  planning:    { bg: "#EEF2FF", text: "#4B56D2" },
  in_progress: { bg: "#E8F4FD", text: "#1D6FA4" },
  on_hold:     { bg: "#FFF8E8", text: "#A0700A" },
  completed:   { bg: "#EDFBF3", text: "#1A7A47" },
  cancelled:   { bg: "#FFF0F0", text: "#B83232" },
};

const STATUS_LABELS: Record<string, string> = {
  planning:    "Planning",
  in_progress: "In Progress",
  on_hold:     "On Hold",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

const FILE_TYPE_LABELS: Record<string, string> = {
  floor_plan:     "Floor Plan",
  render_3d:      "3D Render",
  mood_board:     "Mood Board",
  material_board: "Material Board",
  drawing:        "Drawing",
  site_photo:     "Site Photo",
  document:       "Document",
  other:          "Other",
};

const INVOICE_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  draft:   { bg: "#F3F4F6", text: "#6B7280" },
  sent:    { bg: "#E8F4FD", text: "#1D6FA4" },
  partial: { bg: "#FFF8E8", text: "#A0700A" },
  paid:    { bg: "#EDFBF3", text: "#1A7A47" },
  overdue: { bg: "#FFF0F0", text: "#B83232" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(timestamp: any): string {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: number | undefined): string {
  if (!amount) return "₹0";
  return amount >= 100000
    ? `₹${(amount / 100000).toFixed(1)}L`
    : `₹${amount.toLocaleString("en-IN")}`;
}

function timeAgo(ts: any): string {
  const ms = ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime();
  const diff = Date.now() - ms;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-5 pb-8">
      <div className="h-6 w-48 rounded-lg animate-pulse" style={{ background: "var(--glass-border-in)" }} />
      <div className="h-10 w-72 rounded-lg animate-pulse" style={{ background: "var(--glass-border-in)" }} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-24 rounded-lg animate-pulse" style={{ background: "var(--glass-border-in)" }} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-[14px] animate-pulse" style={{ background: "var(--glass-border-in)" }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Detail Page ─────────────────────────────────────────────────────────
export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);

  const {
    projects,
    loading,
    updateProject,
    updatePhase,
    updateTask,
    assignRole,
  } = useProjects(tenantId);

  const project = projects.find((p) => p.id === id);

  const { files, uploading, uploadFile, toggleClientVisibility, deleteFile } =
    useProjectFiles(tenantId, id);

  const { invoices, createInvoice, updateInvoiceStatus } = useInvoices(tenantId, id);
  const {
    getProjectFinanceSummary,
    createVendorBill,
    vendorBills: allVendorBills,
    recordVendorPayment,
  } = useFinance(tenantId);

  const { employees } = useEmployees(tenantId);
  const currentUser = useCurrentUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "overview" | "files" | "team" | "timeline" | "finance"
  >("overview");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Client access
  const [clientAccessOpen, setClientAccessOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [clientAccessSaving, setClientAccessSaving] = useState(false);
  const [clientTempPassword, setClientTempPassword] = useState<string | null>(null);

  // File upload
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileMetaOpen, setFileMetaOpen] = useState(false);
  const [fileMeta, setFileMeta] = useState({
    type: "document",
    phase: "",
    visibleToClient: false,
    notes: "",
  });

  // Invoice form
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    description: "",
    amount: "",
    dueDate: "",
  });
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  // Vendor bill form
  const [billFormOpen, setBillFormOpen] = useState(false);
  const [billForm, setBillForm] = useState({
    vendorName: "",
    category: "Materials",
    amount: "",
    dueDate: "",
  });
  const [billSaving, setBillSaving] = useState(false);

  // Inline edit: project name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const isProjectOwner =
    currentUser.roles.includes("owner") || currentUser.roles.includes("project_manager");

  const financeSummary = useMemo(
    () => (project ? getProjectFinanceSummary(project.id) : null),
    [project, getProjectFinanceSummary]
  );

  const projectVendorBills = useMemo(
    () => allVendorBills.filter((b) => b.projectId === id),
    [allVendorBills, id]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleGiveClientAccess = async () => {
    if (!tenantId || !clientEmail || !project) return;
    setClientAccessSaving(true);
    try {
      const res = await fetch("/api/auth/create-client-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId: id,
          clientEmail,
          clientName: project.clientName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client_access_granted",
          to: clientEmail,
          clientName: project.clientName,
          projectName: project.projectName || project.clientName,
          tenantName: tenant?.name,
          loginUrl: `${window.location.origin}/${tenantId}/login`,
          tempPassword: data.tempPassword,
        }),
      }).catch(() => {});
      setClientTempPassword(data.tempPassword || null);
      toast({ title: "Client access granted!" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to grant access", variant: "destructive" });
    } finally {
      setClientAccessSaving(false);
    }
  };

  const handleFileUpload = async () => {
    if (!pendingFile) return;
    const uid = currentUser.firebaseUser?.uid || "unknown";
    const ok = await uploadFile({
      file: pendingFile,
      type: fileMeta.type as any,
      phase: fileMeta.phase || undefined,
      visibleToClient: fileMeta.visibleToClient,
      notes: fileMeta.notes || undefined,
      uploadedBy: uid,
    });
    if (ok) {
      setFileMetaOpen(false);
      setPendingFile(null);
      setFileMeta({ type: "document", phase: "", visibleToClient: false, notes: "" });
      toast({ title: "File uploaded" });
    } else {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const handleCreateInvoice = async () => {
    if (!project || !invoiceForm.amount || !invoiceForm.dueDate) return;
    setInvoiceSaving(true);
    try {
      await createInvoice({
        projectId: id,
        clientId: project.clientAuthUid || "",
        clientEmail: project.clientEmail || "",
        clientName: project.clientName,
        amount: Number(invoiceForm.amount),
        dueDate: new Date(invoiceForm.dueDate),
        description: invoiceForm.description || undefined,
      });
      setInvoiceFormOpen(false);
      setInvoiceForm({ description: "", amount: "", dueDate: "" });
      toast({ title: "Invoice created" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to create invoice", variant: "destructive" });
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleCreateVendorBill = async () => {
    if (!billForm.vendorName || !billForm.amount || !billForm.dueDate) return;
    setBillSaving(true);
    try {
      await createVendorBill({
        projectId: id,
        vendorName: billForm.vendorName,
        amount: Number(billForm.amount),
        dueDate: new Date(billForm.dueDate),
        description: billForm.category || undefined,
      });
      setBillFormOpen(false);
      setBillForm({ vendorName: "", category: "Materials", amount: "", dueDate: "" });
      toast({ title: "Vendor bill added" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to add bill", variant: "destructive" });
    } finally {
      setBillSaving(false);
    }
  };

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (loading || !project) return <LoadingSkeleton />;

  const sc = STATUS_COLOR[project.status] || STATUS_COLOR.planning;

  // ── Tab components (inline) ──────────────────────────────────────────────────

  // OVERVIEW TAB
  const OverviewTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Left: Project Info + Phase summary */}
      <div className="md:col-span-2 space-y-4">
        {/* Project Info card */}
        <div className="glass-card rounded-[14px] p-5 space-y-4">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-500)" }}
          >
            Project Info
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Editable project name */}
            <div>
              <p className="text-[10px] mb-1" style={{ color: "var(--fg-400)" }}>
                Project Name
              </p>
              {editingName ? (
                <Input
                  autoFocus
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={() => {
                    if (nameValue.trim()) {
                      updateProject(id, { projectName: nameValue.trim() });
                    }
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (nameValue.trim()) {
                        updateProject(id, { projectName: nameValue.trim() });
                      }
                      setEditingName(false);
                    }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="h-8 text-[13px]"
                />
              ) : (
                <p
                  className="text-[14px] font-semibold cursor-text hover:underline"
                  style={{ color: "var(--fg-900)" }}
                  onClick={() => {
                    setNameValue(project.projectName || "");
                    setEditingName(true);
                  }}
                >
                  {project.projectName || project.clientName}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] mb-1" style={{ color: "var(--fg-400)" }}>
                City
              </p>
              <p className="text-[14px]" style={{ color: "var(--fg-900)" }}>
                {project.clientCity || "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] mb-1" style={{ color: "var(--fg-400)" }}>
                Start Date
              </p>
              <p className="text-[14px]" style={{ color: "var(--fg-900)" }}>
                {formatDate(project.startDate)}
              </p>
            </div>
            <div>
              <p className="text-[10px] mb-1" style={{ color: "var(--fg-400)" }}>
                Expected End
              </p>
              <p className="text-[14px]" style={{ color: "var(--fg-900)" }}>
                {formatDate(project.expectedEndDate)}
              </p>
            </div>
          </div>
          {/* Overall progress */}
          <div>
            <div
              className="flex justify-between text-[11px] mb-1.5"
              style={{ color: "var(--fg-500)" }}
            >
              <span>Overall Progress</span>
              <span className="font-semibold">{project.projectProgress || 0}%</span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--glass-border-in)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${project.projectProgress || 0}%`,
                  background: "var(--brand)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Phase summary */}
        {project.phases.length > 0 && (
          <div className="glass-card rounded-[14px] p-5 space-y-3">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--fg-500)" }}
            >
              Phases
            </p>
            {project.phases.map((phase) => {
              const phSc = STATUS_COLOR[phase.status] || STATUS_COLOR.planning;
              return (
                <div key={phase.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: "var(--fg-900)" }}
                      >
                        {phase.name}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: phSc.bg, color: phSc.text }}
                      >
                        {STATUS_LABELS[phase.status]}
                      </span>
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--fg-500)" }}>
                      {phase.tasks?.length || 0} tasks · {(phase as any).progressPercentage || 0}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--glass-border-in)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(phase as any).progressPercentage || 0}%`,
                        background: "var(--brand)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Client info + Budget tracker */}
      <div className="space-y-4">
        {/* Client Info */}
        <div className="glass-card rounded-[14px] p-5 space-y-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--fg-500)" }}
          >
            Client Info
          </p>
          {[
            { label: "Name",  value: project.clientName },
            { label: "Phone", value: project.clientPhone || "-" },
            { label: "Email", value: project.clientEmail || "-" },
            { label: "City",  value: project.clientCity || "-" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px]" style={{ color: "var(--fg-400)" }}>{label}</p>
              <p className="text-[13px] font-medium" style={{ color: "var(--fg-900)" }}>
                {value}
              </p>
            </div>
          ))}
          {project.clientAccessEmail && (
            <div
              className="flex items-center gap-1.5 text-[12px] pt-2 border-t"
              style={{ borderColor: "var(--glass-border-in)", color: "#1A7A47" }}
            >
              <Check className="h-3.5 w-3.5" />
              Portal access granted
            </div>
          )}
        </div>

        {/* Budget tracker */}
        {financeSummary && (
          <div className="glass-card rounded-[14px] p-5 space-y-3">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--fg-500)" }}
            >
              Budget Tracker
            </p>
            <div className="text-[24px] font-bold" style={{ color: "var(--fg-900)" }}>
              {formatAmount(project.totalAmount)}
            </div>
            {[
              { label: "Invoiced",     value: financeSummary.totalInvoiced,     color: "var(--brand)" },
              { label: "Received",     value: financeSummary.totalReceived,     color: "var(--green)" },
              { label: "Vendor Bills", value: financeSummary.totalVendorBills,  color: "var(--amber)" },
            ].map(({ label, value, color }) => {
              const pct = project.totalAmount
                ? Math.min(100, Math.round((value / project.totalAmount) * 100))
                : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span style={{ color: "var(--fg-500)" }}>{label}</span>
                    <span style={{ color }}>{formatAmount(value)}</span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--glass-border-in)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
            <div
              className="flex justify-between text-[12px] pt-1 border-t"
              style={{ borderColor: "var(--glass-border-in)" }}
            >
              <span style={{ color: "var(--fg-500)" }}>Outstanding</span>
              <span className="font-bold" style={{ color: "var(--red)" }}>
                {formatAmount(financeSummary.outstanding)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // FILES TAB
  const FilesTab = () => (
    <div className="space-y-5">
      {/* Upload zone */}
      <div
        className="border-2 border-dashed rounded-[12px] p-8 text-center"
        style={{ borderColor: "var(--glass-border-in)" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) {
            setPendingFile(f);
            setFileMetaOpen(true);
          }
        }}
      >
        <Upload
          className="h-8 w-8 mx-auto mb-2"
          style={{ color: "var(--fg-400)" }}
        />
        <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>
          Drag & drop or{" "}
          <label
            className="cursor-pointer font-semibold"
            style={{ color: "var(--brand)" }}
          >
            browse
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPendingFile(f);
                  setFileMetaOpen(true);
                }
              }}
            />
          </label>
        </p>
        <p className="text-[11px] mt-1" style={{ color: "var(--fg-400)" }}>
          Supports images, PDFs, and documents
        </p>
      </div>

      {/* Files grouped by type */}
      {Object.entries(FILE_TYPE_LABELS).map(([typeKey, typeLabel]) => {
        const group = files.filter((f) => f.type === typeKey);
        if (!group.length) return null;
        return (
          <div key={typeKey}>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--fg-500)" }}
            >
              {typeLabel}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {group.map((file) => (
                <div
                  key={file.id}
                  className="glass-card rounded-[10px] p-3 space-y-2"
                >
                  <p
                    className="text-[12px] font-medium truncate"
                    style={{ color: "var(--fg-900)" }}
                  >
                    {file.name}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--fg-400)" }}>
                    {file.size ? `${(file.size / 1024).toFixed(0)}KB · ` : ""}
                    {file.createdAt ? timeAgo(file.createdAt) : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--brand)" }}
                      />
                    </a>
                    <button
                      onClick={() =>
                        toggleClientVisibility(file.id, !file.visibleToClient)
                      }
                      title={
                        file.visibleToClient
                          ? "Visible to client (click to hide)"
                          : "Hidden from client (click to show)"
                      }
                    >
                      {file.visibleToClient ? (
                        <Eye
                          className="h-3.5 w-3.5"
                          style={{ color: "#1A7A47" }}
                        />
                      ) : (
                        <EyeOff
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--fg-400)" }}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this file?")) deleteFile(file.id);
                      }}
                    >
                      <Trash2
                        className="h-3.5 w-3.5"
                        style={{ color: "#B83232" }}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {files.length === 0 && (
        <p className="text-center text-[13px] py-8" style={{ color: "var(--fg-400)" }}>
          No files uploaded yet
        </p>
      )}
    </div>
  );

  // TEAM TAB
  const TeamTab = () => {
    const ROLES = [
      {
        role: "designer" as const,
        label: "Designer",
        currentId: project.assignedDesigner,
        filter: (e: (typeof employees)[number]) =>
          e.isActive &&
          (e.roles?.includes("designer") || e.role === "designer"),
      },
      {
        role: "supervisor" as const,
        label: "Site Supervisor",
        currentId: project.assignedSupervisor,
        filter: (e: (typeof employees)[number]) =>
          e.isActive &&
          (e.roles?.includes("site_supervisor") || e.role === "site_supervisor"),
      },
      {
        role: "manager" as const,
        label: "Project Manager",
        currentId: project.assignedTo,
        filter: (e: (typeof employees)[number]) =>
          e.isActive &&
          (e.roles?.includes("project_manager") ||
            e.roles?.includes("owner") ||
            e.role === "project_manager"),
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ROLES.map(({ role, label, currentId, filter }) => {
          const current = employees.find((e) => e.id === currentId);
          const eligible = employees.filter(filter);

          return (
            <div key={role} className="glass-card rounded-[14px] p-5 space-y-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--fg-500)" }}
              >
                {label}
              </p>

              {current ? (
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-[14px] font-bold"
                    style={{ background: "var(--brand-bg)", color: "var(--brand)" }}
                  >
                    {current.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--fg-900)" }}
                    >
                      {current.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--fg-500)" }}>
                      {current.email}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px]" style={{ color: "var(--fg-400)" }}>
                  Unassigned
                </p>
              )}

              {isProjectOwner && (
                <Select
                  value={currentId || ""}
                  onValueChange={(empId) => {
                    const member = employees.find((e) => e.id === empId);
                    if (member) {
                      assignRole(
                        id,
                        role,
                        empId,
                        member.name,
                        member.email
                      );
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue placeholder="Assign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // TIMELINE TAB
  const TimelineTab = () => (
    <div className="space-y-3">
      {project.phases.length === 0 && (
        <p className="text-center text-[13px] py-8" style={{ color: "var(--fg-400)" }}>
          No phases created yet
        </p>
      )}
      {project.phases.map((phase, phaseIndex) => {
        const isExpanded = expandedPhases.has(phase.id);
        const phSc = STATUS_COLOR[phase.status] || STATUS_COLOR.planning;
        const phasePct = (phase as any).progressPercentage || 0;

        return (
          <div
            key={phase.id}
            className="glass-card rounded-[14px] overflow-hidden"
          >
            {/* Phase header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() => togglePhase(phase.id)}
            >
              <div className="flex items-center gap-3">
                {/* Status circle */}
                {phase.status === "completed" ? (
                  <CheckCircle className="h-5 w-5" style={{ color: "#1A7A47" }} />
                ) : phase.status === "in_progress" ? (
                  <div
                    className="h-5 w-5 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: "var(--brand)" }}
                  >
                    <div
                      className="h-2 w-2 rounded-full animate-pulse"
                      style={{ background: "var(--brand)" }}
                    />
                  </div>
                ) : (
                  <Circle className="h-5 w-5" style={{ color: "var(--fg-400)" }} />
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-semibold"
                      style={{ color: "var(--fg-900)" }}
                    >
                      {phase.name}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: phSc.bg, color: phSc.text }}
                    >
                      {STATUS_LABELS[phase.status]}
                    </span>
                    {(phase as any).isDelayed && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#FFF0F0", color: "#B83232" }}
                      >
                        Delayed
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--fg-400)" }}>
                    {phase.tasks?.length || 0} tasks · {phasePct}%
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isProjectOwner && phase.status === "in_progress" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePhase(id, phase.id, "completed");
                    }}
                  >
                    Mark Done
                  </Button>
                )}
                {isExpanded ? (
                  <ChevronDown
                    className="h-4 w-4"
                    style={{ color: "var(--fg-500)" }}
                  />
                ) : (
                  <ChevronRight
                    className="h-4 w-4"
                    style={{ color: "var(--fg-500)" }}
                  />
                )}
              </div>
            </div>

            {/* Phase progress bar */}
            <div className="px-4 pb-0">
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ background: "var(--glass-border-in)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${phasePct}%`, background: "var(--brand)" }}
                />
              </div>
            </div>

            {/* Tasks (expandable) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div
                    className="p-4 pt-3 space-y-2 border-t"
                    style={{ borderColor: "var(--glass-border-in)" }}
                  >
                    {(!phase.tasks || phase.tasks.length === 0) && (
                      <p
                        className="text-[12px] text-center py-2"
                        style={{ color: "var(--fg-400)" }}
                      >
                        No tasks in this phase
                      </p>
                    )}
                    {phase.tasks?.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-[8px]"
                        style={{ background: "var(--glass)" }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={task.status === "completed"}
                          className="h-4 w-4 cursor-pointer"
                          onChange={() =>
                            updateTask(id, phase.id, task.id, {
                              status:
                                task.status === "completed" ? "pending" : "completed",
                            })
                          }
                        />
                        <span
                          className="flex-1 text-[13px]"
                          style={{
                            color: "var(--fg-900)",
                            textDecoration:
                              task.status === "completed" ? "line-through" : "none",
                          }}
                        >
                          {task.name}
                        </span>
                        {(task as any).isOverdue && task.status !== "completed" && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#FFF0F0", color: "#B83232" }}
                          >
                            Overdue
                          </span>
                        )}
                        {task.dueDate && (
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--fg-400)" }}
                          >
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        {/* Progress input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={task.progress || 0}
                            className="w-12 h-6 text-[11px] text-center rounded-[4px] border"
                            style={{
                              background: "var(--glass)",
                              borderColor: "var(--glass-border-in)",
                              color: "var(--fg-900)",
                            }}
                            onBlur={(e) => {
                              const val = Math.min(
                                100,
                                Math.max(0, Number(e.target.value))
                              );
                              updateTask(id, phase.id, task.id, { progress: val });
                            }}
                          />
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--fg-400)" }}
                          >
                            %
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );

  // FINANCE TAB
  const FinanceTab = () => (
    <div className="space-y-6">
      {/* KPI strip */}
      {financeSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Invoiced",    value: financeSummary.totalInvoiced,  color: "var(--brand)" },
            { label: "Received",    value: financeSummary.totalReceived,  color: "var(--green)" },
            { label: "Outstanding", value: financeSummary.outstanding,    color: "var(--red)"   },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card rounded-[12px] p-4">
              <p
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--fg-500)" }}
              >
                {label}
              </p>
              <p
                className="text-[24px] font-bold tabular-nums mt-1"
                style={{ color }}
              >
                {formatAmount(value)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Invoices section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--fg-900)" }}
          >
            Invoices
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-[12px] h-8"
            onClick={() => setInvoiceFormOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Raise Invoice
          </Button>
        </div>

        {/* Inline invoice form */}
        {invoiceFormOpen && (
          <div
            className="glass-card rounded-[12px] p-4 mb-3 space-y-3"
          >
            <p
              className="text-[12px] font-semibold"
              style={{ color: "var(--fg-900)" }}
            >
              New Invoice
            </p>
            <Input
              placeholder="Description"
              value={invoiceForm.description}
              onChange={(e) =>
                setInvoiceForm((f) => ({ ...f, description: e.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Amount (₹)"
                value={invoiceForm.amount}
                onChange={(e) =>
                  setInvoiceForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
              <Input
                type="date"
                value={invoiceForm.dueDate}
                onChange={(e) =>
                  setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={invoiceSaving || !invoiceForm.amount || !invoiceForm.dueDate}
                onClick={handleCreateInvoice}
              >
                {invoiceSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                Create Invoice
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInvoiceFormOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <p className="text-[13px] py-4" style={{ color: "var(--fg-400)" }}>
            No invoices yet
          </p>
        ) : (
          <div
            className="glass-card rounded-[12px] overflow-hidden"
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border-in)",
                    background: "var(--glass)",
                  }}
                >
                  {["#", "Description", "Amount", "Status", "Due", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--fg-500)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isc =
                    INVOICE_STATUS_COLOR[inv.status] || INVOICE_STATUS_COLOR.draft;
                  return (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                    >
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--fg-400)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--fg-900)" }}>
                        {inv.description || "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--fg-900)" }}>
                        {formatAmount(inv.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: isc.bg, color: isc.text }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--fg-400)" }}>
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[11px] h-7"
                            style={{ color: "#1A7A47" }}
                            onClick={() => updateInvoiceStatus(inv.id, "paid")}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vendor Bills section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--fg-900)" }}
          >
            Vendor Bills
          </p>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-[12px] h-8"
            onClick={() => setBillFormOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Bill
          </Button>
        </div>

        {/* Inline bill form */}
        {billFormOpen && (
          <div className="glass-card rounded-[12px] p-4 mb-3 space-y-3">
            <p className="text-[12px] font-semibold" style={{ color: "var(--fg-900)" }}>
              New Vendor Bill
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Vendor Name"
                value={billForm.vendorName}
                onChange={(e) =>
                  setBillForm((f) => ({ ...f, vendorName: e.target.value }))
                }
              />
              <Select
                value={billForm.category}
                onValueChange={(v) => setBillForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Materials", "Labour", "Equipment", "Other"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Amount (₹)"
                value={billForm.amount}
                onChange={(e) =>
                  setBillForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
              <Input
                type="date"
                value={billForm.dueDate}
                onChange={(e) =>
                  setBillForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={
                  billSaving ||
                  !billForm.vendorName ||
                  !billForm.amount ||
                  !billForm.dueDate
                }
                onClick={handleCreateVendorBill}
              >
                {billSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : null}
                Add Bill
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBillFormOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {projectVendorBills.length === 0 ? (
          <p className="text-[13px] py-4" style={{ color: "var(--fg-400)" }}>
            No vendor bills yet
          </p>
        ) : (
          <div className="glass-card rounded-[12px] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--glass-border-in)",
                    background: "var(--glass)",
                  }}
                >
                  {["Vendor", "Category", "Amount", "Status", "Due", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--fg-500)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectVendorBills.map((bill) => {
                  const bsc =
                    INVOICE_STATUS_COLOR[bill.status] || INVOICE_STATUS_COLOR.draft;
                  return (
                    <tr
                      key={bill.id}
                      style={{ borderBottom: "1px solid var(--glass-border-in)" }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--fg-900)" }}>
                        {bill.vendorName}
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--fg-500)" }}>
                        {bill.category || "-"}
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--fg-900)" }}>
                        {formatAmount(bill.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: bsc.bg, color: bsc.text }}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px]" style={{ color: "var(--fg-400)" }}>
                        {formatDate(bill.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        {bill.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[11px] h-7"
                            style={{ color: "#1A7A47" }}
                            onClick={() =>
                              recordVendorPayment(bill.id, {
                                amount: bill.amount - bill.paidAmount,
                                paidOn: new Date(),
                                method: "bank_transfer",
                              })
                            }
                          >
                            Record Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">
      {/* Back nav */}
      <Link href="/dashboard/projects">
        <button
          className="flex items-center gap-1 text-sm mb-1"
          style={{ color: "var(--fg-500)" }}
        >
          <ChevronLeft className="h-4 w-4" /> All Projects
        </button>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1
            className="text-[22px] font-bold"
            style={{ color: "var(--fg-900)" }}
          >
            {project.projectName || project.clientName}
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
              style={{ background: sc.bg, color: sc.text }}
            >
              {STATUS_LABELS[project.status]}
            </span>
            {project.healthStatus && project.healthStatus !== "on_track" && (
              <span
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: project.healthStatus === "at_risk" ? "#FFF8E8" : "#FFF0F0",
                  color: project.healthStatus === "at_risk" ? "#A0700A" : "#B83232",
                }}
              >
                {project.healthStatus === "at_risk" ? "At Risk" : "Delayed"}
              </span>
            )}
            <span className="text-[12px]" style={{ color: "var(--fg-500)" }}>
              {project.projectProgress || 0}% complete
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick status change */}
          <Select
            value={project.status}
            onValueChange={(v) =>
              updateProject(id, { status: v as any })
            }
          >
            <SelectTrigger className="h-9 w-[140px] text-[12px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Give client access */}
          {!project.clientAccessEmail ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setClientAccessOpen(true)}
            >
              <KeyRound className="h-3.5 w-3.5" /> Give Access
            </Button>
          ) : (
            <div
              className="text-[12px] flex items-center gap-1"
              style={{ color: "#1A7A47" }}
            >
              <Check className="h-3.5 w-3.5" /> Access granted
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 border-b"
        style={{ borderColor: "var(--glass-border-in)" }}
      >
        {(["overview", "files", "team", "timeline", "finance"] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2.5 text-[13px] font-medium capitalize border-b-2 transition-colors"
              style={{
                borderColor:
                  activeTab === tab ? "var(--brand)" : "transparent",
                color:
                  activeTab === tab ? "var(--fg-900)" : "var(--fg-500)",
              }}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {activeTab === "overview"  && <OverviewTab />}
          {activeTab === "files"     && <FilesTab />}
          {activeTab === "team"      && <TeamTab />}
          {activeTab === "timeline"  && <TimelineTab />}
          {activeTab === "finance"   && <FinanceTab />}
        </motion.div>
      </AnimatePresence>

      {/* File metadata dialog */}
      <Dialog
        open={fileMetaOpen}
        onOpenChange={(v) => {
          if (!v) {
            setFileMetaOpen(false);
            setPendingFile(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>File Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: "var(--fg-900)" }}>
              {pendingFile?.name}
            </p>
            <Select
              value={fileMeta.type}
              onValueChange={(v) => setFileMeta((m) => ({ ...m, type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FILE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={fileMeta.phase}
              onValueChange={(v) => setFileMeta((m) => ({ ...m, phase: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Phase (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No phase</SelectItem>
                {project.phases.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fileMeta.visibleToClient}
                onChange={(e) =>
                  setFileMeta((m) => ({ ...m, visibleToClient: e.target.checked }))
                }
              />
              <span className="text-sm" style={{ color: "var(--fg-700)" }}>
                Visible to client
              </span>
            </label>
            <Input
              placeholder="Notes (optional)"
              value={fileMeta.notes}
              onChange={(e) =>
                setFileMeta((m) => ({ ...m, notes: e.target.value }))
              }
            />
            <Button
              className="w-full"
              disabled={uploading}
              onClick={handleFileUpload}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Give Client Access dialog */}
      <Dialog
        open={clientAccessOpen}
        onOpenChange={(v) => {
          if (!v) {
            setClientAccessOpen(false);
            setClientTempPassword(null);
            setClientEmail("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Give Client Access
            </DialogTitle>
          </DialogHeader>
          {clientTempPassword ? (
            <div className="space-y-3 text-center">
              <p className="text-[13px]" style={{ color: "var(--fg-700)" }}>
                Access granted! Share this temporary password:
              </p>
              <code
                className="block text-lg font-mono p-3 rounded-[8px] select-all"
                style={{ background: "var(--brand-bg)", color: "var(--brand)" }}
              >
                {clientTempPassword}
              </code>
              <p className="text-[11px]" style={{ color: "var(--fg-500)" }}>
                Client login: /{tenantId}/login
              </p>
              <Button variant="outline" onClick={() => setClientAccessOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px]" style={{ color: "var(--fg-500)" }}>
                Enter the client&apos;s email address to create their portal account.
              </p>
              <Input
                type="email"
                placeholder="client@email.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={clientAccessSaving || !clientEmail.trim()}
                onClick={handleGiveClientAccess}
              >
                {clientAccessSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Grant Access
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
