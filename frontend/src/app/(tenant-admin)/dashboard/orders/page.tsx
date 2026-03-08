"use client";

import React, { useState, useMemo, useRef, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  doc, getDoc, updateDoc, addDoc, collection,
  getDocs, orderBy, query, serverTimestamp, deleteDoc,
} from "firebase/firestore";
import { useContracts } from "@/hooks/useContracts";
import { CreateClientContractDrawer } from "@/components/dashboard/contracts/CreateClientContractDrawer";
import { ContractDetailDrawer } from "@/components/dashboard/contracts/ContractDetailDrawer";
import { ContractStatusBadge } from "@/components/dashboard/contracts/ContractStatusBadge";
import type { Contract, ClientContractFields } from "@/types/contracts";
import {
  Search, Eye, Package, X, XCircle, User, Activity, Phone, Calendar,
  Flame, Thermometer, Snowflake, Plus, ChevronDown, ChevronUp, Clock,
  CheckCircle, AlertCircle, Sliders, Loader2,
  FileSignature, FolderOpen, ExternalLink,
  MapPin, MessageCircle, Send, Briefcase, FileText, Upload, Trash2, Building,
  Download, Globe, Mail, Home, Users, PenLine, RefreshCw, Paperclip, IndianRupee,
  LayoutGrid, List,
} from "lucide-react";
import { ConvertToProjectModal } from "@/components/projects/ConvertToProjectModal";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import {
  useLeads, Lead, isValidTransition, classifyLeadsByBudget, VALID_TRANSITIONS,
} from "@/hooks/useLeads";
import { useToast } from "@/hooks/use-toast";
import { getDb } from "@/lib/firebase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFollowUps, FollowUp } from "@/hooks/useFollowUps";
import { useEmployees } from "@/hooks/useEmployees";
import { uploadImage } from "@/lib/storageHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STAGES = [
  "new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal_sent: "Proposal Sent", negotiation: "Negotiation", won: "Won", lost: "Lost",
};

const STAGE_COLOR: Record<string, { top: string; badge: string; label: string }> = {
  new:           { top: "#4B56D2", badge: "rgba(75,86,210,0.15)",   label: "#818CF8" },
  contacted:     { top: "#0891B2", badge: "rgba(8,145,178,0.15)",   label: "#22D3EE" },
  qualified:     { top: "#D97706", badge: "rgba(217,119,6,0.15)",   label: "#FCD34D" },
  proposal_sent: { top: "#7C3AED", badge: "rgba(124,58,237,0.15)",  label: "#C4B5FD" },
  negotiation:   { top: "#DB2777", badge: "rgba(219,39,119,0.15)",  label: "#F9A8D4" },
  won:           { top: "var(--green)",   badge: "rgba(22,163,74,0.15)",   label: "var(--green)" },
  lost:          { top: "var(--red)",     badge: "rgba(220,38,38,0.15)",    label: "var(--red)" },
};

const TEMP_COLOR = { hot: "var(--red)", warm: "var(--amber)", cold: "var(--brand)" };
const TEMP_BG: Record<string, string> = { hot: "rgba(220,38,38,0.12)", warm: "rgba(217,119,6,0.12)", cold: "rgba(8,145,178,0.10)" };
const TEMP_LABEL: Record<string, string> = { hot: "Hot", warm: "Warm", cold: "Cold" };
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

const SOURCE_ICON: Record<string, ReactNode> = {
  website: <Globe className="h-3 w-3" />, consultation: <MessageCircle className="h-3 w-3" />, referral: <Users className="h-3 w-3" />, manual: <PenLine className="h-3 w-3" />, import: <Download className="h-3 w-3" />,
};

const FOLLOW_UP_TYPES = ["call", "email", "meeting", "site_visit", "whatsapp"] as const;
const FOLLOWUP_EMOJI: Record<string, ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />, email: <Mail className="h-3.5 w-3.5" />, meeting: <Users className="h-3.5 w-3.5" />, site_visit: <Home className="h-3.5 w-3.5" />, whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
};

const ACTIVITY_TYPES = ["note", "call", "whatsapp", "email", "site_visit", "meeting"] as const;
type ActivityType = typeof ACTIVITY_TYPES[number];
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Note", call: "Call", whatsapp: "WhatsApp", email: "Email",
  site_visit: "Site Visit", meeting: "Meeting",
};

const AVATAR_GRADIENTS = [
  "from-slate-400 to-slate-500", "from-stone-400 to-stone-500",
  "from-zinc-400 to-zinc-500", "from-neutral-400 to-neutral-500", "from-gray-400 to-gray-500",
];

