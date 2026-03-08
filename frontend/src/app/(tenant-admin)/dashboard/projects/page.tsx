"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Eye,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  Activity,
  X,
  User,
  Briefcase,
  IndianRupee,
  Paperclip,
  MessageSquare,
  Send,
  UserPlus,
  KeyRound,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects, Project } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import { useEmployees } from "@/hooks/useEmployees";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityLogEntry } from "@/lib/services/projectService";

// ── Color tables (Structured Luxury palette) ────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  planning:    "bg-[#EEF2FF] text-[#4B56D2]",
  in_progress: "bg-[#E8F4FD] text-[#1D6FA4]",
  on_hold:     "bg-[#FFF8E8] text-[#A0700A]",
  completed:   "bg-[#EDFBF3] text-[#1A7A47]",
  cancelled:   "bg-[#FFF0F0] text-[#B83232]",
};

const HEALTH_PILL: Record<string, string> = {
  on_track: "bg-[#EDFBF3] text-[#1A7A47]",
  at_risk:  "bg-[#FFF8E8] text-[#A0700A]",
  delayed:  "bg-[#FFF0F0] text-[#B83232]",
};

const HEALTH_DOT: Record<string, string> = {
  on_track: "bg-[#1A7A47]",
  at_risk:  "bg-[#A0700A]",
  delayed:  "bg-[#B83232]",
};

