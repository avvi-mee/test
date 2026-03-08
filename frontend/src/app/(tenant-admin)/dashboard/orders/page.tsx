"use client";

import Link from "next/link";
import { useState, useMemo, type ReactNode } from "react";
import { useContracts } from "@/hooks/useContracts";
import { CreateClientContractDrawer } from "@/components/dashboard/contracts/CreateClientContractDrawer";
import { ContractDetailDrawer } from "@/components/dashboard/contracts/ContractDetailDrawer";
import { ContractStatusBadge } from "@/components/dashboard/contracts/ContractStatusBadge";
import type { Contract, ClientContractFields } from "@/types/contracts";
import {
  Search,
  Eye,
  Package,
  X,
  XCircle,
  User,
  Activity,
  Phone,
  Calendar,
  Flame,
  Thermometer,
  Snowflake,
  Plus,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Sliders,
  Loader2,
  LayoutGrid,
  List,
  GripVertical,
  FileSignature,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { ConvertToProjectModal } from "@/components/projects/ConvertToProjectModal";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useLeads, Lead, isValidTransition, classifyLeadsByBudget } from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFollowUps, FollowUp } from "@/hooks/useFollowUps";
import { useEmployees } from "@/hooks/useEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
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

// ─── Static Lookup Tables ─────────────────────────────────────────────────────

const STAGES = [
  "new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal_sent: "Proposal Sent", negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const STAGE_BORDER: Record<string, string> = {
  new: "border-l-[#4B56D2]", contacted: "border-l-[#1D6FA4]", qualified: "border-l-[#A0700A]",
  proposal_sent: "border-l-[#6B4FBB]", negotiation: "border-l-[#9B2158]",
  won: "border-l-[#1A7A47]", lost: "border-l-[#B83232]",
};

const STAGE_DOT: Record<string, string> = {
  new: "bg-[#4B56D2]", contacted: "bg-[#1D6FA4]", qualified: "bg-[#A0700A]",
  proposal_sent: "bg-[#6B4FBB]", negotiation: "bg-[#9B2158]",
  won: "bg-[#1A7A47]", lost: "bg-[#B83232]",
};

const STAGE_PILL: Record<string, string> = {
  new:           "bg-[#4B56D2]/20 text-[#818CF8]",
  contacted:     "bg-[#1D6FA4]/20 text-[#67B8E4]",
  qualified:     "bg-[#A0700A]/20 text-[#F6AD55]",
  proposal_sent: "bg-[#6B4FBB]/20 text-[#B794F4]",
  negotiation:   "bg-[#9B2158]/20 text-[#F6739B]",
  won:           "bg-[#1A7A47]/20 text-[#68D391]",
  lost:          "bg-[#B83232]/20 text-[#FC8181]",
};

const TEMP_DOT: Record<string, string> = {
  hot:  "bg-[#C0392B]",
  warm: "bg-[#C06B1A]",
  cold: "bg-[#2255BB]",
};
const TEMP_PILL: Record<string, string> = {
  hot:  "bg-[#C0392B]/20 text-[#FC8181]",
  warm: "bg-[#C06B1A]/20 text-[#FBBF24]",
  cold: "bg-[#2255BB]/20 text-[#93C5FD]",
};

const STAGE_META: Record<string, {
  topBorder: string; bgTint: string; dotColor: string; textColor: string; badgeBg: string;
}> = {
  new:           { topBorder: "border-[#4B56D2]", bgTint: "bg-[#4B56D2]/[0.06]", dotColor: "bg-[#4B56D2]", textColor: "text-[#818CF8]", badgeBg: "bg-[#4B56D2]/20" },
  contacted:     { topBorder: "border-[#1D6FA4]", bgTint: "bg-[#1D6FA4]/[0.06]", dotColor: "bg-[#1D6FA4]", textColor: "text-[#67B8E4]", badgeBg: "bg-[#1D6FA4]/20" },
  qualified:     { topBorder: "border-[#A0700A]", bgTint: "bg-[#A0700A]/[0.06]", dotColor: "bg-[#A0700A]", textColor: "text-[#F6AD55]", badgeBg: "bg-[#A0700A]/20" },
  proposal_sent: { topBorder: "border-[#6B4FBB]", bgTint: "bg-[#6B4FBB]/[0.06]", dotColor: "bg-[#6B4FBB]", textColor: "text-[#B794F4]", badgeBg: "bg-[#6B4FBB]/20" },
  negotiation:   { topBorder: "border-[#9B2158]", bgTint: "bg-[#9B2158]/[0.06]", dotColor: "bg-[#9B2158]", textColor: "text-[#F6739B]", badgeBg: "bg-[#9B2158]/20" },
  won:           { topBorder: "border-[#1A7A47]", bgTint: "bg-[#1A7A47]/[0.06]", dotColor: "bg-[#1A7A47]", textColor: "text-[#68D391]", badgeBg: "bg-[#1A7A47]/20" },
  lost:          { topBorder: "border-[#B83232]", bgTint: "bg-[#B83232]/[0.06]", dotColor: "bg-[#B83232]", textColor: "text-[#FC8181]", badgeBg: "bg-[#B83232]/20" },
};

const SOURCE_ICON: Record<string, string> = {
  website: "🌐", consultation: "💬", referral: "👥", manual: "✏️", import: "📥",
};