function formatAmount(v: number | undefined): string {
  if (!v) return "—";
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
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

export default function SalesPipelinePage() {
  const { tenant } = useTenantAuth();
  const tenantId = useMemo(() => tenant?.id ?? null, [tenant?.id]);
  const { leads, stats, loading, updateLead, assignLead, changeStage, addActivityLog, createLead } = useLeads(tenantId);
  const { employeeId, roles } = useCurrentUser();
  const { toast } = useToast();
  const { followUps, todayFollowUps, overdueFollowUps, addFollowUp, completeFollowUp } = useFollowUps(tenantId);
  const { employees } = useEmployees(tenantId);

  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [tempFilter, setTempFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [invalidDropStage, setInvalidDropStage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "activity" | "estimate" | "files">("overview");
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpData, setFollowUpData] = useState({ type: "call" as FollowUp["type"], date: "", notes: "" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", phone: "", email: "", city: "",
    source: "manual" as Lead["source"], estimatedValue: 0, assignedTo: "", notes: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");
  const { contracts } = useContracts(tenantId);
  const [createContractLead, setCreateContractLead] = useState<Lead | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [budgetSettingsOpen, setBudgetSettingsOpen] = useState(false);
  const [hotThreshold, setHotThreshold] = useState(1000000);
  const [warmThreshold, setWarmThreshold] = useState(500000);
  const [configSaving, setConfigSaving] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

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

  const isSalesOnly = roles.includes("sales") && !roles.includes("owner");

  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return leads.filter(l => {
      if (isSalesOnly && l.assignedTo && l.assignedTo !== employeeId) return false;
      if (q && ![l.name, l.phone, l.email].some(f => f?.toLowerCase().includes(q))) return false;
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (tempFilter !== "all" && l.temperature !== tempFilter) return false;
      if (assignedFilter !== "all" && l.assignedTo !== assignedFilter) return false;
      if (dateFrom && l.createdAt) {
        const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
        if (d < new Date(dateFrom)) return false;
      }
      if (dateTo && l.createdAt) {
        const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt);
        if (d > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [leads, isSalesOnly, employeeId, searchQuery, stageFilter, tempFilter, assignedFilter, dateFrom, dateTo]);

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

  const liveLead = useMemo(() => {
    if (!selectedLead) return null;
    return leads.find(l => l.id === selectedLead.id) ?? selectedLead;
  }, [leads, selectedLead]);

  const pipelineValue = useMemo(() =>
    leads.filter(l => !["won", "lost"].includes(l.stage)).reduce((s, l) => s + (l.estimatedValue || 0), 0),
    [leads]
  );

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
    if (newStage === "lost") { setPendingLostLeadId(leadId); setShowLostDialog(true); return; }
    await changeStage(leadId, newStage, undefined, employeeId, roles,
      { email: tenant?.email, businessName: tenant?.name });
  };

  const confirmLost = async () => {
    if (pendingLostLeadId) {
      await changeStage(pendingLostLeadId, "lost", lostReason || undefined, employeeId, roles,
        { email: tenant?.email, businessName: tenant?.name });
    }
    setShowLostDialog(false); setLostReason(""); setPendingLostLeadId(null);
  };

  const handleAssign = async (leadId: string, empId: string) => { await assignLead(leadId, empId); };

  const handleAddLead = async () => {
    if (!tenantId || !addForm.name || !addForm.phone) return;
    setAddSaving(true);
    await createLead({
      tenantId, name: addForm.name, phone: addForm.phone, email: addForm.email,
      city: addForm.city || undefined, stage: "new", source: addForm.source,
      score: 0, estimatedValue: addForm.estimatedValue,
      assignedTo: addForm.assignedTo || undefined, followUpCount: 0, notes: addForm.notes || undefined,
    });
    setIsAddOpen(false);
    setAddForm({ name: "", phone: "", email: "", city: "", source: "manual", estimatedValue: 0, assignedTo: "", notes: "" });
    setAddSaving(false);
  };

  const handleSort = (field: string) => {
    if (sortField === field) { if (sortDir === "asc") setSortDir("desc"); else setSortField(null); }
    else { setSortField(field); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const handleCompleteFollowUp = async (followUpId: string) => { await completeFollowUp(followUpId, "Completed"); };

  const openDetails = (lead: Lead, tab?: "overview" | "activity" | "estimate" | "files") => {
    setSelectedLead(lead); setActiveDetailTab(tab ?? "overview"); setIsDetailsOpen(true); setShowFollowUpForm(false);
  };

  const closeDetails = () => { setIsDetailsOpen(false); setTimeout(() => setSelectedLead(null), 300); };

  const handleOpenBudgetSettings = async () => {
    if (!tenantId) return;
    const db = getDb();
    const snap = await getDoc(doc(db, "tenants", tenantId));
    if (snap.exists()) {
      const config = snap.data()?.leadScoringConfig;
      if (config) { setHotThreshold(config.hotAmount ?? 1000000); setWarmThreshold(config.warmAmount ?? 500000); }
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
      if (applyToAll) await classifyLeadsByBudget(tenantId, leads, { hotAmount: hotThreshold, warmAmount: warmThreshold });
      toast({ title: applyToAll ? "Applied to all leads successfully" : "Settings saved" });
      setBudgetSettingsOpen(false);
    } catch (err) { console.error(err); toast({ title: "Failed to save settings", variant: "destructive" }); }
    finally { setConfigSaving(false); }
  };

  const getFollowUpCountForLead = (leadId: string) =>
    followUps.filter(f => f.leadId === leadId && f.status === "pending").length;

  const cvr = stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0;
  const handleAddFollowUp = async () => {
    if (!liveLead || !followUpData.date) return;
    await addFollowUp({
      leadId: liveLead.id, tenantId: tenantId!,
      type: followUpData.type,
      scheduledAt: new Date(followUpData.date).toISOString(),
      status: "pending", notes: followUpData.notes || undefined,
    });
    const msg = "Follow-up scheduled: " + followUpData.type + (followUpData.notes ? " - " + followUpData.notes : "");
    await addActivityLog(liveLead.id, "commented", msg);
    setFollowUpData({ type: "call", date: "", notes: "" });
    setShowFollowUpForm(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2 flex-wrap">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 w-28 rounded-xl animate-pulse" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }} />
          ))}
        </div>
        <div className="h-10 w-full rounded-xl animate-pulse" style={{ background: "var(--glass)" }} />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="w-64 shrink-0 rounded-2xl animate-pulse" style={{ height: 300, background: "var(--glass)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
        <StatPill label="Total" value={stats.total} valueColor="var(--brand)" />
        <StatPill label="New" value={stats.new} valueColor="#818CF8" />
        <StatPill label="Hot" value={stats.hotCount} valueColor="var(--red)" />
        <StatPill label="Contacted" value={stats.contacted} valueColor="#22D3EE" />
        <StatPill label="Won" value={stats.won} valueColor="var(--green)" />
        <StatPill label="Lost" value={stats.lost} valueColor="var(--red)" />
        <StatPill label="CVR" value={cvr + "%"} valueColor={cvr >= 30 ? "var(--green)" : "var(--amber)"} />
        <StatPill label="Pipeline" value={formatAmount(pipelineValue)} valueColor="var(--brand)" />
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--fg-900)" }}>Sales Pipeline</h1>
            <span className="text-sm" style={{ color: "var(--fg-400)" }}>{filteredLeads.length} leads</span>
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
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid var(--glass-border-in)" }}>
            <button onClick={() => setView("kanban")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: view === "kanban" ? "var(--brand)" : "var(--glass)", color: view === "kanban" ? "#fff" : "var(--fg-700)" }}>
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button onClick={() => setView("table")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors"
              style={{ background: view === "table" ? "var(--brand)" : "var(--glass)", color: view === "table" ? "#fff" : "var(--fg-700)" }}>
              <List className="h-3.5 w-3.5" /> Table
            </button>
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleOpenBudgetSettings}
            title="Budget Temperature Settings" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
            <Sliders className="h-4 w-4" />
          </Button>
          <Button className="h-9 gap-1.5 text-white" style={{ background: "var(--brand)" }} onClick={() => setIsAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Lead
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--fg-400)" }} />
          <Input
            placeholder="Search name, phone, email..."
            className="pl-10 h-9"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={v => { setStageFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px] h-9 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}>
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tempFilter} onValueChange={v => { setTempFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[120px] h-9 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}>
            <SelectValue placeholder="All Temps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Temps</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="warm">🌡️ Warm</SelectItem>
            <SelectItem value="cold">❄️ Cold</SelectItem>
          </SelectContent>
        </Select>
        {!isSalesOnly && (
          <Select value={assignedFilter} onValueChange={v => { setAssignedFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}>
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
        <Input
          type="date" className="h-9 w-[130px]"
          style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
          title="From date"
        />
        <Input
          type="date" className="h-9 w-[130px]"
          style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
          title="To date"
        />
      </div>

      {view === "kanban" && (
        <div className="hidden md:flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {STAGES.map(stage => (
            <KanbanColumn key={stage} stage={stage} leads={leadsByStage[stage] ?? []} stageTotals={stageTotals}
              draggingLeadId={draggingLeadId} isDragOver={dragOverStage === stage} isInvalidDrop={invalidDropStage === stage}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={() => handleDrop(stage)}
              onDragOver={() => setDragOverStage(stage)} onDragLeave={() => setDragOverStage(null)}
              onCardClick={(lead) => openDetails(lead)} onAddLead={() => setIsAddOpen(true)} onStageChange={handleStageChange}
              onOpenNote={(lead) => { setSelectedLead(lead); setActiveDetailTab("activity"); setIsDetailsOpen(true); }}
              employees={employees}
            />
          ))}
        </div>
      )}

      <div className={view === "kanban" ? "md:hidden" : ""}>
        <GroupedTableView
          leads={sortedLeads} employees={employees} sortField={sortField} sortDir={sortDir}
          onSort={(f) => { if (f) handleSort(f); }} onView={(lead) => openDetails(lead, "overview")}
          onStageChange={handleStageChange} onAssign={handleAssign}
          currentPage={currentPage} totalPages={totalPages}
          totalCount={sortedLeads.filter(l => !["won","lost"].includes(l.stage)).length}
          pageSize={PAGE_SIZE} onPage={setCurrentPage} getFollowUpCount={getFollowUpCountForLead}
        />
      </div>

      <AnimatePresence>
        {isDetailsOpen && liveLead && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }} className="fixed inset-0 z-40 bg-black/30" onClick={closeDetails} />
            <motion.div key="panel" initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }} transition={{ duration: 0.28, ease: "easeOut" }}
              className="fixed right-0 top-0 h-full w-[420px] max-w-full z-50 overflow-y-auto"
              style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)",
                borderLeft: "1px solid var(--glass-border-in)", boxShadow: "-4px 0 32px rgba(0,0,0,0.12)" }}>
              <LeadDetailPanel
                lead={liveLead} tenantId={tenantId ?? ""} currentUserId={employeeId ?? undefined}
                employees={employees} leadFollowUps={leadFollowUps} showFollowUpForm={showFollowUpForm}
                followUpData={followUpData} isSalesOnly={isSalesOnly}
                contract={contractByLeadId.get(liveLead.id) ?? null}
                activeTab={activeDetailTab} onTabChange={setActiveDetailTab} onClose={closeDetails}
                onStageChange={handleStageChange} onAssign={handleAssign}
                onAddFollowUp={handleAddFollowUp} onCompleteFollowUp={handleCompleteFollowUp}
                onToggleFollowUpForm={() => setShowFollowUpForm(v => !v)}
                onFollowUpDataChange={setFollowUpData}
                onCreateContract={() => setCreateContractLead(liveLead)}
                onViewContract={(c) => setDetailContract(c)}
                onConvertToProject={() => setConvertLead(liveLead)}
                addActivityLog={(id: string, _t: any, msg: string) => addActivityLog(id, "commented", msg) as any} updateLead={(id: string, data: Partial<Lead>) => updateLead(id, data) as any}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Lead Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--fg-900)" }}>Add New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Name *</label>
              <Input placeholder="Lead name" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Phone</label>
              <Input placeholder="Phone number" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Email</label>
              <Input placeholder="Email address" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Project Type</label>
              <Input placeholder="e.g. 2BHK Residential" value={(addForm as any).projectType} onChange={e => setAddForm(p => ({ ...p, projectType: e.target.value }))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Budget (INR)</label>
              <Input type="number" placeholder="Estimated budget" value={addForm.estimatedValue ?? ""} onChange={e => setAddForm(p => ({ ...p, budget: e.target.value ? Number(e.target.value) : undefined }))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Source</label>
              <Select value={addForm.source ?? ""} onValueChange={v => setAddForm(p => ({ ...p, source: v as Lead["source"] }))}>
                <SelectTrigger style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">✏️ Manual</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Assign To</label>
              <Select value={addForm.assignedTo || "__none__"} onValueChange={v => setAddForm(p => ({ ...p, assignedTo: v === "__none__" ? "" : v }))}>
                <SelectTrigger style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Notes</label>
              <Textarea placeholder="Any initial notes..." value={addForm.notes ?? ""} onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
            <Button onClick={handleAddLead} style={{ background: "var(--brand)", color: "#fff" }} disabled={!addForm.name.trim()}>Add Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <Dialog open={showLostDialog} onOpenChange={open => { if (!open) { setShowLostDialog(false); setLostReason(""); } }}>
        <DialogContent className="sm:max-w-sm" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--fg-900)" }}>Mark as Lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm" style={{ color: "var(--fg-500)" }}>Optionally provide a reason for losing this lead.</p>
            <Textarea placeholder="Reason (optional)" value={lostReason} onChange={e => setLostReason(e.target.value)} rows={3}
              style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowLostDialog(false); setLostReason(""); }} style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
            <Button onClick={confirmLost} style={{ background: "var(--red, #ef4444)", color: "#fff" }}>Confirm Lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget Temperature Settings Dialog */}
      <Dialog open={budgetSettingsOpen} onOpenChange={setBudgetSettingsOpen}>
        <DialogContent className="sm:max-w-sm" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--fg-900)" }}>Budget Temperature Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: "var(--fg-500)" }}>Set budget thresholds to classify lead temperature automatically.</p>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Hot threshold (min budget, INR)</label>
              <Input type="number" value={hotThreshold} onChange={e => setHotThreshold(Number(e.target.value))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Warm threshold (min budget, INR)</label>
              <Input type="number" value={warmThreshold} onChange={e => setWarmThreshold(Number(e.target.value))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Cold threshold (min budget, INR)</label>
              <Input type="number" value={100000} onChange={e => setWarmThreshold(Number(e.target.value))}
                style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetSettingsOpen(false)} style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
            <Button onClick={() => handleSaveBudgetSettings(false)} style={{ background: "var(--brand)", color: "#fff" }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Project Modal */}
      {convertLead && tenantId && (
        <ConvertToProjectModalLocal
          lead={convertLead}
          tenantId={tenantId}
          onClose={() => setConvertLead(null)}
          onSuccess={(projectId) => {
            setConvertLead(null);
            addActivityLog(convertLead.id, "commented", "Lead converted to project #" + projectId);
          }}
        />
      )}

      {/* Create Contract Drawer */}
      {createContractLead && tenantId && (
        <CreateContractDrawerLocal
          lead={createContractLead}
          tenantId={tenantId}
          onClose={() => setCreateContractLead(null)}
          onCreated={(contract) => {
            setCreateContractLead(null);
            addActivityLog(createContractLead.id, "commented", "Contract created: " + contract.title);
          }}
        />
      )}

      {/* View Contract Drawer */}
      {detailContract && tenantId && (
        <ContractDetailDrawerLocal
          contract={detailContract}
          tenantId={tenantId}
          onClose={() => setDetailContract(null)}
        />
      )}
    </div>
  );
}