const STATUS_LABELS: Record<string, string> = {
  planning:    "Planning",
  in_progress: "In Progress",
  on_hold:     "On Hold",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

const HEALTH_LABELS: Record<string, string> = {
  on_track: "On Track",
  at_risk:  "At Risk",
  delayed:  "Delayed",
};

const TASK_STATUS_OPTIONS = ["pending", "in_progress", "completed"] as const;

export default function ProjectsPage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const {
    projects, stats, loading,
    updateProject, updatePhase, updateTask, fetchActivityLog,
    addTaskAttachment, addTaskComment, assignRole,
  } = useProjects(tenantId);
  const { getProjectFinanceSummary } = useFinance(tenantId);
  const { employees } = useEmployees(tenantId);
  const currentUser = useCurrentUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "phases" | "activity" | "finance">("overview");

  const { toast } = useToast();

  // Client access modal state
  const [clientAccessOpen, setClientAccessOpen] = useState(false);
  const [clientAccessEmail, setClientAccessEmail] = useState("");
  const [clientAccessSaving, setClientAccessSaving] = useState(false);
  const [clientAccessResult, setClientAccessResult] = useState<{ tempPassword?: string } | null>(null);

  // Comment panel state
  const [openCommentTaskId, setOpenCommentTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentIsInternal, setCommentIsInternal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFileUpload, setPendingFileUpload] = useState<{ projectId: string; phaseId: string; taskId: string } | null>(null);

  const searchLower = searchQuery.toLowerCase();
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.clientName.toLowerCase().includes(searchLower) ||
      p.projectName?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { roles, employeeId } = currentUser;
  const isProjectOwner = roles.includes("owner") || roles.includes("project_manager");
  const visibleProjects = useMemo(() => {
    if (isProjectOwner) return filteredProjects;
    return filteredProjects.filter(
      (p) =>
        p.assignedTo       === employeeId ||
        p.assignedDesigner === employeeId ||
        p.assignedSupervisor === employeeId
    );
  }, [filteredProjects, isProjectOwner, employeeId]);

  const totalValue = useMemo(
    () => projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [projects]
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-IN", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const formatAmount = (amount: number | undefined) => {
    if (!amount) return "₹0";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  const openDetails = async (project: Project) => {
    setSelectedProject(project);
    setIsDetailsOpen(true);
    setActiveTab("overview");
    setExpandedPhases(new Set());
    setOpenCommentTaskId(null);
    const log = await fetchActivityLog(project.id);
    setActivityLog(log);
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    await updateProject(projectId, { status: newStatus as Project["status"] });
    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...selectedProject, status: newStatus as Project["status"] });
    }
  };

  const handleTaskStatusChange = async (
    projectId: string,
    phaseId: string,
    taskId: string,
    newStatus: string
  ) => {
    await updateTask(projectId, phaseId, taskId, { status: newStatus as any });
  };

  const handleTaskProgressChange = async (
    projectId: string,
    phaseId: string,
    taskId: string,
    progress: number
  ) => {
    await updateTask(projectId, phaseId, taskId, { progress });
  };

  const handleAssignProject = async (projectId: string, empId: string) => {
    await updateProject(projectId, { assignedTo: empId });
    if (selectedProject?.id === projectId) {
      setSelectedProject({ ...selectedProject, assignedTo: empId });
    }
  };

  const handleAssignRole = async (
    role: "designer" | "supervisor" | "manager",
    empId: string
  ) => {
    if (!selectedProject) return;
    const member = employees.find(e => e.id === empId);
    const memberName = member?.name || "Unknown";
    const memberEmail = member?.email;
    await assignRole(selectedProject.id, role, empId, memberName, memberEmail);
  };

  const handleGiveClientAccess = async () => {
    if (!selectedProject || !tenantId || !clientAccessEmail) return;
    setClientAccessSaving(true);
    try {
      const res = await fetch("/api/auth/create-client-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          projectId: selectedProject.id,
          clientEmail: clientAccessEmail,
          clientName: selectedProject.clientName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Send welcome email
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client_access_granted",
          to: clientAccessEmail,
          clientName: selectedProject.clientName,
          projectName: selectedProject.projectName || selectedProject.clientName,
          tenantName: tenant?.name,
          loginUrl: `${window.location.origin}/${tenantId}/login`,
          tempPassword: data.tempPassword ?? undefined,
        }),
      }).catch(() => {});

      setClientAccessResult(data.tempPassword ? { tempPassword: data.tempPassword } : null);
      toast({ title: "Client access granted!" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to grant access", variant: "destructive" });
    } finally {
      setClientAccessSaving(false);
    }
  };

  const handleFileUpload = (projectId: string, phaseId: string, taskId: string) => {
    setPendingFileUpload({ projectId, phaseId, taskId });
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileUpload) return;
    const { projectId, phaseId, taskId } = pendingFileUpload;
    const uploadedBy = currentUser.employeeId || currentUser.firebaseUser?.uid || "unknown";
    await addTaskAttachment(projectId, phaseId, taskId, file, uploadedBy);
    setPendingFileUpload(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddComment = async (projectId: string, phaseId: string, taskId: string) => {
    if (!commentText.trim()) return;
    const authorId = currentUser.employeeId || currentUser.firebaseUser?.uid || "unknown";
    const authorName = currentUser.firebaseUser?.displayName || "Admin";
    await addTaskComment(projectId, phaseId, taskId, commentText.trim(), authorId, authorName, commentIsInternal);
    setCommentText("");
    setCommentIsInternal(false);
  };

  // Keep selectedProject in sync with live data
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p) => p.id === selectedProject.id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  const financeSummary = selectedProject ? getProjectFinanceSummary(selectedProject.id) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E8A020]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for attachments */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileSelected}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[20px] font-bold text-[#0A0A0A]">Projects</h1>
          <p className="text-[13px] text-[#8A8A8A] mt-0.5">
            {stats.inProgress} active · {stats.completed} completed
          </p>
        </div>
      </div>

      {/* Stats bar — 4 KPI chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#8A8A8A] mb-1">Planning</p>
          <p className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">{stats.planning}</p>
        </div>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#8A8A8A] mb-1">In Progress</p>
          <p className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">{stats.inProgress}</p>
        </div>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#8A8A8A] mb-1">At Risk</p>
          <p className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">{stats.atRisk}</p>
        </div>
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#8A8A8A] mb-1">Total Value</p>
          <p className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(totalValue)}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 h-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8A8A]" />
          <input
            placeholder="Search by client name or project type..."
            className="w-full h-10 pl-9 pr-3 text-[13px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[8px] text-[#0A0A0A] placeholder-[#B0B0B0] focus:outline-none focus:border-[rgba(0,0,0,0.20)] transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-[150px] text-[13px] border-[rgba(0,0,0,0.08)] rounded-[8px] bg-white">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.08)] overflow-hidden">
        {visibleProjects.length === 0 ? (
          <div className="p-12 text-center">
            <Briefcase className="h-10 w-10 text-[#D0D0D0] mx-auto mb-3" />
            <p className="text-[14px] text-[#8A8A8A]">No projects found</p>
            <p className="text-[12px] text-[#B0B0B0] mt-1">Projects are auto-created when leads are approved</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-[rgba(0,0,0,0.06)] hover:bg-transparent bg-[rgba(0,0,0,0.015)]">
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Project</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Client</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Health</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Progress</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Assigned To</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Created</TableHead>
                <TableHead className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-[rgba(0,0,0,0.02)] border-b border-[rgba(0,0,0,0.04)]"
                  onClick={() => openDetails(project)}
                >
                  <TableCell>
                    <div className="text-[14px] font-semibold text-[#0A0A0A]">
                      {project.projectName || project.clientName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-[13px] font-medium text-[#0A0A0A]">{project.clientName}</div>
                    <div className="text-[11px] text-[#8A8A8A]">{project.clientPhone}</div>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_PILL[project.status] || "bg-[#F0F0F0] text-[#8A8A8A]")}>
                      {STATUS_LABELS[project.status] || project.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", HEALTH_PILL[project.healthStatus || "on_track"])}>
                      {HEALTH_LABELS[project.healthStatus || "on_track"]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#E8A020] rounded-full transition-all"
                          style={{ width: `${project.projectProgress || 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-[#8A8A8A]">{project.projectProgress || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {project.assignedTo ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-[#E8A020]/20 flex items-center justify-center text-[#E8A020] text-[10px] font-bold">
                          {(employees.find(e => e.id === project.assignedTo)?.name || "?").charAt(0)}
                        </div>
                        <span className="text-[13px] text-[#0A0A0A]">
                          {employees.find(e => e.id === project.assignedTo)?.name || "Unassigned"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-[#B0B0B0] italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-[#8A8A8A]">
                    {formatDate(project.createdAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      className="flex items-center gap-1 text-[12px] font-medium text-[#8A8A8A] hover:text-[#0A0A0A] border border-[rgba(0,0,0,0.08)] rounded-[6px] px-2.5 py-1 hover:border-[rgba(0,0,0,0.16)] transition-all"
                      onClick={() => openDetails(project)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Project Details — right-side drawer */}
      {isDetailsOpen && selectedProject && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setIsDetailsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[640px] max-w-full z-50 bg-white shadow-[var(--shadow-modal)] flex flex-col">

            {/* Panel header */}
            <div className="shrink-0 px-6 py-4 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#0A0A0A]">
                  {selectedProject.projectName || `${selectedProject.clientName}'s Project`}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_PILL[selectedProject.status])}>
                    {STATUS_LABELS[selectedProject.status]}
                  </span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", HEALTH_PILL[selectedProject.healthStatus || "on_track"])}>
                    {HEALTH_LABELS[selectedProject.healthStatus || "on_track"]}
                  </span>
                  <span className="text-[12px] text-[#8A8A8A]">{selectedProject.projectProgress || 0}% complete</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedProject.status}
                  onValueChange={(val) => handleStatusChange(selectedProject.id, val)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-[12px] border-[rgba(0,0,0,0.08)] rounded-[8px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="p-1.5 hover:bg-[rgba(0,0,0,0.04)] rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-[#8A8A8A]" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 px-6 border-b border-[rgba(0,0,0,0.06)] flex gap-1">
              {(["overview", "phases", "activity", "finance"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2.5 text-[13px] font-medium capitalize transition-colors border-b-2",
                    activeTab === tab
                      ? "border-[#E8A020] text-[#0A0A0A]"
                      : "border-transparent text-[#8A8A8A] hover:text-[#0A0A0A]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Overview Tab ── */}
              {activeTab === "overview" && (
                <>
                  {/* Client info */}
                  <div className="bg-[rgba(0,0,0,0.02)] rounded-[10px] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-3">Client Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Name</p>
                        <p className="text-[13px] font-medium text-[#0A0A0A]">{selectedProject.clientName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Phone</p>
                        <p className="text-[13px] font-medium text-[#0A0A0A]">{selectedProject.clientPhone}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Email</p>
                        <p className="text-[13px] font-medium text-[#0A0A0A]">{selectedProject.clientEmail}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">City</p>
                        <p className="text-[13px] font-medium text-[#0A0A0A]">{selectedProject.clientCity || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Project meta */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Project Name</p>
                      <p className="text-[13px] font-bold text-[#0A0A0A]">{selectedProject.projectName || "-"}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Start Date</p>
                      <p className="text-[13px] font-bold text-[#0A0A0A]">{formatDate(selectedProject.startDate)}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Target End</p>
                      <p className="text-[13px] font-bold text-[#0A0A0A]">{formatDate(selectedProject.expectedEndDate)}</p>
                    </div>
                  </div>

                  {/* Budget + assignment */}
                  <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Project Budget</p>
                      <p className="text-[28px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(selectedProject.totalAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-2">Assigned To</p>
                      <Select
                        value={selectedProject.assignedTo || "unassigned"}
                        onValueChange={(val) => val !== "unassigned" && handleAssignProject(selectedProject.id, val)}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-[12px] border-[rgba(0,0,0,0.08)] rounded-[8px]">
                          <SelectValue>
                            {employees.find(e => e.id === selectedProject.assignedTo)?.name || "Unassigned"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" disabled>Assign to...</SelectItem>
                          {employees.filter((e) => e.isActive).map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Role assignments */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-3">Role Assignments</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-2">Designer</p>
                        <Select
                          value={selectedProject.assignedDesigner || "unassigned"}
                          onValueChange={(val) => val !== "unassigned" && handleAssignRole("designer", val)}
                        >
                          <SelectTrigger className="h-8 text-[12px] border-[rgba(0,0,0,0.08)] rounded-[8px]">
                            <SelectValue>
                              {employees.find(e => e.id === selectedProject.assignedDesigner)?.name || "Unassigned"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" disabled>Assign designer...</SelectItem>
                            {employees
                              .filter((e) => e.isActive && (e.role === "designer" || e.roles?.includes("designer")))
                              .map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-2">Supervisor</p>
                        <Select
                          value={selectedProject.assignedSupervisor || "unassigned"}
                          onValueChange={(val) => val !== "unassigned" && handleAssignRole("supervisor", val)}
                        >
                          <SelectTrigger className="h-8 text-[12px] border-[rgba(0,0,0,0.08)] rounded-[8px]">
                            <SelectValue>
                              {employees.find(e => e.id === selectedProject.assignedSupervisor)?.name || "Unassigned"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" disabled>Assign supervisor...</SelectItem>
                            {employees
                              .filter((e) => e.isActive && (e.role === "site_supervisor" || e.roles?.includes("site_supervisor")))
                              .map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-2">Manager</p>
                        <Select
                          value={selectedProject.assignedTo || "unassigned"}
                          onValueChange={(val) => val !== "unassigned" && handleAssignRole("manager", val)}
                        >
                          <SelectTrigger className="h-8 text-[12px] border-[rgba(0,0,0,0.08)] rounded-[8px]">
                            <SelectValue>
                              {employees.find(e => e.id === selectedProject.assignedTo)?.name || "Unassigned"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned" disabled>Assign manager...</SelectItem>
                            {employees
                              .filter((e) => e.isActive && (e.role === "manager" || e.roles?.includes("manager")))
                              .map((emp) => (
                                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Overall progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-[#0A0A0A]">Overall Progress</span>
                      <span className="text-[13px] font-bold tabular-nums text-[#0A0A0A]">{selectedProject.projectProgress || 0}%</span>
                    </div>
                    <div className="w-full h-2 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E8A020] rounded-full transition-all"
                        style={{ width: `${selectedProject.projectProgress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Client Access */}
                  {(roles.includes("owner") || roles.includes("admin")) && (
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] flex items-center gap-1.5">
                          <KeyRound className="h-3 w-3" /> Client Access
                        </p>
                        {!(selectedProject as any).clientAccessEmail && (
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] gap-1"
                            onClick={() => {
                              setClientAccessEmail(selectedProject.clientEmail || "");
                              setClientAccessResult(null);
                              setClientAccessOpen(true);
                            }}
                          >
                            <UserPlus className="h-3 w-3" /> Give Access
                          </Button>
                        )}
                      </div>
                      {(selectedProject as any).clientAccessEmail ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-700">
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Access granted to <strong>{(selectedProject as any).clientAccessEmail}</strong></span>
                        </div>
                      ) : (
                        <p className="text-xs text-[#8A8A8A]">Client has not been granted portal access yet.</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Phases Tab ── */}
              {activeTab === "phases" && (
                <div className="space-y-3">
                  {selectedProject.phases.map((phase) => (
                    <div
                      key={phase.id}
                      className={cn(
                        "border rounded-[10px] overflow-hidden",
                        phase.status === "in_progress"
                          ? "border-l-4 border-l-[#E8A020] border-[rgba(0,0,0,0.08)]"
                          : phase.status === "completed"
                          ? "border-l-4 border-l-[#1A7A47] border-[rgba(0,0,0,0.08)]"
                          : "border-[rgba(0,0,0,0.08)]"
                      )}
                    >
                      <button
                        onClick={() => togglePhase(phase.id)}
                        className="w-full flex items-center justify-between p-4 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.04)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {expandedPhases.has(phase.id) ? (
                            <ChevronDown className="h-4 w-4 text-[#8A8A8A]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#8A8A8A]" />
                          )}
                          <span className="text-[13px] font-semibold text-[#0A0A0A]">{phase.name}</span>
                          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_PILL[phase.status] || "bg-[#F0F0F0] text-[#8A8A8A]")}>
                            {STATUS_LABELS[phase.status] || phase.status}
                          </span>
                          {phase.isDelayed && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF0F0] text-[#B83232]">Delayed</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-1.5 bg-[rgba(0,0,0,0.06)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#E8A020] rounded-full"
                              style={{ width: `${phase.progressPercentage || 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-[#8A8A8A] w-8">{phase.progressPercentage || 0}%</span>
                        </div>
                      </button>

                      {expandedPhases.has(phase.id) && (
                        <div className="p-3 space-y-2">
                          {phase.tasks.map((task) => (
                            <div key={task.id} className="bg-white border border-[rgba(0,0,0,0.06)] rounded-[8px]">
                              <div className="flex items-center justify-between p-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  {task.status === "completed" ? (
                                    <CheckCircle className="h-4 w-4 text-[#1A7A47] shrink-0" />
                                  ) : task.isOverdue ? (
                                    <AlertTriangle className="h-4 w-4 text-[#B83232] shrink-0" />
                                  ) : task.status === "in_progress" ? (
                                    <Clock className="h-4 w-4 text-[#1D6FA4] shrink-0" />
                                  ) : (
                                    <div className="h-4 w-4 rounded-full border-2 border-[rgba(0,0,0,0.16)] shrink-0" />
                                  )}
                                  <span className={cn(
                                    "text-[13px] truncate",
                                    task.status === "completed" ? "text-[#B0B0B0] line-through" : "text-[#0A0A0A]"
                                  )}>
                                    {task.name}
                                  </span>
                                  {task.isOverdue && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#B83232] shrink-0">Overdue</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Progress slider */}
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="range"
                                      min={0}
                                      max={100}
                                      step={10}
                                      value={task.progress ?? 0}
                                      onChange={(e) =>
                                        handleTaskProgressChange(
                                          selectedProject.id,
                                          phase.id,
                                          task.id,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-16 h-1.5 accent-[#E8A020]"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="text-[10px] font-medium text-[#8A8A8A] w-7">{task.progress ?? 0}%</span>
                                  </div>

                                  {/* Attachment button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFileUpload(selectedProject.id, phase.id, task.id);
                                    }}
                                    className="p-1 hover:bg-[rgba(0,0,0,0.04)] rounded transition-colors"
                                    title="Upload file"
                                  >
                                    <Paperclip className="h-3.5 w-3.5 text-[#8A8A8A]" />
                                  </button>

                                  {/* Comment toggle */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenCommentTaskId(openCommentTaskId === task.id ? null : task.id);
                                    }}
                                    className="p-1 hover:bg-[rgba(0,0,0,0.04)] rounded transition-colors relative"
                                    title="Comments"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5 text-[#8A8A8A]" />
                                    {(task.comments?.length || 0) > 0 && (
                                      <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#E8A020] text-white text-[8px] rounded-full flex items-center justify-center">
                                        {task.comments.length}
                                      </span>
                                    )}
                                  </button>

                                  {task.dueDate && (
                                    <span className="text-[11px] text-[#8A8A8A]">{formatDate(task.dueDate)}</span>
                                  )}
                                  <Select
                                    value={task.status}
                                    onValueChange={(val) => handleTaskStatusChange(selectedProject.id, phase.id, task.id, val)}
                                  >
                                    <SelectTrigger className="h-7 w-[110px] text-[11px] border-[rgba(0,0,0,0.08)] rounded-[6px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TASK_STATUS_OPTIONS.map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Attachments list */}
                              {(task.attachments?.length || 0) > 0 && (
                                <div className="px-3 pb-2 flex flex-wrap gap-2">
                                  {task.attachments.map((att, idx) => (
                                    <a
                                      key={idx}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-[#1D6FA4] hover:text-[#0F4A7A] bg-[#E8F4FD] px-2 py-0.5 rounded"
                                    >
                                      <Paperclip className="h-3 w-3" />
                                      {att.name}
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Comment panel */}
                              {openCommentTaskId === task.id && (
                                <div className="border-t border-[rgba(0,0,0,0.06)] px-3 py-3 space-y-2 bg-[rgba(0,0,0,0.015)]">
                                  {(task.comments?.length || 0) > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                      {task.comments.map((c) => (
                                        <div key={c.id} className="text-[12px]">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-[#0A0A0A]">{c.authorName}</span>
                                            {c.isInternal && (
                                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#FFF8E8] text-[#A0700A]">Internal</span>
                                            )}
                                            <span className="text-[#B0B0B0]">{formatDateTime(c.createdAt)}</span>
                                          </div>
                                          <p className="text-[#4A4A4A] mt-0.5">{c.text}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={commentText}
                                      onChange={(e) => setCommentText(e.target.value)}
                                      placeholder="Add a comment..."
                                      className="flex-1 h-7 text-[12px] bg-white border border-[rgba(0,0,0,0.08)] rounded-[6px] px-2 focus:outline-none focus:border-[rgba(0,0,0,0.16)] placeholder-[#B0B0B0]"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                          e.preventDefault();
                                          handleAddComment(selectedProject.id, phase.id, task.id);
                                        }
                                      }}
                                    />
                                    <label className="flex items-center gap-1 text-[10px] text-[#8A8A8A] cursor-pointer whitespace-nowrap">
                                      <input
                                        type="checkbox"
                                        checked={commentIsInternal}
                                        onChange={(e) => setCommentIsInternal(e.target.checked)}
                                        className="h-3 w-3"
                                      />
                                      Internal
                                    </label>
                                    <button
                                      onClick={() => handleAddComment(selectedProject.id, phase.id, task.id)}
                                      className="p-1 hover:bg-[rgba(0,0,0,0.06)] rounded transition-colors"
                                    >
                                      <Send className="h-3.5 w-3.5 text-[#E8A020]" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Activity Tab ── */}
              {activeTab === "activity" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-4">Activity Log</p>

                  {/* Project timeline (embedded array) */}
                  <div className="relative pl-4 border-l-2 border-[rgba(0,0,0,0.08)] space-y-4 mb-6">
                    {selectedProject.timeline?.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-[#E8A020] border-2 border-white" />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-medium text-[#0A0A0A]">{event.action}</p>
                            {event.note && (
                              <p className="text-[12px] text-[#8A8A8A] mt-0.5 italic">&quot;{event.note}&quot;</p>
                            )}
                          </div>
                          <span className="text-[11px] text-[#B0B0B0] whitespace-nowrap">{formatDateTime(event.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detailed activity log (subcollection) */}
                  {activityLog.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-3">Detailed Activity</p>
                      <div className="space-y-2">
                        {activityLog.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between bg-[rgba(0,0,0,0.02)] rounded-[8px] p-3">
                            <div>
                              <p className="text-[13px] text-[#0A0A0A]">{entry.action}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] text-[#8A8A8A] capitalize">{entry.entityType}</p>
                                {entry.performedByName && (
                                  <span className="text-[11px] text-[#B0B0B0]">by {entry.performedByName}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] text-[#B0B0B0]">{formatDateTime(entry.timestamp)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Finance Tab ── */}
              {activeTab === "finance" && financeSummary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Total Invoiced</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(financeSummary.totalInvoiced)}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Received</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#1A7A47]">{formatAmount(financeSummary.totalReceived)}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Outstanding</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#A0700A]">{formatAmount(financeSummary.outstanding)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Vendor Bills</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(financeSummary.totalVendorBills)}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Paid to Vendors</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(financeSummary.totalPaidToVendors)}</p>
                    </div>
                    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-[10px] p-3">
                      <p className="text-[10px] text-[#8A8A8A] uppercase tracking-wide mb-1">Remaining Payable</p>
                      <p className="text-[20px] font-bold tabular-nums text-[#B83232]">{formatAmount(financeSummary.remainingPayable)}</p>
                    </div>
                  </div>

                  {financeSummary.invoices.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-3">Invoices</p>
                      <div className="space-y-2">
                        {financeSummary.invoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between bg-[rgba(0,0,0,0.02)] rounded-[8px] p-3">
                            <div>
                              <span className="text-[13px] font-medium text-[#0A0A0A]">{inv.invoiceNumber}</span>
                              <span className="text-[11px] text-[#8A8A8A] ml-2">{inv.clientName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[13px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(inv.amount)}</span>
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_PILL[inv.status] || "bg-[#F0F0F0] text-[#8A8A8A]")}>
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {financeSummary.vendorBills.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8A] mb-3">Vendor Bills</p>
                      <div className="space-y-2">
                        {financeSummary.vendorBills.map((bill) => (
                          <div key={bill.id} className="flex items-center justify-between bg-[rgba(0,0,0,0.02)] rounded-[8px] p-3">
                            <span className="text-[13px] font-medium text-[#0A0A0A]">{bill.vendorName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[13px] font-bold tabular-nums text-[#0A0A0A]">{formatAmount(bill.amount)}</span>
                              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", STATUS_PILL[bill.status] || "bg-[#F0F0F0] text-[#8A8A8A]")}>
                                {bill.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {financeSummary.invoices.length === 0 && financeSummary.vendorBills.length === 0 && (
                    <div className="text-center py-8">
                      <IndianRupee className="h-10 w-10 mx-auto mb-3 text-[#D0D0D0]" />
                      <p className="text-[14px] text-[#8A8A8A]">No financial records yet</p>
                      <p className="text-[12px] text-[#B0B0B0] mt-1">Create invoices and vendor bills from the Finance page</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Client Access Modal */}
      <Dialog open={clientAccessOpen} onOpenChange={v => { if (!v) { setClientAccessOpen(false); setClientAccessResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-600" /> Give Client Access
            </DialogTitle>
            <DialogDescription>
              The client will receive login credentials for their project portal.
            </DialogDescription>
          </DialogHeader>

          {clientAccessResult ? (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 space-y-2">
                <p className="font-semibold flex items-center gap-1.5"><CheckCircle className="h-4 w-4" /> Access granted!</p>
                {clientAccessResult.tempPassword && (
                  <div>
                    <p>Temporary password: <strong className="font-mono">{clientAccessResult.tempPassword}</strong></p>
                    <p className="text-xs mt-1 text-emerald-600">Share this with the client. They can change it after logging in.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setClientAccessOpen(false); setClientAccessResult(null); }}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Client Email *</label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={clientAccessEmail}
                  onChange={e => setClientAccessEmail(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">
                A new account will be created (or an existing account will be linked) for this email.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setClientAccessOpen(false)}>Cancel</Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  disabled={clientAccessSaving || !clientAccessEmail}
                  onClick={handleGiveClientAccess}
                >
                  {clientAccessSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Granting...</> : "Grant Access"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