const FOLLOW_UP_TYPES = ["call", "email", "meeting", "site_visit", "whatsapp"] as const;
const FOLLOWUP_EMOJI: Record<string, string> = {
  call: "📞", email: "📧", meeting: "🤝", site_visit: "🏠", whatsapp: "💬",
};

const AVATAR_GRADIENTS = [
  "from-slate-400 to-slate-500", "from-stone-400 to-stone-500",
  "from-zinc-400 to-zinc-500", "from-neutral-400 to-neutral-500", "from-gray-400 to-gray-500",
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatAmount(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

function timeAgo(date: any): string {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(ts: any): string {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(ts: any): string {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function valueColor(v: number) {
  if (v >= 500000) return "text-emerald-600 font-bold";
  if (v >= 200000) return "text-amber-600 font-bold";
  return "text-gray-500 font-semibold";
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function SalesPipelinePage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id ?? null;
  const { leads, stats, loading, assignLead, changeStage, addActivityLog, createLead } = useLeads(tenantId);
  const { employeeId, roles } = useCurrentUser();
  const { toast } = useToast();
  const { followUps, todayFollowUps, overdueFollowUps, addFollowUp, completeFollowUp } = useFollowUps(tenantId);
  const { employees } = useEmployees(tenantId);

  // View
  const [view, setView] = useState<"kanban" | "table">("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [tempFilter, setTempFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");

  // Kanban DnD
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [invalidDropStage, setInvalidDropStage] = useState<string | null>(null);

  // Lead detail panel
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpData, setFollowUpData] = useState({ type: "call" as FollowUp["type"], date: "", notes: "" });

  // Add Lead modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", phone: "", email: "", city: "",
    source: "manual" as Lead["source"], estimatedValue: 0, assignedTo: "", notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  // Lost reason dialog
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");

  // Contracts
  const { contracts } = useContracts(tenantId);
  const [createContractLead, setCreateContractLead] = useState<Lead | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);

  // Convert to Project
  const [convertLead, setConvertLead] = useState<Lead | null>(null);

  const contractByLeadId = useMemo(() => {
    const map = new Map<string, Contract>();
    for (const c of contracts) {
      if (c.type === "client") {
        const cf = c.customFields as ClientContractFields;
        if (cf?.leadId) map.set(cf.leadId, c);
      }
    }
    return map;
  }, [contracts]);

  // Budget settings
  const [budgetSettingsOpen, setBudgetSettingsOpen] = useState(false);
  const [hotThreshold, setHotThreshold] = useState(1000000);
  const [warmThreshold, setWarmThreshold] = useState(500000);
  const [configSaving, setConfigSaving] = useState(false);

  // Table sort + pagination
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // ─── Derived Data ───────────────────────────────────────────────────────────

  const isSalesOnly = roles.includes("sales") && !roles.includes("owner");

  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return leads.filter(l => {
      if (isSalesOnly && l.assignedTo && l.assignedTo !== employeeId) return false;
      if (q && ![l.name, l.phone, l.email].some(f => f?.toLowerCase().includes(q))) return false;
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (tempFilter !== "all" && l.temperature !== tempFilter) return false;
      if (assignedFilter !== "all" && l.assignedTo !== assignedFilter) return false;
      return true;
    });
  }, [leads, isSalesOnly, employeeId, searchQuery, stageFilter, tempFilter, assignedFilter]);

  const leadsByStage = useMemo<Record<string, Lead[]>>(() => {
    const map: Record<string, Lead[]> = {};
    STAGES.forEach(s => { map[s] = filteredLeads.filter(l => l.stage === s); });
    return map;
  }, [filteredLeads]);

  const stageTotals = useMemo<Record<string, number>>(() => {
    const t: Record<string, number> = {};
    STAGES.forEach(s => { t[s] = leadsByStage[s].reduce((sum, l) => sum + (l.estimatedValue || 0), 0); });
    return t;
  }, [leadsByStage]);

  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    if (sortField) {
      arr.sort((a, b) => {
        const av = (a as any)[sortField] ?? 0;
        const bv = (b as any)[sortField] ?? 0;
        const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return arr;
  }, [filteredLeads, sortField, sortDir]);

  const totalPages = Math.ceil(sortedLeads.length / PAGE_SIZE);
  const pagedLeads = sortedLeads.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const leadFollowUps = useMemo(() => {
    if (!selectedLead) return [];
    return followUps.filter(f => f.leadId === selectedLead.id);
  }, [followUps, selectedLead]);

  // Live-synced lead for the detail panel
  const liveLead = useMemo(() => {
    if (!selectedLead) return null;
    return leads.find(l => l.id === selectedLead.id) ?? selectedLead;
  }, [leads, selectedLead]);

  // ─── Event Handlers ─────────────────────────────────────────────────────────

  const handleDragStart = (leadId: string) => setDraggingLeadId(leadId);
  const handleDragEnd = () => { setDraggingLeadId(null); setDragOverStage(null); };

  const handleDrop = async (targetStage: string) => {
    if (!draggingLeadId) return;
    const lead = leads.find(l => l.id === draggingLeadId);
    if (!lead || lead.stage === targetStage) { setDraggingLeadId(null); return; }
    if (!isValidTransition(lead.stage, targetStage)) {
      setInvalidDropStage(targetStage);
      setTimeout(() => setInvalidDropStage(null), 600);
      setDraggingLeadId(null);
      return;
    }
    if (targetStage === "lost") {
      setPendingLostLeadId(draggingLeadId);
      setShowLostDialog(true);
    } else {
      await changeStage(draggingLeadId, targetStage, undefined, employeeId, roles,
        { email: tenant?.email, businessName: tenant?.name });
    }
    setDraggingLeadId(null);
    setDragOverStage(null);
  };

  const handleStageChange = async (leadId: string, newStage: string) => {
    if (newStage === "lost") {
      setPendingLostLeadId(leadId);
      setShowLostDialog(true);
      return;
    }
    await changeStage(leadId, newStage, undefined, employeeId, roles,
      { email: tenant?.email, businessName: tenant?.name });
  };

  const confirmLost = async () => {
    if (pendingLostLeadId) {
      await changeStage(pendingLostLeadId, "lost", lostReason || undefined, employeeId, roles,
        { email: tenant?.email, businessName: tenant?.name });
    }
    setShowLostDialog(false);
    setLostReason("");
    setPendingLostLeadId(null);
  };

  const handleAssign = async (leadId: string, empId: string) => {
    await assignLead(leadId, empId);
  };

  const handleAddLead = async () => {
    if (!tenantId || !addForm.name || !addForm.phone) return;
    setAddSaving(true);
    await createLead({
      tenantId, name: addForm.name, phone: addForm.phone, email: addForm.email,
      city: addForm.city || undefined, stage: "new", source: addForm.source,
      score: 0, estimatedValue: addForm.estimatedValue,
      assignedTo: addForm.assignedTo || undefined,
      followUpCount: 0, notes: addForm.notes || undefined,
    });
    setIsAddOpen(false);
    setAddForm({ name: "", phone: "", email: "", city: "", source: "manual", estimatedValue: 0, assignedTo: "", notes: "" });
    setAddSaving(false);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else setSortField(null);
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const handleAddFollowUp = async () => {
    if (!liveLead || !followUpData.date) return;
    await addFollowUp({
      leadId: liveLead.id,
      tenantId: tenantId!,
      type: followUpData.type,
      scheduledAt: new Date(followUpData.date).toISOString(),
      status: "pending",
      notes: followUpData.notes || undefined,
    });
    await addActivityLog(liveLead.id, "updated",
      `Follow-up scheduled: ${followUpData.type}${followUpData.notes ? ` - ${followUpData.notes}` : ""}`);
    setFollowUpData({ type: "call", date: "", notes: "" });
    setShowFollowUpForm(false);
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    await completeFollowUp(followUpId, "Completed");
  };

  const openDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailsOpen(true);
    setShowFollowUpForm(false);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setTimeout(() => setSelectedLead(null), 300);
  };

  const handleOpenBudgetSettings = async () => {
    if (!tenantId) return;
    const db = getDb();
    const snap = await getDoc(doc(db, "tenants", tenantId));
    if (snap.exists()) {
      const config = snap.data()?.leadScoringConfig;
      if (config) {
        setHotThreshold(config.hotAmount ?? 1000000);
        setWarmThreshold(config.warmAmount ?? 500000);
      }
    }
    setBudgetSettingsOpen(true);
  };

  const handleSaveBudgetSettings = async (applyToAll: boolean) => {
    if (!tenantId) return;
    setConfigSaving(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, "tenants", tenantId), {
        leadScoringConfig: { hotAmount: hotThreshold, warmAmount: warmThreshold },
      });
      if (applyToAll) {
        await classifyLeadsByBudget(tenantId, leads, { hotAmount: hotThreshold, warmAmount: warmThreshold });
      }
      toast({ title: applyToAll ? "Applied to all leads successfully" : "Settings saved" });
      setBudgetSettingsOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setConfigSaving(false);
    }
  };

  const getFollowUpCountForLead = (leadId: string) =>
    followUps.filter(f => f.leadId === leadId && f.status === "pending").length;

  // ─── Loading Skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-3 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 w-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="w-72 shrink-0 rounded-2xl bg-gray-100 animate-pulse" style={{ height: 300 }} />
          ))}
        </div>
      </div>
    );
  }

  const cvr = stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* 1. STATS BAR */}
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Total" value={stats.total} />
        <StatPill label="New" value={stats.new} />
        <StatPill label="Hot" value={stats.hotCount} />
        <StatPill label="Won" value={stats.won} />
        <StatPill label="CVR" value={`${cvr}%`} />
      </div>

      {/* 2. HEADER ROW */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
            <span className="text-sm text-gray-500">{filteredLeads.length} leads</span>
          </div>
          {overdueFollowUps.length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 py-1">
              <AlertCircle className="h-3 w-3" /> {overdueFollowUps.length} overdue
            </Badge>
          )}
          {todayFollowUps.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 py-1">
              <Clock className="h-3 w-3" /> {todayFollowUps.length} due today
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white p-1 gap-1">
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === "kanban" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                view === "table" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          <Button
            variant="outline" size="icon"
            className="h-9 w-9 bg-white"
            onClick={handleOpenBudgetSettings}
            title="Budget Temperature Settings"
          >
            <Sliders className="h-4 w-4" />
          </Button>
          <Button
            className="h-9 bg-gray-900 hover:bg-gray-800 text-white gap-1.5"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* 3. FILTER BAR */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, phone, email..."
            className="pl-10 h-9"
            style={{ background: 'var(--glass)', border: '1px solid var(--glass-border-in)', color: 'var(--fg-900)' }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={v => { setStageFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[150px] h-9 text-sm" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border-in)', color: 'var(--fg-900)' }}>
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tempFilter} onValueChange={v => { setTempFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border-in)', color: 'var(--fg-900)' }}>
            <SelectValue placeholder="All Temps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Temps</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌤️ Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
        {!isSalesOnly && (
          <Select value={assignedFilter} onValueChange={v => { setAssignedFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] h-9 text-sm" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border-in)', color: 'var(--fg-900)' }}>
              <SelectValue placeholder="All Reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {employees.filter(e => e.isActive).map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* 4A. KANBAN VIEW — desktop only */}
      {view === "kanban" && (
        <div className="hidden md:flex gap-4 overflow-x-auto pb-4 -mx-4 px-4">
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={leadsByStage[stage] ?? []}
              stageTotals={stageTotals}
              draggingLeadId={draggingLeadId}
              isDragOver={dragOverStage === stage}
              isInvalidDrop={invalidDropStage === stage}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={() => handleDrop(stage)}
              onDragOver={() => setDragOverStage(stage)}
              onDragLeave={() => setDragOverStage(null)}
              onCardClick={openDetails}
              onAddLead={() => setIsAddOpen(true)}
              employees={employees}
            />
          ))}
        </div>
      )}

      {/* 4B. TABLE VIEW — always in table mode; also shown on mobile in kanban mode */}
      <div className={view === "kanban" ? "md:hidden" : ""}>
        <TableView
          leads={pagedLeads}
          employees={employees}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
          onView={openDetails}
          onStageChange={handleStageChange}
          onAssign={handleAssign}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={sortedLeads.length}
          pageSize={PAGE_SIZE}
          onPage={setCurrentPage}
          getFollowUpCount={getFollowUpCountForLead}
        />
      </div>

      {/* 5. LEAD DETAIL PANEL — right slide-in */}
      <div className={cn("fixed inset-0 z-40 transition-all duration-300", isDetailsOpen ? "pointer-events-auto" : "pointer-events-none")}>
        {/* Backdrop */}
        <div
          className={cn("absolute inset-0 bg-black/30 transition-opacity duration-300", isDetailsOpen ? "opacity-100" : "opacity-0")}
          onClick={closeDetails}
        />
        {/* Panel */}
        <div className={cn(
          "absolute right-0 top-0 h-full w-[440px] max-w-full bg-white shadow-2xl overflow-y-auto transition-transform duration-300",
          isDetailsOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {liveLead && (
            <LeadDetailPanel
              lead={liveLead}
              employees={employees}
              leadFollowUps={leadFollowUps}
              showFollowUpForm={showFollowUpForm}
              followUpData={followUpData}
              isSalesOnly={isSalesOnly}
              contract={contractByLeadId.get(liveLead.id) ?? null}
              onClose={closeDetails}
              onStageChange={handleStageChange}
              onAssign={handleAssign}
              onAddFollowUp={handleAddFollowUp}
              onCompleteFollowUp={handleCompleteFollowUp}
              onToggleFollowUpForm={() => setShowFollowUpForm(v => !v)}
              onFollowUpDataChange={setFollowUpData}
              onCreateContract={() => setCreateContractLead(liveLead)}
              onViewContract={(c) => setDetailContract(c)}
              onConvertToProject={() => setConvertLead(liveLead)}
            />
          )}
        </div>
      </div>

      {/* 6. ADD LEAD MODAL */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>Create a new lead in the pipeline.</DialogDescription>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600">Full Name *</label>
                <Input placeholder="John Doe" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Phone *</label>
                <Input placeholder="+91 98765..." value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Email</label>
                <Input placeholder="email@example.com" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">City</label>
                <Input placeholder="Mumbai" value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Source</label>
                <Select value={addForm.source} onValueChange={v => setAddForm(f => ({ ...f, source: v as Lead["source"] }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">🌐 Website</SelectItem>
                    <SelectItem value="consultation">💬 Consultation</SelectItem>
                    <SelectItem value="referral">👥 Referral</SelectItem>
                    <SelectItem value="manual">✏️ Manual</SelectItem>
                    <SelectItem value="import">📥 Import</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600">Estimated Value ₹</label>
                <Input
                  type="number" placeholder="0"
                  value={addForm.estimatedValue || ""}
                  onChange={e => setAddForm(f => ({ ...f, estimatedValue: Number(e.target.value) }))}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600">Assign To</label>
                <Select value={addForm.assignedTo || "none"} onValueChange={v => setAddForm(f => ({ ...f, assignedTo: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {employees.filter(e => e.isActive).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600">Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 resize-none"
                  placeholder="Any additional notes..."
                  value={addForm.notes}
                  onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button
                className="bg-gray-900 hover:bg-gray-800 text-white"
                disabled={addSaving || !addForm.name || !addForm.phone}
                onClick={handleAddLead}
              >
                {addSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : "Add Lead"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 7. LOST REASON DIALOG */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Mark Lead as Lost</DialogTitle>
          <DialogDescription>Optionally provide a reason for losing this lead.</DialogDescription>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Reason (optional)"
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowLostDialog(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmLost}>Confirm Lost</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 8. BUDGET SETTINGS DIALOG */}
      <Dialog open={budgetSettingsOpen} onOpenChange={setBudgetSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Budget Temperature Settings</DialogTitle>
          <DialogDescription>Leads are auto-classified based on their budget vs. your thresholds.</DialogDescription>
          <div className="space-y-5 pt-2">
            <div className="flex rounded-full overflow-hidden h-2">
              <div className="flex-1 bg-red-400" />
              <div className="flex-1 bg-orange-400" />
              <div className="flex-1 bg-sky-400" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-red-500" /> Hot above ₹
              </label>
              <Input type="number" value={hotThreshold} onChange={e => setHotThreshold(Number(e.target.value))} className="h-9" />
              <p className="text-xs text-gray-400">= ₹{hotThreshold.toLocaleString("en-IN")}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <Thermometer className="h-3.5 w-3.5 text-orange-500" /> Warm above ₹
              </label>
              <Input
                type="number" value={warmThreshold}
                onChange={e => setWarmThreshold(Number(e.target.value))}
                className={cn("h-9", warmThreshold >= hotThreshold && "border-red-400")}
              />
              <p className="text-xs text-gray-400">= ₹{warmThreshold.toLocaleString("en-IN")}</p>
              {warmThreshold >= hotThreshold && (
                <p className="text-xs text-red-500">Must be less than Hot threshold</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-sky-50 border border-sky-100 px-3 py-2 rounded-lg">
              <Snowflake className="h-3.5 w-3.5 text-sky-500 shrink-0" />
              Below ₹{warmThreshold.toLocaleString("en-IN")} → Cold
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline" className="flex-1 h-9 text-sm"
                disabled={configSaving || warmThreshold >= hotThreshold}
                onClick={() => handleSaveBudgetSettings(false)}
              >
                Save Only
              </Button>
              <Button
                className="flex-1 h-9 text-sm bg-slate-900 hover:bg-slate-800"
                disabled={configSaving || warmThreshold >= hotThreshold}
                onClick={() => handleSaveBudgetSettings(true)}
              >
                {configSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Saving...</> : "Save & Apply to All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 10. CONVERT TO PROJECT MODAL */}
      {tenantId && convertLead && (
        <ConvertToProjectModal
          open={!!convertLead}
          onClose={() => setConvertLead(null)}
          lead={convertLead}
          tenantId={tenantId}
          employees={employees}
          onConverted={() => setConvertLead(null)}
        />
      )}

      {/* 9. CONTRACT DRAWERS */}
      {tenantId && (
        <>
          <CreateClientContractDrawer
            open={!!createContractLead}
            onClose={() => setCreateContractLead(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail=""
            prefill={{
              leadId:      createContractLead?.id,
              partyBName:  createContractLead?.name,
              partyBEmail: createContractLead?.email,
              partyBPhone: createContractLead?.phone,
              totalValue:  createContractLead?.estimatedValue,
              title: createContractLead?.name
                ? `${createContractLead.name} — Interior Design Contract`
                : undefined,
            }}
            onCreated={() => setCreateContractLead(null)}
          />
          <ContractDetailDrawer
            contract={detailContract}
            tenantId={tenantId}
            onClose={() => setDetailContract(null)}
            onUpdated={() => {}}
          />
        </>
      )}
    </div>
  );
}

// ─── StatPill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex items-center gap-2 rounded-[8px] px-3 py-1.5"
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--glass-border-in)',
        backdropFilter: 'var(--glass-blur)',
      }}
    >
      <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-400)' }}>{label}</span>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--fg-900)' }}>{value}</span>
    </div>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  stage: string;
  leads: Lead[];
  stageTotals: Record<string, number>;
  draggingLeadId: string | null;
  isDragOver: boolean;
  isInvalidDrop: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onCardClick: (lead: Lead) => void;
  onAddLead: () => void;
  employees: { id: string; name: string; isActive: boolean }[];
}

function KanbanColumn({
  stage, leads, stageTotals, draggingLeadId, isDragOver, isInvalidDrop,
  onDragStart, onDragEnd, onDrop, onDragOver, onDragLeave, onCardClick, onAddLead, employees,
}: KanbanColumnProps) {
  const meta = STAGE_META[stage] ?? STAGE_META.new;
  return (
    <div className={cn(
      "w-64 shrink-0 flex flex-col rounded-[10px] border-t-[3px] pt-0",
      meta.topBorder,
      meta.bgTint,
      isInvalidDrop && "animate-shake",
    )}>
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 shrink-0">
        <div className={cn("h-[6px] w-[6px] rounded-full shrink-0", meta.dotColor)} />
        <span className={cn("text-[13px] font-bold flex-1", meta.textColor)}>{STAGE_LABELS[stage]}</span>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0", meta.badgeBg, meta.textColor)}>
          {leads.length}
        </span>
        {stageTotals[stage] > 0 && (
          <span className="text-[11px] font-medium text-[#8A8A8A] shrink-0">
            {formatAmount(stageTotals[stage])}
          </span>
        )}
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[200px] max-h-[calc(100vh-320px)] transition-colors rounded-b-[10px]",
          isDragOver && "bg-black/[0.03] ring-1 ring-inset ring-black/[0.08]",
        )}
        onDragOver={e => { e.preventDefault(); onDragOver(); }}
        onDragLeave={onDragLeave}
        onDrop={e => { e.preventDefault(); onDrop(); }}
      >
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 border border-dashed border-black/[0.08] rounded-[8px] text-center gap-1">
            <p className="text-[11px] text-[#8A8A8A]">No leads</p>
            <button onClick={onAddLead} className="text-[11px] text-[#8A8A8A] hover:text-[#0A0A0A] transition-colors">
              + Add
            </button>
          </div>
        )}
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            employees={employees}
            draggingLeadId={draggingLeadId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onCardClick(lead)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: Lead;
  employees: { id: string; name: string }[];
  draggingLeadId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}

function LeadCard({ lead, employees, draggingLeadId, onDragStart, onDragEnd, onClick }: LeadCardProps) {
  const assignee = employees.find(e => e.id === lead.assignedTo);
  const avatarGrad = AVATAR_GRADIENTS[lead.id.charCodeAt(0) % AVATAR_GRADIENTS.length];

  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "rounded-[10px] p-3 select-none transition-all duration-150 cursor-grab active:cursor-grabbing",
        draggingLeadId === lead.id && "opacity-60 rotate-[1deg]",
      )}
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--glass-border-in)',
        backdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      {/* Row 1: name + temp dot */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-[13px] leading-tight line-clamp-1" style={{ color: 'var(--fg-900)' }}>{lead.name}</span>
        <span className={cn("h-2 w-2 rounded-full shrink-0 mt-1", TEMP_DOT[lead.temperature] ?? "bg-gray-400")} />
      </div>

      {/* Row 2: phone */}
      {lead.phone && (
        <p className="text-[11px] mb-1.5 flex items-center gap-1" style={{ color: 'var(--fg-400)' }}>
          <Phone className="h-2.5 w-2.5" />{lead.phone}
        </p>
      )}

      {/* Row 3: city */}
      {lead.city && (
        <div className="mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--brand-bg)', color: 'var(--fg-400)' }}>{lead.city}</span>
        </div>
      )}

      {/* Row 4: value + timeAgo */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--fg-900)' }}>
          {formatAmount(lead.estimatedValue)}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--fg-400)' }}>{timeAgo(lead.createdAt)}</span>
      </div>

      {/* Row 5: assignee avatar */}
      {assignee && (
        <div className="mt-2 flex justify-end">
          <div
            title={assignee.name}
            className={cn(
              "h-5 w-5 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-[8px] font-bold",
              avatarGrad,
            )}
          >
            {getInitials(assignee.name)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LeadDetailPanel ──────────────────────────────────────────────────────────

interface DetailPanelProps {
  lead: Lead;
  employees: { id: string; name: string; isActive: boolean }[];
  leadFollowUps: FollowUp[];
  showFollowUpForm: boolean;
  followUpData: { type: FollowUp["type"]; date: string; notes: string };
  isSalesOnly: boolean;
  contract?: Contract | null;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
  onAssign: (id: string, empId: string) => void;
  onAddFollowUp: () => void;
  onCompleteFollowUp: (id: string) => void;
  onToggleFollowUpForm: () => void;
  onFollowUpDataChange: (d: { type: FollowUp["type"]; date: string; notes: string }) => void;
  onCreateContract?: () => void;
  onViewContract?: (c: Contract) => void;
  onConvertToProject?: () => void;
}

function LeadDetailPanel({
  lead, employees, leadFollowUps, showFollowUpForm, followUpData, isSalesOnly,
  contract, onClose, onStageChange, onAssign, onAddFollowUp, onCompleteFollowUp,
  onToggleFollowUpForm, onFollowUpDataChange, onCreateContract, onViewContract,
  onConvertToProject,
}: DetailPanelProps) {
  const assignee = employees.find(e => e.id === lead.assignedTo);

  return (
    <>
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shrink-0">
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">{lead.name}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", STAGE_PILL[lead.stage])}>
                  {STAGE_LABELS[lead.stage]}
                </span>
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize flex items-center gap-1", TEMP_PILL[lead.temperature])}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", TEMP_DOT[lead.temperature] ?? "bg-gray-400")} />
                  {lead.temperature}
                </span>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                  Score {lead.score}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action row */}
        {lead.stage !== "won" && lead.stage !== "lost" ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 px-3"
              onClick={() => onStageChange(lead.id, "won")}
            >
              <CheckCircle className="h-3.5 w-3.5" /> Won
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1 px-3"
              onClick={() => onStageChange(lead.id, "lost")}
            >
              <X className="h-3.5 w-3.5" /> Lost
            </Button>
            <Select value={lead.stage} onValueChange={v => onStageChange(lead.id, v)}>
              <SelectTrigger className="h-8 text-xs ml-auto w-36">
                <div className="flex items-center gap-1">
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                  <span>Move Stage</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {STAGES.filter(s => s === lead.stage || isValidTransition(lead.stage, s)).map(s => (
                  <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold",
            lead.stage === "won" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
          )}>
            {lead.stage === "won" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {lead.stage === "won" ? "Lead Won" : "Lead Lost"}
          </div>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="px-5 py-4 space-y-4 bg-gray-50/50">

        {/* Contact info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/70">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="h-3 w-3" /> Contact Info
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-x-5 gap-y-3">
            <InfoField label="Phone" value={lead.phone} />
            <InfoField label="City" value={lead.city} />
            <InfoField label="Email" value={lead.email} span />
            <InfoField label="Source" value={`${SOURCE_ICON[lead.source] ?? ""} ${lead.source.replace(/_/g, " ")}`} />
            <InfoField label="Assigned To" value={assignee?.name} fallback="Unassigned" />
            <InfoField label="Created" value={formatDate(lead.createdAt)} />
            <InfoField label="Last Contact" value={formatDate(lead.lastContactedAt)} />
          </div>
        </div>

        {/* Budget card */}
        <div className="rounded-xl bg-slate-900 p-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">Estimated Budget</p>
              <p className="text-4xl font-black tracking-tight">{formatAmount(lead.estimatedValue)}</p>
            </div>
            <span className="text-xs bg-white/10 text-slate-200 px-2.5 py-1 rounded-full font-semibold">
              {STAGE_LABELS[lead.stage]}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <span className="text-xs text-slate-400">Pipeline value · {lead.temperature} lead</span>
          </div>
        </div>

        {/* Client Contract */}
        {(lead.stage === "won" || contract) && (
          <div className="bg-white rounded-[14px] border border-black/[0.08] p-4">
            <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">
              Client Contract
            </p>
            {contract ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ContractStatusBadge status={contract.status} />
                  <span className="text-[12px] font-mono text-[#8A8A8A]">{contract.contractNumber}</span>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => onViewContract?.(contract)}>
                  View
                </Button>
              </div>
            ) : (
              <Button size="sm" className="w-full bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] text-xs gap-1.5"
                onClick={onCreateContract}>
                <FileSignature className="h-3.5 w-3.5" /> Create Client Contract
              </Button>
            )}
          </div>
        )}

        {/* Project link / Convert to Project */}
        {lead.stage === "won" && (
          <div className="bg-white rounded-[14px] border border-black/[0.08] p-4">
            <p className="text-[10px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <FolderOpen className="h-3 w-3" /> Project
            </p>
            {lead.projectId ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-emerald-700 font-semibold">Project created</span>
                <Link
                  href="/dashboard/projects"
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> View Projects
                </Link>
              </div>
            ) : (
              <Button
                size="sm"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                onClick={onConvertToProject}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Create Project
              </Button>
            )}
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-amber-100/70 bg-amber-100/40">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Notes</p>
            </div>
            <div className="p-4">
              <p className="text-sm text-amber-900 leading-relaxed">{lead.notes}</p>
            </div>
          </div>
        )}

        {/* Assign To (admin/owner only) */}
        {!isSalesOnly && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assign To</p>
            <Select
              value={lead.assignedTo || "none"}
              onValueChange={v => v !== "none" && onAssign(lead.id, v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue>
                  {assignee?.name ?? <span className="text-gray-400 italic">Unassigned</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Assign to...</SelectItem>
                {employees.filter(e => e.isActive).map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Follow-ups */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/70 flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Follow-ups
              <span className="bg-slate-200 text-slate-700 text-[9px] font-bold rounded-full px-1.5 py-0.5">
                {leadFollowUps.length}
              </span>
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-white" onClick={onToggleFollowUpForm}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          <div className="p-4 space-y-3">
            {showFollowUpForm && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2.5">
                <Select
                  value={followUpData.type}
                  onValueChange={v => onFollowUpDataChange({ ...followUpData, type: v as FollowUp["type"] })}
                >
                  <SelectTrigger className="h-8 text-xs rounded-lg bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {FOLLOWUP_EMOJI[t]} {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local" className="h-8 text-xs rounded-lg bg-white"
                  value={followUpData.date}
                  onChange={e => onFollowUpDataChange({ ...followUpData, date: e.target.value })}
                />
                <Input
                  placeholder="Notes (optional)" className="h-8 text-xs rounded-lg bg-white"
                  value={followUpData.notes}
                  onChange={e => onFollowUpDataChange({ ...followUpData, notes: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onToggleFollowUpForm}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs bg-slate-900 hover:bg-slate-800" onClick={onAddFollowUp}>Schedule</Button>
                </div>
              </div>
            )}

            {leadFollowUps.length === 0 && !showFollowUpForm ? (
              <div className="flex flex-col items-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <Calendar className="h-6 w-6 text-gray-300 mb-1.5" />
                <p className="text-xs text-gray-400">No follow-ups scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leadFollowUps.map(fu => (
                  <div key={fu.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded capitalize">
                          {FOLLOWUP_EMOJI[fu.type]} {fu.type.replace(/_/g, " ")}
                        </Badge>
                        <Badge className={cn(
                          "text-[9px] border-none px-1.5 py-0 rounded",
                          fu.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                          fu.status === "missed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                        )}>
                          {fu.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{formatDateTime(fu.scheduledAt)}</p>
                      {fu.notes && <p className="text-[10px] text-gray-400 truncate">{fu.notes}</p>}
                    </div>
                    {fu.status === "pending" && (
                      <button
                        onClick={() => onCompleteFollowUp(fu.id)}
                        className="ml-2 shrink-0 rounded-full p-1 hover:bg-emerald-50 transition-colors"
                        title="Mark complete"
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/70">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="h-3 w-3" /> Activity
            </p>
          </div>
          <div className="p-4">
            <TimelineItem
              icon={<User className="h-3.5 w-3.5 text-slate-500" />}
              title="Lead Created"
              time={formatDateTime(lead.createdAt)}
              hasLine={(lead.timeline?.length ?? 0) > 0}
            />
            {lead.timeline?.map((ev, idx) => (
              <TimelineItem
                key={idx}
                icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
                title={ev.action}
                subtitle={ev.summary}
                time={formatDateTime(ev.timestamp)}
                hasLine={idx < (lead.timeline?.length ?? 0) - 1}
              />
            ))}
            {(lead.timeline?.length ?? 0) === 0 && (
              <div className="flex flex-col items-center py-5 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 mt-2">
                <Activity className="h-5 w-5 text-gray-300 mb-1" />
                <p className="text-xs text-gray-400">No activity yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-4" />
      </div>
    </>
  );
}

// ─── InfoField ────────────────────────────────────────────────────────────────

function InfoField({ label, value, fallback, span }: { label: string; value?: string; fallback?: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-all">
        {value || <span className="text-gray-400 font-normal italic">{fallback ?? "—"}</span>}
      </p>
    </div>
  );
}

// ─── TimelineItem ─────────────────────────────────────────────────────────────

function TimelineItem({ icon, title, subtitle, time, hasLine }: {
  icon: ReactNode; title: string; subtitle?: string; time: string; hasLine: boolean;
}) {
  return (
    <div className="flex gap-3 pb-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="h-7 w-7 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center">
          {icon}
        </div>
        {hasLine && <div className="w-px flex-1 bg-gray-200 mt-1.5 min-h-[16px]" />}
      </div>
      <div className="pt-0.5 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-snug">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 italic mt-0.5">&ldquo;{subtitle}&rdquo;</p>}
        <p className="text-[10px] text-gray-400 mt-0.5">{time}</p>
      </div>
    </div>
  );
}

// ─── TableView ────────────────────────────────────────────────────────────────

interface TableViewProps {
  leads: Lead[];
  employees: { id: string; name: string; isActive: boolean }[];
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (f: string) => void;
  onView: (l: Lead) => void;
  onStageChange: (id: string, stage: string) => void;
  onAssign: (id: string, empId: string) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPage: (p: number) => void;
  getFollowUpCount: (id: string) => number;
}

function SortableHeader({ label, field, sortField, sortDir, onSort, hidden }: {
  label: string; field?: string; sortField: string | null; sortDir: "asc" | "desc";
  onSort: (f: string) => void; hidden?: string;
}) {
  const active = field && sortField === field;
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap",
        hidden,
        field && "cursor-pointer hover:text-gray-600 select-none",
      )}
      onClick={field ? () => onSort(field) : undefined}
    >
      <span className="flex items-center gap-1">
        {label}
        {field && (
          active
            ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-gray-600" /> : <ChevronDown className="h-3 w-3 text-gray-600" />)
            : <ChevronDown className="h-3 w-3 text-gray-300" />
        )}
      </span>
    </th>
  );
}

function TableView({
  leads, employees, sortField, sortDir, onSort, onView, onStageChange, onAssign,
  currentPage, totalPages, totalCount, pageSize, onPage, getFollowUpCount,
}: TableViewProps) {
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  if (leads.length === 0 && currentPage === 1) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
        <Package className="h-12 w-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400">No leads match your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <SortableHeader label="Client" field="name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Phone" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Email" sortField={sortField} sortDir={sortDir} onSort={onSort} hidden="hidden md:table-cell" />
              <SortableHeader label="Stage" field="stage" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Temp" field="temperature" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Value" field="estimatedValue" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Assigned" sortField={sortField} sortDir={sortDir} onSort={onSort} hidden="hidden md:table-cell" />
              <SortableHeader label="FU" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <SortableHeader label="Created" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map(lead => {
              const assignee = employees.find(e => e.id === lead.assignedTo);
              const fuCount = getFollowUpCount(lead.id);
              return (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => onView(lead)}
                >
                  {/* Client */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                        {getInitials(lead.name)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                        {lead.city && <p className="text-[10px] text-gray-400">{lead.city}</p>}
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{lead.phone || "—"}</td>
                  {/* Email */}
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell max-w-[160px] truncate">
                    {lead.email || "—"}
                  </td>
                  {/* Stage */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Select value={lead.stage} onValueChange={v => onStageChange(lead.id, v)}>
                      <SelectTrigger className="h-7 w-[130px] text-[10px] border-none shadow-none p-0 bg-transparent">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", STAGE_PILL[lead.stage])}>
                          {STAGE_LABELS[lead.stage]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.filter(s => s === lead.stage || isValidTransition(lead.stage, s)).map(s => (
                          <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Temperature */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", TEMP_DOT[lead.temperature] ?? "bg-gray-400")} />
                      <span className="text-[12px] text-[#3D3D3D] capitalize">{lead.temperature}</span>
                    </div>
                  </td>
                  {/* Value */}
                  <td className={cn("px-4 py-3 text-sm whitespace-nowrap", valueColor(lead.estimatedValue))}>
                    {formatAmount(lead.estimatedValue)}
                  </td>
                  {/* Assigned */}
                  <td className="px-4 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                    <Select value={lead.assignedTo || "none"} onValueChange={v => v !== "none" && onAssign(lead.id, v)}>
                      <SelectTrigger className="h-7 w-[120px] text-xs border-none shadow-none bg-transparent p-0">
                        <SelectValue>
                          {assignee?.name ?? <span className="text-gray-300 italic text-xs">Unassigned</span>}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Assign to...</SelectItem>
                        {employees.filter(e => e.isActive).map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  {/* Follow-ups */}
                  <td className="px-4 py-3">
                    {fuCount > 0
                      ? <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0"><Calendar className="h-3 w-3" />{fuCount}</Badge>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                  {/* Created */}
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{timeAgo(lead.createdAt)}</td>
                  {/* Actions */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onView(lead)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">Showing {from}–{to} of {totalCount}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={currentPage === 1}
              onClick={() => onPage(currentPage - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const p = currentPage <= 3 ? i + 1 : currentPage + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <Button
                  key={p} size="sm"
                  variant={p === currentPage ? "default" : "outline"}
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => onPage(p)}
                >
                  {p}
                </Button>
              );
            })}
            <Button
              size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={currentPage === totalPages}
              onClick={() => onPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