// ── StatPill ─────────────────────────────────────────────────────────────
function StatPill({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="glass-card rounded-[12px] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-500)" }}>{label}</p>
      <p className="text-[26px] font-bold tabular-nums mt-1 leading-none" style={{ color: valueColor ?? "var(--fg-900)" }}>{value}</p>
    </div>
  );
}

// ── TempBadge ────────────────────────────────────────────────────────────
function TempBadge({ temp, size = "sm" }: { temp: string; size?: "sm" | "md" }) {
  const Icon = temp === "hot" ? Flame : temp === "warm" ? Thermometer : Snowflake;
  const iconCls = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const textCls = size === "md" ? "text-[11px]" : "text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${textCls}`}
      style={{ background: TEMP_BG[temp] ?? TEMP_BG.cold, color: TEMP_COLOR[temp as keyof typeof TEMP_COLOR] ?? "var(--brand)" }}
    >
      <Icon className={iconCls} />
      {TEMP_LABEL[temp] ?? temp}
    </span>
  );
}

// ── KanbanColumn ─────────────────────────────────────────────────────────
interface KanbanColumnProps {
  stage: Lead["stage"];
  leads: Lead[];
  stageTotals: Record<string, number>;
  draggingLeadId: string | null;
  isDragOver: boolean;
  isInvalidDrop: boolean;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onCardClick: (lead: Lead, tab?: "overview" | "activity" | "estimate" | "files") => void;
  onAddLead: () => void;
  onStageChange: (id: string, stage: Lead["stage"]) => void;
  onOpenNote: (lead: Lead) => void;
  employees: any[];
}

