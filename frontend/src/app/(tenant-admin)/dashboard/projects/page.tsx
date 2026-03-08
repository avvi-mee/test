"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutGrid, List, ChevronUp, ChevronDown,
  FolderOpen, Plus, X, Loader2, UserPlus, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useProjects, Project } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import { useEmployees } from "@/hooks/useEmployees";
import { useCurrentUser } from "@/hooks/useCurrentUser";

// ── Color constants ─────────────────────────────────────────────────────────
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

const HEALTH_COLOR: Record<string, string> = {
  on_track: "#1A7A47",
  at_risk:  "#A0700A",
  delayed:  "#B83232",
};

const HEALTH_LABELS: Record<string, string> = {
  on_track: "On Track",
  at_risk:  "At Risk",
  delayed:  "Delayed",
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

// ── ProjectCard ──────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  employees,
  onAssign,
}: {
  project: Project;
  employees: ReturnType<typeof useEmployees>["employees"];
  onAssign?: (p: Project) => void;
}) {
  const router = useRouter();
  const sc = STATUS_COLOR[project.status] || STATUS_COLOR.planning;
  const currentPhase =
    project.phases.find((p) => p.status === "in_progress") || project.phases[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="glass-card rounded-[14px] overflow-hidden cursor-pointer hover:shadow-lg"
      style={{ transition: "box-shadow 0.2s" }}
      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
    >
      {/* Status color bar */}
      <div className="h-1" style={{ background: sc.text }} />
      <div className="p-4 space-y-3">
        {/* Name + status pill */}
        <div className="flex items-start justify-between gap-2">
          <h3
            className="text-[14px] font-bold leading-tight"
            style={{ color: "var(--fg-900)" }}
          >
            {project.projectName || project.clientName}
          </h3>
          <span
            className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: sc.bg, color: sc.text }}
          >
            {STATUS_LABELS[project.status]}
          </span>
        </div>

        {/* Client + city */}
        <p className="text-[12px]" style={{ color: "var(--fg-500)" }}>
          {project.clientName}
          {project.clientCity ? ` · ${project.clientCity}` : ""}
        </p>

        {/* Current phase pill */}
        {currentPhase && (
          <span
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--brand-bg)", color: "var(--brand)" }}
          >
            {currentPhase.name}
          </span>
        )}

        {/* Progress bar */}
        <div>
          <div
            className="flex justify-between text-[10px] mb-1"
            style={{ color: "var(--fg-500)" }}
          >
            <span>Progress</span>
            <span>{project.projectProgress || 0}%</span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
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

        {/* Team avatars + budget */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {[project.assignedDesigner, project.assignedSupervisor, project.assignedTo]
              .filter(Boolean)
              .slice(0, 3)
              .map((eid, i) => {
                const emp = employees.find((e) => e.id === eid);
                return (
                  <div
                    key={i}
                    title={emp?.name}
                    className="h-6 w-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: "var(--brand-bg)",
                      color: "var(--brand)",
                      borderColor: "var(--glass)",
                    }}
                  >
                    {(emp?.name || "?").charAt(0).toUpperCase()}
                  </div>
                );
              })}
          </div>
          <span className="text-[12px] font-bold" style={{ color: "var(--fg-700)" }}>
            {formatAmount(project.totalAmount)}
          </span>
        </div>

        {/* Dates */}
        <div
          className="flex items-center gap-1 text-[10px]"
          style={{ color: "var(--fg-400)" }}
        >
          <Calendar className="h-3 w-3" />
          {formatDate(project.startDate)} → {formatDate(project.expectedEndDate)}
        </div>

        {/* View link + assign */}
        <div
          className="pt-2 border-t flex items-center justify-between"
          style={{ borderColor: "var(--glass-border-in)" }}
        >
          <span className="text-[12px] font-semibold" style={{ color: "var(--brand)" }}>
            View Details →
          </span>
          {onAssign && (
            <button
              onClick={(e) => { e.stopPropagation(); onAssign(project); }}
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-opacity hover:opacity-70"
              style={{ background: "var(--brand-bg)", color: "var(--brand)" }}
            >
              <UserPlus className="h-3 w-3" /> Assign
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const GLASS: React.CSSProperties = {
  background: "var(--glass)",
  backdropFilter: "var(--glass-blur)",
  border: "1px solid var(--glass-border-in)",
  boxShadow: "var(--glass-shadow)",
};

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--glass)",
  color: "var(--fg-900)",
  borderColor: "var(--glass-border-in)",
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const router = useRouter();
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const { projects, stats, loading, createProject } = useProjects(tenantId);
  const { getProjectFinanceSummary } = useFinance(tenantId);
  const { employees } = useEmployees(tenantId);
  const currentUser = useCurrentUser();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // New Project drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    projectName: "", clientName: "", clientEmail: "",
    clientPhone: "", clientCity: "", totalAmount: "",
    status: "planning" as Project["status"],
    designerId: "", supervisorId: "", managerId: "",
  });
  const [formError, setFormError] = useState("");

  // Assign modal (quick assign from project card/row)
  const [assignProject, setAssignProject] = useState<Project | null>(null);

  const { roles, employeeId } = currentUser;
  const isProjectOwner =
    roles.includes("owner") || roles.includes("admin") || roles.includes("project_manager");

  async function handleCreateProject() {
    if (!form.projectName.trim() || !form.clientName.trim()) {
      setFormError("Project name and client name are required.");
      return;
    }
    setFormError(""); setSaving(true);
    try {
      const id = await createProject({
        projectName:  form.projectName.trim(),
        clientName:   form.clientName.trim(),
        clientEmail:  form.clientEmail  || undefined,
        clientPhone:  form.clientPhone  || undefined,
        clientCity:   form.clientCity   || undefined,
        totalAmount:  form.totalAmount ? Number(form.totalAmount) : undefined,
        status:       form.status,
        designerId:   form.designerId   || undefined,
        supervisorId: form.supervisorId || undefined,
        managerId:    form.managerId    || undefined,
      });
      if (id) {
        toast({ title: "Project created", description: form.projectName });
        setDrawerOpen(false);
        setForm({ projectName: "", clientName: "", clientEmail: "", clientPhone: "",
          clientCity: "", totalAmount: "", status: "planning",
          designerId: "", supervisorId: "", managerId: "" });
        router.push(`/dashboard/projects/${id}`);
      }
    } catch (err: any) {
      setFormError(err.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  const visibleProjects = useMemo(() => {
    let list = projects.filter((p) => {
      const q = searchQuery.toLowerCase();
      if (
        q &&
        !p.clientName.toLowerCase().includes(q) &&
        !(p.projectName?.toLowerCase().includes(q))
      )
        return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
    if (!isProjectOwner) {
      list = list.filter(
        (p) =>
          p.assignedTo === employeeId ||
          p.assignedDesigner === employeeId ||
          p.assignedSupervisor === employeeId
      );
    }
    return [...list].sort((a, b) => {
      const av: any = (a as any)[sortField] ?? 0;
      const bv: any = (b as any)[sortField] ?? 0;
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [projects, searchQuery, statusFilter, sortField, sortDir, isProjectOwner, employeeId]);

  const totalValue = useMemo(
    () => projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    [projects]
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field)
      return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: "var(--brand)" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page title + New Project button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: "var(--fg-900)" }}>
            Projects
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-500)" }}>
            {stats.inProgress} active · {stats.completed} completed
          </p>
        </div>
        {isProjectOwner && (
          <button
            onClick={() => { setFormError(""); setDrawerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand)" }}
          >
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Planning",    value: stats.planning,          color: "var(--fg-900)" },
          { label: "In Progress", value: stats.inProgress,        color: "var(--brand)"  },
          { label: "At Risk",     value: stats.atRisk,            color: "var(--amber)"  },
          { label: "Total Value", value: formatAmount(totalValue), color: "var(--green)"  },
        ].map((c) => (
          <div key={c.label} className="glass-card rounded-[12px] p-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--fg-500)" }}
            >
              {c.label}
            </p>
            <p
              className="text-[26px] font-bold tabular-nums mt-1"
              style={{ color: c.color }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter + view toggle bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status tab pills */}
        <div
          className="flex gap-1 p-1 rounded-[10px]"
          style={{
            background: "var(--glass)",
            border: "1px solid var(--glass-border-in)",
          }}
        >
          {["all", "planning", "in_progress", "on_hold", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="text-[12px] font-semibold px-3 py-1 rounded-[8px] transition-colors"
              style={{
                background: statusFilter === s ? "var(--brand)" : "transparent",
                color: statusFilter === s ? "#fff" : "var(--fg-500)",
              }}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: "var(--fg-500)" }}
          />
          <Input
            className="pl-9 h-9"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Cards / Table toggle */}
        <div
          className="flex rounded-[8px] overflow-hidden"
          style={{ border: "1px solid var(--glass-border-in)" }}
        >
          <button
            onClick={() => setViewMode("cards")}
            className="px-3 py-2 transition-colors"
            style={{
              background: viewMode === "cards" ? "var(--brand)" : "var(--glass)",
              color: viewMode === "cards" ? "#fff" : "var(--fg-500)",
            }}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className="px-3 py-2 transition-colors"
            style={{
              background: viewMode === "table" ? "var(--brand)" : "var(--glass)",
              color: viewMode === "table" ? "#fff" : "var(--fg-500)",
            }}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {visibleProjects.length === 0 && (
        <div className="py-16 text-center">
          <FolderOpen
            className="h-10 w-10 mx-auto mb-3"
            style={{ color: "var(--fg-400)" }}
          />
          <p className="text-[14px]" style={{ color: "var(--fg-500)" }}>
            No projects found
          </p>
          <p className="text-[12px] mt-1" style={{ color: "var(--fg-400)" }}>
            Projects are auto-created when leads are approved
          </p>
        </div>
      )}

      {/* Cards view */}
      {viewMode === "cards" && visibleProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProjects.map((p) => (
            <ProjectCard key={p.id} project={p} employees={employees}
              onAssign={isProjectOwner ? setAssignProject : undefined} />
          ))}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && visibleProjects.length > 0 && (
        <div
          className="glass-card rounded-[14px] overflow-hidden"
          style={{ border: "1px solid var(--glass-border-in)" }}
        >
          <Table>
            <TableHeader>
              <TableRow
                className="border-b hover:bg-transparent"
                style={{
                  borderColor: "var(--glass-border-in)",
                  background: "var(--glass)",
                }}
              >
                {[
                  { label: "Project",  field: "projectName" },
                  { label: "Client",   field: "clientName" },
                  { label: "Status",   field: "status" },
                  { label: "Health",   field: "healthStatus" },
                  { label: "Progress", field: "projectProgress" },
                  { label: "Team",     field: null },
                  { label: "Budget",   field: "totalAmount" },
                  { label: "Created",  field: "createdAt" },
                  { label: "",         field: null },
                ].map(({ label, field }) => (
                  <TableHead
                    key={label}
                    className="text-[10px] font-semibold uppercase tracking-wider select-none"
                    style={{ color: "var(--fg-500)" }}
                    onClick={() => field && handleSort(field)}
                  >
                    {field ? (
                      <span className="flex items-center gap-1 cursor-pointer">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    ) : (
                      label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProjects.map((p) => {
                const sc = STATUS_COLOR[p.status] || STATUS_COLOR.planning;
                const hColor = HEALTH_COLOR[p.healthStatus || "on_track"];
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer border-b"
                    style={{ borderColor: "var(--glass-border-in)" }}
                    onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                  >
                    <TableCell>
                      <span
                        className="font-semibold text-[13px]"
                        style={{ color: "var(--fg-900)" }}
                      >
                        {p.projectName || p.clientName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[13px]" style={{ color: "var(--fg-700)" }}>
                        {p.clientName}
                      </span>
                      {p.clientCity && (
                        <span
                          className="block text-[11px]"
                          style={{ color: "var(--fg-400)" }}
                        >
                          {p.clientCity}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {STATUS_LABELS[p.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: hColor }}
                      >
                        {HEALTH_LABELS[p.healthStatus || "on_track"]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 w-16 rounded-full overflow-hidden"
                          style={{ background: "var(--glass-border-in)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.projectProgress || 0}%`,
                              background: "var(--brand)",
                            }}
                          />
                        </div>
                        <span
                          className="text-[11px] tabular-nums"
                          style={{ color: "var(--fg-500)" }}
                        >
                          {p.projectProgress || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-1.5">
                        {[p.assignedDesigner, p.assignedSupervisor, p.assignedTo]
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((eid, i) => {
                            const emp = employees.find((e) => e.id === eid);
                            return (
                              <div
                                key={i}
                                title={emp?.name}
                                className="h-6 w-6 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                                style={{
                                  background: "var(--brand-bg)",
                                  color: "var(--brand)",
                                  borderColor: "var(--glass)",
                                }}
                              >
                                {(emp?.name || "?").charAt(0).toUpperCase()}
                              </div>
                            );
                          })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: "var(--fg-700)" }}
                      >
                        {formatAmount(p.totalAmount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[12px]" style={{ color: "var(--fg-400)" }}>
                        {formatDate(p.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[12px] h-7"
                        style={{ color: "var(--brand)" }}
                        onClick={() => router.push(`/dashboard/projects/${p.id}`)}
                      >
                        View →
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── New Project Drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setDrawerOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md overflow-y-auto"
              style={{ background: "var(--glass)", backdropFilter: "var(--glass-blur)",
                borderLeft: "1px solid var(--glass-border-in)" }}>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold" style={{ color: "var(--fg-900)" }}>New Project</h2>
                  <button onClick={() => setDrawerOpen(false)} style={{ color: "var(--fg-500)" }}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {[
                  { label: "Project Name *", key: "projectName", placeholder: "e.g. Sharma Residence Interior" },
                  { label: "Client Name *",  key: "clientName",  placeholder: "e.g. Rahul Sharma" },
                  { label: "Client Email",   key: "clientEmail", placeholder: "client@email.com" },
                  { label: "Client Phone",   key: "clientPhone", placeholder: "+91 98765 43210" },
                  { label: "City",           key: "clientCity",  placeholder: "e.g. Mumbai" },
                  { label: "Budget (₹)",     key: "totalAmount", placeholder: "e.g. 500000" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="space-y-1.5">
                    <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>{label}</label>
                    <input type="text" placeholder={placeholder}
                      value={(form as any)[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                      style={INPUT_STYLE} />
                  </div>
                ))}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Status</label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as any }))}>
                    <SelectTrigger className="h-10 text-sm" style={INPUT_STYLE}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Team assignment */}
                <div className="space-y-1 pt-1">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--fg-400)" }}>
                    Assign Team (optional)
                  </p>
                </div>
                {[
                  { label: "Designer",         key: "designerId",   filterRole: ["designer"] },
                  { label: "Site Supervisor",  key: "supervisorId", filterRole: ["site_supervisor"] },
                  { label: "Project Manager",  key: "managerId",    filterRole: ["project_manager", "owner", "admin"] },
                ].map(({ label, key, filterRole }) => {
                  const eligible = employees.filter((e) =>
                    e.isActive && e.roles?.some((r: string) => filterRole.includes(r))
                  );
                  return (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-semibold" style={{ color: "var(--fg-700)" }}>{label}</label>
                      <Select value={(form as any)[key] || "none"}
                        onValueChange={(v) => setForm((f) => ({ ...f, [key]: v === "none" ? "" : v }))}>
                        <SelectTrigger className="h-10 text-sm" style={INPUT_STYLE}>
                          <SelectValue placeholder={`Select ${label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Unassigned —</SelectItem>
                          {eligible.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}

                {formError && <p className="text-xs" style={{ color: "var(--red)" }}>{formError}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setDrawerOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={GLASS}>
                    Cancel
                  </button>
                  <button onClick={handleCreateProject} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                    style={{ background: "var(--brand)", opacity: saving ? 0.7 : 1 }}>
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Project"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Quick Assign Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {assignProject && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={() => setAssignProject(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={GLASS}>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold" style={{ color: "var(--fg-900)" }}>
                    Assign Team — {assignProject.projectName || assignProject.clientName}
                  </h2>
                  <button onClick={() => setAssignProject(null)} style={{ color: "var(--fg-500)" }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs" style={{ color: "var(--fg-500)" }}>
                  Go to project detail to assign team members using the Team tab.
                </p>
                <button
                  onClick={() => { router.push(`/dashboard/projects/${assignProject.id}?tab=team`); setAssignProject(null); }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "var(--brand)" }}>
                  Open Project → Team Tab
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