function KanbanColumn({ stage, leads, stageTotals, draggingLeadId: _draggingLeadId, isDragOver, isInvalidDrop, onDragStart, onDragEnd, onDrop,
  onDragOver, onDragLeave, onCardClick, onAddLead, onStageChange, onOpenNote, employees }: KanbanColumnProps) {
  const cfg = STAGE_COLOR[stage];
  const total = stageTotals[stage] ?? 0;
  const isOver = isDragOver;
  return (
    <div className="flex flex-col shrink-0 w-64 rounded-2xl overflow-hidden"
      style={{ background: "var(--glass)", border: isDragOver ? "2px solid var(--brand)" : isInvalidDrop ? "2px solid var(--red)" : "1px solid var(--glass-border-in)",
        backdropFilter: "var(--glass-blur)", transition: "border 0.15s" }}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.12)", background: cfg.top }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.95)", letterSpacing: "0.08em" }}>{STAGE_LABELS[stage]}</span>
        <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "rgba(0,0,0,0.22)", color: "#ffffff" }}>{leads.length}</span>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[200px]">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} employees={employees}
            onDragStart={() => onDragStart(lead.id)} onDragEnd={onDragEnd}
            onClick={() => onCardClick(lead)} onOpenNote={() => onOpenNote(lead)}
            onStageChange={onStageChange} />
        ))}
        {stage === "new" && (
          <button onClick={onAddLead} className="mt-1 w-full rounded-xl border-dashed border py-2 text-xs transition-colors hover:bg-white/10"
            style={{ borderColor: "var(--glass-border-in)", color: "var(--fg-400)" }}>+ Add Lead</button>
        )}
      </div>
      {total > 0 && (
        <div className="px-3 py-1.5 text-xs font-medium" style={{ borderTop: "1px solid var(--glass-border-in)", color: "var(--fg-500)" }}>
          Total: {formatAmount(total)}
        </div>
      )}
    </div>
  );
}

// ── LeadCard ─────────────────────────────────────────────────────────────
interface LeadCardProps {
  lead: Lead;
  employees: any[];
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onOpenNote: () => void;
  onStageChange: (id: string, stage: Lead["stage"]) => void;
}

function LeadCard({ lead, employees, onDragStart, onDragEnd, onClick, onOpenNote, onStageChange }: LeadCardProps) {
  const assignee = employees.find(e => e.id === lead.assignedTo);
  const temp = lead.temperature ?? "cold";
  const pill = STAGE_PILL[lead.stage];
  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md select-none"
      style={{ background: "var(--glass-strong, rgba(255,255,255,0.92))", border: "1px solid var(--glass-border-in)" }}
      onClick={onClick}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="font-semibold text-sm leading-tight" style={{ color: "var(--fg-900)" }}>{lead.name}</span>
        <TempBadge temp={temp} />
      </div>
      {(lead as any).projectType && (
        <p className="text-xs mb-1 truncate" style={{ color: "var(--fg-500)" }}>{(lead as any).projectType}</p>
      )}
      {(lead as any).budget && (
        <p className="text-xs font-medium" style={{ color: "var(--brand)" }}>{formatAmount((lead as any).budget)}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        {assignee ? (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-lg"
            style={{ background: "var(--glass)", color: "var(--fg-500)" }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: "var(--brand)" }}>{getInitials(assignee.name)}</span>
            {assignee.name.split(" ")[0]}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--fg-300)" }}>Unassigned</span>
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pill}`}>{STAGE_LABELS[lead.stage]}</span>
      </div>
    </div>
  );
}

// ── InfoField ────────────────────────────────────────────────────────────
function InfoField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: "var(--fg-400)" }}>{label}</p>
      <p className={"text-sm" + (mono ? " font-mono" : "")} style={{ color: "var(--fg-800)" }}>{value}</p>
    </div>
  );
}

// ── SortableHeader ───────────────────────────────────────────────────────
function SortableHeader({ field, label, sortField, sortDir, onSort }: {
  field: string | null; label: string; sortField: string | null; sortDir: "asc" | "desc";
  onSort: (f: string | null) => void;
}) {
  const active = sortField === field;
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold cursor-pointer select-none"
      style={{ color: active ? "var(--brand)" : "var(--fg-500)" }}
      onClick={() => onSort(field)}>
      <span className="flex items-center gap-1">{label}{active ? (sortDir === "asc" ? " ↑" : " ↓") : ""}</span>
    </th>
  );
}

// ── TableGroup ───────────────────────────────────────────────────────────
interface TableGroupProps {
  stage: Lead["stage"];
  leads: Lead[];
  employees: any[];
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (f: string | null) => void;
  onView: (lead: Lead) => void;
  onStageChange: (id: string, stage: Lead["stage"]) => void;
  onAssign: (id: string, uid: string) => void;
  getFollowUpCount: (id: string) => number;
}

function TableGroup({ stage, leads, employees, sortField, sortDir, onSort, onView, onStageChange, onAssign, getFollowUpCount }: TableGroupProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const cfg = STAGE_COLOR[stage];
  if (leads.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--glass-border-in)" }}>
      <button className="w-full flex items-center justify-between px-4 py-2 text-left"
        style={{ background: cfg.top, borderBottom: collapsed ? "none" : "1px solid var(--glass-border-in)" }}
        onClick={() => setCollapsed(v => !v)}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.95)" }}>{STAGE_LABELS[stage]}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ background: cfg.badge }}>{leads.length}</span>
          <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: "var(--fg-500)", transform: collapsed ? "rotate(-90deg)" : "" }} />
        </span>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border-in)", background: "var(--glass)" }}>
                <SortableHeader field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                <SortableHeader field="projectType" label="Type" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                <SortableHeader field="budget" label="Budget" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Temp</th>
                <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Assigned</th>
                <th className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--fg-500)" }}>Follow-ups</th>
                <SortableHeader field="createdAt" label="Created" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => {
                const assignee = employees.find(e => e.id === lead.assignedTo);
                const temp = lead.temperature ?? "cold";
                const fuCount = getFollowUpCount(lead.id);
                return (
                  <tr key={lead.id} className="transition-colors hover:bg-white/5 cursor-pointer"
                    style={{ borderBottom: i < leads.length - 1 ? "1px solid var(--glass-border-in)" : "none" }}
                    onClick={() => onView(lead)}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium" style={{ color: "var(--fg-900)" }}>{lead.name}</div>
                      {lead.phone && <div className="text-xs" style={{ color: "var(--fg-400)" }}>{lead.phone}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--fg-600)" }}>{(lead as any).projectType ?? "-"}</td>
                    <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--brand)" }}>{(lead as any).budget ? formatAmount((lead as any).budget) : "-"}</td>
                    <td className="px-3 py-2.5"><TempBadge temp={temp} /></td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--fg-600)" }}>{assignee ? assignee.name.split(" ")[0] : "-"}</td>
                    <td className="px-3 py-2.5">{fuCount > 0 && <Badge variant="outline" className="text-xs">{fuCount}</Badge>}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--fg-400)" }}>{formatDate(lead.createdAt)}</td>
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <Select value={lead.stage} onValueChange={v => onStageChange(lead.id, v as Lead["stage"])}>
                        <SelectTrigger className="h-7 text-xs w-32" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── GroupedTableView ─────────────────────────────────────────────────────
interface GroupedTableViewProps {
  leads: Lead[];
  employees: any[];
  sortField: string | null;
  sortDir: "asc" | "desc";
  onSort: (f: string | null) => void;
  onView: (lead: Lead) => void;
  onStageChange: (id: string, stage: Lead["stage"]) => void;
  onAssign: (id: string, uid: string) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPage: (p: number) => void;
  getFollowUpCount: (id: string) => number;
}

function GroupedTableView({ leads, employees, sortField, sortDir, onSort, onView,
  onStageChange, onAssign, currentPage, totalPages, totalCount, pageSize, onPage, getFollowUpCount }: GroupedTableViewProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<Lead["stage"], Lead[]>();
    STAGES.forEach(s => map.set(s, []));
    leads.forEach(l => { const arr = map.get(l.stage); if (arr) arr.push(l); });
    return map;
  }, [leads]);

  return (
    <div className="space-y-3">
      {STAGES.map(stage => (
        <TableGroup key={stage} stage={stage} leads={grouped.get(stage) ?? []}
          employees={employees} sortField={sortField} sortDir={sortDir} onSort={onSort}
          onView={onView} onStageChange={onStageChange} onAssign={onAssign}
          getFollowUpCount={getFollowUpCount} />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs" style={{ color: "var(--fg-400)" }}>
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => onPage(currentPage - 1)}
              style={{ border: "1px solid var(--glass-border-in)" }}>Prev</Button>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => onPage(currentPage + 1)}
              style={{ border: "1px solid var(--glass-border-in)" }}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LeadDetailPanel ──────────────────────────────────────────────────────
interface LeadDetailPanelProps {
  lead: Lead;
  tenantId: string;
  currentUserId?: string;
  employees: any[];
  leadFollowUps: FollowUp[];
  showFollowUpForm: boolean;
  followUpData: { type: FollowUp["type"]; date: string; notes: string };
  isSalesOnly: boolean;
  contract: Contract | null;
  activeTab: "overview" | "activity" | "estimate" | "files";
  onTabChange: (t: "overview" | "activity" | "estimate" | "files") => void;
  onClose: () => void;
  onStageChange: (id: string, stage: Lead["stage"]) => void;
  onAssign: (id: string, uid: string) => void;
  onAddFollowUp: () => void;
  onCompleteFollowUp: (id: string) => void;
  onToggleFollowUpForm: () => void;
  onFollowUpDataChange: (d: { type: FollowUp["type"]; date: string; notes: string }) => void;
  onCreateContract: () => void;
  onViewContract: (c: Contract) => void;
  onConvertToProject: () => void;
  addActivityLog: (leadId: string, type: ActivityType, message: string) => Promise<void>;
  updateLead: (id: string, data: Partial<Lead>) => Promise<boolean | void>;
}

function LeadDetailPanel({
  lead, tenantId, currentUserId, employees, leadFollowUps, showFollowUpForm,
  followUpData, isSalesOnly, contract, activeTab, onTabChange, onClose,
  onStageChange, onAssign, onAddFollowUp, onCompleteFollowUp, onToggleFollowUpForm,
  onFollowUpDataChange, onCreateContract, onViewContract, onConvertToProject,
  addActivityLog, updateLead,
}: LeadDetailPanelProps) {
  const [activities, setActivities] = React.useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = React.useState(false);
  const [quickLogType, setQuickLogType] = React.useState<ActivityType>("call");
  const [quickLogNote, setQuickLogNote] = React.useState("");
  const [quickLogSaving, setQuickLogSaving] = React.useState(false);
  const [showQuickLog, setShowQuickLog] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState(false);
  const [noteValue, setNoteValue] = React.useState(lead.notes ?? "");
  const [editingFields, setEditingFields] = React.useState(false);
  const [editData, setEditData] = React.useState({
    name: lead.name, phone: lead.phone ?? "", email: lead.email ?? "",
    projectType: (lead as any).projectType ?? "", budget: (lead as any).budget ?? "",
    address: (lead as any).address ?? "", source: lead.source ?? "manual",
  });

  // Load activity logs when activity tab opens
  function reloadActivities() {
    setLoadingActivity(true);
    const db = getDb();
    getDocs(query(
      collection(db, `tenants/${tenantId}/leads/${lead.id}/activityLog`),
      orderBy("createdAt", "desc"),
    )).then(snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setActivities([])).finally(() => setLoadingActivity(false));
  }

  React.useEffect(() => {
    if (activeTab !== "activity") return;
    reloadActivities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lead.id, tenantId]);

  async function handleQuickLog() {
    if (!quickLogNote.trim() && quickLogType !== "note") {
      // allow saving with just type label if no notes
    }
    setQuickLogSaving(true);
    const msg = quickLogNote.trim()
      ? `${ACTIVITY_LABELS[quickLogType]}: ${quickLogNote.trim()}`
      : ACTIVITY_LABELS[quickLogType];
    await addActivityLog(lead.id, quickLogType, msg);
    setQuickLogNote("");
    setShowQuickLog(false);
    reloadActivities();
    setQuickLogSaving(false);
  }

  React.useEffect(() => {
    setNoteValue(lead.notes ?? "");
    setEditData({
      name: lead.name, phone: lead.phone ?? "", email: lead.email ?? "",
      projectType: (lead as any).projectType ?? "", budget: (lead as any).budget ?? "",
      address: (lead as any).address ?? "", source: lead.source ?? "manual",
    });
  }, [lead]);

  const assignee = employees.find(e => e.id === lead.assignedTo);
  const temp = lead.temperature ?? "cold";
  const pendingFollowUps = leadFollowUps.filter(f => f.status === "pending");
  const completedFollowUps = leadFollowUps.filter(f => f.status === "completed");
  const tabs: { id: "overview" | "activity" | "estimate" | "files"; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity" },
    { id: "estimate", label: "Estimate" },
    { id: "files", label: "Files" },
  ];

  async function handleSaveNote() {
    await updateLead(lead.id, { notes: noteValue });
    await (addActivityLog as any)(lead.id, "commented", "Note updated");
    setEditingNote(false);
  }

  async function handleSaveFields() {
    await updateLead(lead.id, {
      name: editData.name,
      phone: editData.phone || undefined,
      email: editData.email || undefined,
      // projectType field skipped (not in Lead type)
      estimatedValue: editData.budget ? Number(editData.budget) : 0,
      // address field skipped (not in Lead type)
      source: editData.source as Lead["source"],
    });
    await (addActivityLog as any)(lead.id, "commented", "Lead details updated");
    setEditingFields(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TempBadge temp={temp} size="md" />
            <h2 className="font-bold text-base truncate" style={{ color: "var(--fg-900)" }}>{lead.name}</h2>
          </div>
          {(lead as any).projectType && <p className="text-sm" style={{ color: "var(--fg-500)" }}>{(lead as any).projectType}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_PILL[lead.stage]}`}>{STAGE_LABELS[lead.stage]}</span>
            {(lead as any).budget && <span className="text-xs font-semibold" style={{ color: "var(--brand)" }}>{formatAmount((lead as any).budget)}</span>}
            {SOURCE_ICON[lead.source ?? "manual"] && <span className="text-xs" style={{ color: "var(--fg-400)" }}>{SOURCE_ICON[lead.source ?? "manual"]} {lead.source}</span>}
          </div>
        </div>
        <button onClick={onClose} className="ml-2 p-1 rounded-lg transition-colors hover:bg-black/5" style={{ color: "var(--fg-400)" }}>
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Lead["stage"] + Assign Row */}
      <div className="px-4 py-2 flex gap-2" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
        <Select value={lead.stage} onValueChange={v => onStageChange(lead.id, v as Lead["stage"])}>
          <SelectTrigger className="h-8 text-xs flex-1" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={lead.assignedTo || "__none__"} onValueChange={v => onAssign(lead.id, v === "__none__" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs flex-1" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
            <SelectValue placeholder="Assign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex px-4 pt-2 gap-1" style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => onTabChange(t.id)}
            className="px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors"
            style={activeTab === t.id
              ? { color: "var(--brand)", borderBottom: "2px solid var(--brand)", marginBottom: "-1px" }
              : { color: "var(--fg-400)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--fg-700)" }}>Lead Details</h3>
              {!editingFields && (
                <button onClick={() => setEditingFields(true)} className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: "var(--brand)" }}>Edit</button>
              )}
            </div>

            {editingFields ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Name</label>
                  <Input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Phone</label>
                  <Input value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Email</label>
                  <Input value={editData.email} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Project Type</label>
                  <Input value={editData.projectType} onChange={e => setEditData(p => ({ ...p, projectType: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Budget (INR)</label>
                  <Input type="number" value={editData.budget} onChange={e => setEditData(p => ({ ...p, budget: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-0.5 block" style={{ color: "var(--fg-500)" }}>Address</label>
                  <Input value={editData.address} onChange={e => setEditData(p => ({ ...p, address: e.target.value }))}
                    className="h-8 text-sm" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setEditingFields(false)}
                    style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveFields} style={{ background: "var(--brand)", color: "#fff" }}>Save</Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoField label="Phone" value={lead.phone} />
                <InfoField label="Email" value={lead.email} />
                <InfoField label="Budget" value={(lead as any).budget ? formatAmount((lead as any).budget) : undefined} />
                <InfoField label="Source" value={lead.source} />
                <InfoField label="Address" value={(lead as any).address} />
                <InfoField label="Created" value={formatDate(lead.createdAt)} />
                {lead.projectId && <InfoField label="Project" value={lead.projectId} mono />}
              </div>
            )}

            {/* Notes */}
            <div className="pt-2" style={{ borderTop: "1px solid var(--glass-border-in)" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold" style={{ color: "var(--fg-700)" }}>Notes</h3>
                {!editingNote && (
                  <button onClick={() => setEditingNote(true)} className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-black/5"
                    style={{ color: "var(--brand)" }}>Edit</button>
                )}
              </div>
              {editingNote ? (
                <div className="space-y-2">
                  <Textarea value={noteValue} onChange={e => setNoteValue(e.target.value)} rows={4}
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setEditingNote(false); setNoteValue(lead.notes ?? ""); }}
                      style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNote} style={{ background: "var(--brand)", color: "#fff" }}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: lead.notes ? "var(--fg-700)" : "var(--fg-300)" }}>
                  {lead.notes || "No notes yet."}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--glass-border-in)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--fg-700)" }}>Actions</h3>
              {!isSalesOnly && !contract && lead.stage !== "won" && lead.stage !== "lost" && (
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={onCreateContract}
                  style={{ border: "1px solid var(--glass-border-in)" }}>
                  <FileText className="h-4 w-4" /> Create Contract
                </Button>
              )}
              {contract && (
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => onViewContract(contract)}
                  style={{ border: "1px solid var(--glass-border-in)" }}>
                  <FileText className="h-4 w-4" /> View Contract
                </Button>
              )}
              {lead.stage === "won" && !lead.projectId && (
                <Button size="sm" className="w-full justify-start gap-2" onClick={onConvertToProject}
                  style={{ background: "var(--brand)", color: "#fff" }}>
                  <FolderOpen className="h-4 w-4" /> Convert to Project
                </Button>
              )}
              {lead.projectId && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--green, #22c55e)" }}>
                  <FolderOpen className="h-4 w-4" /> Linked to project
                </div>
              )}
            </div>

            {/* Follow-ups */}
            <div className="pt-2" style={{ borderTop: "1px solid var(--glass-border-in)" }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold" style={{ color: "var(--fg-700)" }}>Follow-ups</h3>
                <button onClick={onToggleFollowUpForm}
                  className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-black/5"
                  style={{ color: "var(--brand)" }}>
                  {showFollowUpForm ? "Cancel" : "+ Add"}
                </button>
              </div>

              {showFollowUpForm && (
                <div className="space-y-2 p-3 rounded-xl mb-3" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                  <Select value={followUpData.type} onValueChange={v => onFollowUpDataChange({ ...followUpData, type: v as FollowUp["type"] })}>
                    <SelectTrigger className="h-8 text-xs" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FOLLOW_UP_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{FOLLOWUP_EMOJI[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="datetime-local" value={followUpData.date}
                    onChange={e => onFollowUpDataChange({ ...followUpData, date: e.target.value })}
                    className="h-8 text-xs" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                  <Input placeholder="Notes (optional)" value={followUpData.notes}
                    onChange={e => onFollowUpDataChange({ ...followUpData, notes: e.target.value })}
                    className="h-8 text-xs" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
                  <Button size="sm" className="w-full" onClick={onAddFollowUp}
                    style={{ background: "var(--brand)", color: "#fff" }} disabled={!followUpData.date}>
                    Schedule
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {pendingFollowUps.length === 0 && completedFollowUps.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--fg-300)" }}>No follow-ups scheduled.</p>
                )}
                {pendingFollowUps.map(fu => (
                  <div key={fu.id} className="flex items-start justify-between gap-2 p-2 rounded-lg"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span>{FOLLOWUP_EMOJI[fu.type]}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--fg-800)" }}>{fu.type}</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--fg-500)" }}>{formatDateTime(fu.scheduledAt)}</p>
                      {fu.notes && <p className="text-xs truncate" style={{ color: "var(--fg-400)" }}>{fu.notes}</p>}
                    </div>
                    <button onClick={() => onCompleteFollowUp(fu.id)} className="shrink-0 text-xs px-2 py-1 rounded-lg"
                      style={{ background: "var(--green, #22c55e)", color: "#fff" }}>Done</button>
                  </div>
                ))}
                {completedFollowUps.slice(0, 3).map(fu => (
                  <div key={fu.id} className="flex items-center gap-2 p-2 rounded-lg opacity-50"
                    style={{ border: "1px solid var(--glass-border-in)" }}>
                    <span className="text-xs line-through" style={{ color: "var(--fg-500)" }}>
                      {FOLLOWUP_EMOJI[fu.type]} {fu.type} - {formatDate(fu.scheduledAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-3">
            {/* Quick-log buttons */}
            <div className="flex gap-1.5 flex-wrap">
              {(["call", "whatsapp", "note", "site_visit"] as ActivityType[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setQuickLogType(t); setShowQuickLog(true); setQuickLogNote(""); }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={showQuickLog && quickLogType === t
                    ? { background: "var(--brand)", color: "#fff" }
                    : { background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-700)" }}
                >
                  {t === "call" ? <Phone className="h-3.5 w-3.5" /> : t === "whatsapp" ? <MessageCircle className="h-3.5 w-3.5" /> : t === "note" ? <FileText className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                  {ACTIVITY_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Quick-log inline form */}
            {showQuickLog && (
              <div className="p-3 rounded-xl space-y-2" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                <p className="text-xs font-medium" style={{ color: "var(--fg-700)" }}>
                  {ACTIVITY_LABELS[quickLogType]} — add notes
                </p>
                <textarea
                  value={quickLogNote}
                  onChange={e => setQuickLogNote(e.target.value)}
                  rows={2}
                  placeholder="Summary / notes (optional)"
                  className="w-full text-sm rounded-lg px-2 py-1.5 resize-none outline-none"
                  style={{ background: "var(--glass-strong)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }}
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowQuickLog(false); setQuickLogNote(""); }}
                    className="px-3 py-1 rounded-lg text-xs"
                    style={{ border: "1px solid var(--glass-border-in)", color: "var(--fg-500)" }}>
                    Cancel
                  </button>
                  <button onClick={handleQuickLog} disabled={quickLogSaving}
                    className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-60"
                    style={{ background: "var(--brand)", color: "#fff" }}>
                    {quickLogSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}

            {loadingActivity ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--glass)" }} />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--fg-300)" }}>No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activities.map(act => (
                  <div key={act.id} className="flex gap-3 p-2.5 rounded-xl"
                    style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                    <span className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full" style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}>
                      {act.action === "status_changed" ? <RefreshCw className="h-3.5 w-3.5" style={{ color: "var(--fg-500)" }} />
                        : act.action === "assigned" ? <User className="h-3.5 w-3.5" style={{ color: "var(--brand)" }} />
                        : act.action === "uploaded" ? <Paperclip className="h-3.5 w-3.5" style={{ color: "var(--fg-500)" }} />
                        : act.action === "payment_recorded" ? <IndianRupee className="h-3.5 w-3.5" style={{ color: "var(--green, #22c55e)" }} />
                        : <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--fg-400)" }} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: "var(--fg-800)" }}>{act.summary ?? act.message ?? act.action}</p>
                      <p className="text-xs" style={{ color: "var(--fg-400)" }}>{timeAgo(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ESTIMATE TAB */}
        {activeTab === "estimate" && (
          <div className="space-y-3">
            <EstimateTab lead={lead} tenantId={tenantId} />
          </div>
        )}

        {/* FILES TAB */}
        {activeTab === "files" && (
          <div className="space-y-3">
            <FilesTab lead={lead} tenantId={tenantId} />
          </div>
        )}

      </div>
    </div>
  );
}

// ── EstimateTab ──────────────────────────────────────────────────────────
function EstimateTab({ lead, tenantId }: { lead: Lead; tenantId: string }) {
  const [items, setItems] = React.useState<{ id: string; description: string; qty: number; rate: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    const db = getDb();
    getDoc(doc(db, `tenants/${tenantId}/leads/${lead.id}/estimate/draft`)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setItems(data.items ?? []);
        setNotes(data.notes ?? "");
      } else {
        setItems([{ id: Date.now().toString(), description: "", qty: 1, rate: 0 }]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lead.id, tenantId]);

  const total = items.reduce((s, i) => s + i.qty * i.rate, 0);

  function addItem() {
    setItems(p => [...p, { id: Date.now().toString(), description: "", qty: 1, rate: 0 }]);
  }

  function removeItem(id: string) {
    setItems(p => p.filter(i => i.id !== id));
  }

  function updateItem(id: string, key: string, value: string | number) {
    setItems(p => p.map(i => i.id === id ? { ...i, [key]: value } : i));
  }

  async function saveEstimate() {
    setSaving(true);
    const { setDoc } = await import("firebase/firestore");
    const db = getDb();
    await setDoc(doc(db, `tenants/${tenantId}/leads/${lead.id}/estimate/draft`), {
      items, notes, total, updatedAt: serverTimestamp(),
    });
    setSaving(false);
  }

  if (loading) return <div className="animate-pulse h-32 rounded-xl" style={{ background: "var(--glass)" }} />;

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--glass-border-in)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "var(--glass)", borderBottom: "1px solid var(--glass-border-in)" }}>
              <th className="px-2 py-1.5 text-left font-semibold" style={{ color: "var(--fg-500)" }}>Description</th>
              <th className="px-2 py-1.5 text-right font-semibold w-12" style={{ color: "var(--fg-500)" }}>Qty</th>
              <th className="px-2 py-1.5 text-right font-semibold w-20" style={{ color: "var(--fg-500)" }}>Rate</th>
              <th className="px-2 py-1.5 text-right font-semibold w-20" style={{ color: "var(--fg-500)" }}>Amount</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: "1px solid var(--glass-border-in)" }}>
                <td className="px-2 py-1">
                  <input className="w-full bg-transparent text-xs outline-none" style={{ color: "var(--fg-900)" }}
                    value={item.description} onChange={e => updateItem(item.id, "description", e.target.value)} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-full bg-transparent text-xs text-right outline-none" style={{ color: "var(--fg-900)" }}
                    value={item.qty} onChange={e => updateItem(item.id, "qty", Number(e.target.value))} />
                </td>
                <td className="px-2 py-1">
                  <input type="number" className="w-full bg-transparent text-xs text-right outline-none" style={{ color: "var(--fg-900)" }}
                    value={item.rate} onChange={e => updateItem(item.id, "rate", Number(e.target.value))} />
                </td>
                <td className="px-2 py-1 text-right" style={{ color: "var(--fg-800)" }}>{formatAmount(item.qty * item.rate)}</td>
                <td className="px-1">
                  <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600">
                    <X className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--glass)" }}>
              <td colSpan={3} className="px-2 py-2 text-right text-xs font-semibold" style={{ color: "var(--fg-700)" }}>Total</td>
              <td className="px-2 py-2 text-right text-sm font-bold" style={{ color: "var(--brand)" }}>{formatAmount(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addItem} className="text-xs w-full py-1.5 rounded-lg transition-colors hover:bg-white/10"
        style={{ border: "1px dashed var(--glass-border-in)", color: "var(--fg-400)" }}>+ Add Line Item</button>
      <Textarea placeholder="Estimate notes / terms..." value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
      <Button size="sm" className="w-full" onClick={saveEstimate} disabled={saving}
        style={{ background: "var(--brand)", color: "#fff" }}>
        {saving ? "Saving..." : "Save Estimate"}
      </Button>
    </div>
  );
}

// ── FilesTab ─────────────────────────────────────────────────────────────
function FilesTab({ lead, tenantId }: { lead: Lead; tenantId: string }) {
  const [files, setFiles] = React.useState<{ id: string; name: string; url: string; size: number; createdAt: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const db = getDb();
    getDocs(query(
      collection(db, `tenants/${tenantId}/leads/${lead.id}/files`),
      orderBy("createdAt", "desc"),
    )).then(snap => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [lead.id, tenantId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, tenantId, "leads");
      const db = getDb();
      await addDoc(collection(db, `tenants/${tenantId}/leads/${lead.id}/files`), {
        name: file.name, url, size: file.size, type: file.type, createdAt: serverTimestamp(),
      });
      // Refetch
      const snap = await getDocs(query(
        collection(db, `tenants/${tenantId}/leads/${lead.id}/files`),
        orderBy("createdAt", "desc"),
      ));
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (loading) return <div className="animate-pulse h-24 rounded-xl" style={{ background: "var(--glass)" }} />;

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()}
        disabled={uploading} style={{ border: "1px solid var(--glass-border-in)" }}>
        <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload File"}
      </Button>
      {files.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--fg-300)" }}>No files uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl transition-colors hover:bg-white/5"
              style={{ border: "1px solid var(--glass-border-in)", display: "flex" }}>
              <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--brand)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium" style={{ color: "var(--fg-800)" }}>{f.name}</p>
                <p className="text-xs" style={{ color: "var(--fg-400)" }}>{(f.size / 1024).toFixed(1)} KB</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ConvertToProjectModal ─────────────────────────────────────────────────
function ConvertToProjectModalLocal({ lead, tenantId, onClose, onSuccess }: {
  lead: Lead; tenantId: string; onClose: () => void; onSuccess: (projectId: string) => void;
}) {
  const [projectName, setProjectName] = React.useState(lead.name + " Project");
  const [converting, setConverting] = React.useState(false);

  async function handleConvert() {
    setConverting(true);
    try {
      const { createProjectFromLead } = await import("@/lib/services/projectService");
      const projectId = await createProjectFromLead(lead, tenantId);
      onSuccess(projectId);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--fg-900)" }}>Convert to Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm" style={{ color: "var(--fg-500)" }}>This will create a new project linked to this lead.</p>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Project Name</label>
            <Input value={projectName} onChange={e => setProjectName(e.target.value)}
              style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
          <Button onClick={handleConvert} disabled={converting || !projectName.trim()}
            style={{ background: "var(--brand)", color: "#fff" }}>
            {converting ? "Converting..." : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── CreateContractDrawer ──────────────────────────────────────────────────
function CreateContractDrawerLocal({ lead, tenantId, onClose, onCreated }: {
  lead: Lead; tenantId: string; onClose: () => void; onCreated: (contract: Contract) => void;
}) {
  const [title, setTitle] = React.useState(lead.name + " - Interior Design Contract");
  const [value, setValue] = React.useState((lead as any).budget?.toString() ?? "");
  const [creating, setCreating] = React.useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const { createContract } = await import("@/lib/services/contractService");
      const contractId = await createContract(tenantId, {
        contractNumber: "DRAFT-" + Date.now(), type: "client" as const, title,
        status: "draft" as const, partyA: { name: "Studio", email: "" },
        partyB: { name: lead.name, email: lead.email ?? "" }, clauses: [],
        customFields: { leadId: lead.id } as any, tenantId,
      });
      onCreated({ id: contractId } as any as Contract);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--fg-900)" }}>Create Contract</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Contract Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)}
              style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>Contract Value (INR)</label>
            <Input type="number" value={value} onChange={e => setValue(e.target.value)}
              style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)", color: "var(--fg-900)" }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ border: "1px solid var(--glass-border-in)" }}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !title.trim()}
            style={{ background: "var(--brand)", color: "#fff" }}>
            {creating ? "Creating..." : "Create Contract"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ContractDetailDrawer ──────────────────────────────────────────────────
function ContractDetailDrawerLocal({ contract, tenantId, onClose }: {
  contract: Contract; tenantId: string; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md" style={{ background: "var(--glass-strong, var(--glass))", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border-in)" }}>
        <DialogHeader>
          <DialogTitle style={{ color: "var(--fg-900)" }}>{contract.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <InfoField label="Client" value={contract.partyB?.name ?? ""} />
          <InfoField label="Email" value={contract.partyB?.email ?? ""} />
          {(contract.customFields as any)?.totalValue && <InfoField label="Value" value={formatAmount((contract.customFields as any)?.totalValue)} />}
          <InfoField label="Status" value={contract.status} />
          <InfoField label="Created" value={formatDate(contract.createdAt)} />
          {contract.partyBSignedAt && <InfoField label="Signed" value={formatDate(contract.partyBSignedAt)} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} style={{ border: "1px solid var(--glass-border-in)" }}>Close</Button>
          {contract.pdfUrl && (
            <Button asChild style={{ background: "var(--brand)", color: "#fff" }}>
              <a href={contract.pdfUrl} target="_blank" rel="noopener noreferrer">Download PDF</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
