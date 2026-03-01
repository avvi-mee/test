"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  Download,
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
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useLeads, Lead, isValidTransition } from "@/hooks/useLeads";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useFollowUps, FollowUp } from "@/hooks/useFollowUps";
import { useEmployees } from "@/hooks/useEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogClose,
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

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-cyan-100 text-cyan-700",
  qualified: "bg-purple-100 text-purple-700",
  proposal_sent: "bg-indigo-100 text-indigo-700",
  negotiation: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const TEMP_COLORS: Record<string, string> = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-orange-100 text-orange-700",
  cold: "bg-sky-100 text-sky-700",
};

const FOLLOW_UP_TYPES = ["call", "email", "meeting", "site_visit", "whatsapp"] as const;

export default function SalesPipelinePage() {
  const { tenant } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const { leads, stats, loading, assignLead, changeStage, addActivityLog, recalculateScore } = useLeads(tenantId);
  const { employeeId, roles } = useCurrentUser();
  const { followUps, todayFollowUps, overdueFollowUps, addFollowUp, completeFollowUp } = useFollowUps(tenantId);
  const { employees } = useEmployees(tenantId);

  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpData, setFollowUpData] = useState({ type: "call" as FollowUp["type"], date: "", notes: "" });
  const [lostReason, setLostReason] = useState("");
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);

  const leadFollowUps = useMemo(() => {
    if (!selectedLead) return [];
    return followUps.filter((f) => f.leadId === selectedLead.id);
  }, [followUps, selectedLead]);

  const searchLower = searchQuery.toLowerCase();
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        !searchQuery ||
        l.name.toLowerCase().includes(searchLower) ||
        l.phone?.includes(searchQuery) ||
        l.email?.toLowerCase().includes(searchLower);
      const matchesStage = stageFilter === "all" || l.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [leads, searchQuery, searchLower, stageFilter]);

  // Sales reps only see leads assigned to them (or unassigned); owners/admins see all
  const isSalesOnly = roles.includes("sales") && !roles.includes("owner");
  const visibleLeads = useMemo(() => {
    if (!isSalesOnly) return filteredLeads;
    return filteredLeads.filter((l) => !l.assignedTo || l.assignedTo === employeeId);
  }, [filteredLeads, isSalesOnly, employeeId]);

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
    if (!amount) return "-";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
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

  const handleAssign = async (leadId: string, employeeId: string) => {
    await assignLead(leadId, employeeId);
  };

  const handleAddFollowUp = async () => {
    if (!selectedLead || !followUpData.date) return;
    await addFollowUp({
      leadId: selectedLead.id,
      tenantId: tenantId!,
      type: followUpData.type,
      scheduledAt: new Date(followUpData.date).toISOString(),
      status: "pending",
      notes: followUpData.notes || undefined,
    });
    await addActivityLog(selectedLead.id, "updated", `Follow-up scheduled: ${followUpData.type}${followUpData.notes ? ` - ${followUpData.notes}` : ""}`);
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

  const getFollowUpCountForLead = (leadId: string) => {
    return followUps.filter((f) => f.leadId === leadId && f.status === "pending").length;
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading sales pipeline...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-500 text-sm">Manage leads from inquiry to conversion</p>
        </div>
        <div className="flex items-center gap-3">
          {overdueFollowUps.length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 py-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              {overdueFollowUps.length} overdue follow-ups
            </Badge>
          )}
          {todayFollowUps.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 py-1.5">
              <Clock className="h-3.5 w-3.5" />
              {todayFollowUps.length} due today
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="h-3 w-3" /> Hot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.hotCount}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
              <Thermometer className="h-3 w-3" /> Warm
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.warmCount}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-sky-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
              <Snowflake className="h-3 w-3" /> Cold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-sky-600">{stats.coldCount}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Pipeline Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {formatAmount(stats.totalValue)}
            </div>
            <p className="text-xs text-gray-500 mt-1">{stats.conversionRate}% conversion</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-10 bg-white border-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[180px] bg-white">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {visibleLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No leads found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-transparent">
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Client</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Budget</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Stage</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Temperature</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Assigned To</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Follow-ups</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Last Contact</TableHead>
                  <TableHead className="text-[10px] font-bold text-gray-400 uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleLeads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetails(lead)}>
                    <TableCell>
                      <div className="font-semibold text-gray-900">{lead.name}</div>
                      <div className="text-xs text-gray-500">{lead.phone}</div>
                    </TableCell>
                    <TableCell className="font-bold text-gray-900">
                      {formatAmount(lead.estimatedValue)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.stage}
                        onValueChange={(val) => handleStageChange(lead.id, val)}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs border-none shadow-none">
                          <Badge className={cn("text-[10px] border-none", STAGE_COLORS[lead.stage])}>
                            {STAGE_LABELS[lead.stage]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.filter((s) => s === lead.stage || isValidTransition(lead.stage, s)).map((s) => (
                            <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] capitalize border-none", TEMP_COLORS[lead.temperature])}>
                        {lead.temperature}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.assignedTo || "unassigned"}
                        onValueChange={(val) => val !== "unassigned" && handleAssign(lead.id, val)}
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <SelectValue>
                            {employees.find(e => e.id === lead.assignedTo)?.name || <span className="text-gray-400 italic">Unassigned</span>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" disabled>Assign to...</SelectItem>
                          {employees.filter((e) => e.isActive).map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {getFollowUpCountForLead(lead.id) > 0 ? (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Calendar className="h-3 w-3" />
                          {getFollowUpCountForLead(lead.id)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {formatDate(lead.lastContactedAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => openDetails(lead)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lead Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl shadow-2xl">
          <DialogTitle className="sr-only">
            {selectedLead ? `Lead: ${selectedLead.name}` : "Lead Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">Lead details, follow-ups, and activity timeline.</DialogDescription>

          {selectedLead && (
            <>
              {/* ── Sticky Header ── */}
              <div className="shrink-0 bg-white px-6 pt-5 pb-5 border-b border-gray-100">
                {/* Top row: avatar + name + close */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-2xl shrink-0">
                      {selectedLead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 leading-tight">{selectedLead.name}</h2>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {selectedLead.email && (
                          <span className="text-sm text-gray-500 truncate max-w-[200px]">{selectedLead.email}</span>
                        )}
                        {selectedLead.phone && (
                          <span className="text-sm text-gray-500 flex items-center gap-1 shrink-0">
                            <Phone className="h-3.5 w-3.5 text-gray-400" />
                            {selectedLead.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogClose asChild>
                    <button className="rounded-full p-1.5 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 shrink-0 mt-0.5">
                      <X className="h-4 w-4" />
                    </button>
                  </DialogClose>
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  <Badge className={cn("text-xs border-none px-2.5 py-1 font-semibold rounded-full", STAGE_COLORS[selectedLead.stage])}>
                    {STAGE_LABELS[selectedLead.stage]}
                  </Badge>
                  <Badge className={cn("text-xs capitalize border-none px-2.5 py-1 font-semibold rounded-full", TEMP_COLORS[selectedLead.temperature])}>
                    {selectedLead.temperature}
                  </Badge>
                  <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full font-semibold">
                    Score {selectedLead.score}
                  </span>
                  {selectedLead.source && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full capitalize">
                      {selectedLead.source.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {selectedLead.stage !== "won" && selectedLead.stage !== "lost" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-9 text-sm bg-green-600 hover:bg-green-700 text-white gap-2 px-4 rounded-lg"
                      onClick={() => {
                        handleStageChange(selectedLead.id, "won");
                        setSelectedLead({ ...selectedLead, stage: "won" });
                      }}
                    >
                      <CheckCircle className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-sm border-red-200 text-red-600 hover:bg-red-50 gap-2 px-4 rounded-lg"
                      onClick={() => handleStageChange(selectedLead.id, "lost")}
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                    <Select
                      value={selectedLead.stage}
                      onValueChange={(val) => {
                        handleStageChange(selectedLead.id, val);
                        if (val !== "lost") setSelectedLead({ ...selectedLead, stage: val as Lead["stage"] });
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm rounded-lg w-40 ml-auto">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          <span>Move Stage</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.filter((s) => s === selectedLead.stage || isValidTransition(selectedLead.stage, s)).map((s) => (
                          <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
                    selectedLead.stage === "won" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    {selectedLead.stage === "won" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {selectedLead.stage === "won" ? "Lead Won" : "Lead Lost"}
                  </div>
                )}
              </div>

              {/* ── Scrollable Body ── */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-gray-50/50 px-6 py-5 space-y-4">

                {/* Lead Info Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/70">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <User className="h-3.5 w-3.5" /> Lead Information
                    </p>
                  </div>
                  <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedLead.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedLead.phone || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-sm font-semibold text-gray-900 break-all">{selectedLead.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">City</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedLead.city || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Assigned To</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {employees.find(e => e.id === selectedLead.assignedTo)?.name || (
                          <span className="text-gray-400 italic font-normal">Unassigned</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Created</p>
                      <p className="text-sm font-medium text-gray-700">{formatDate(selectedLead.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Last Contact</p>
                      <p className="text-sm font-medium text-gray-700">{formatDate(selectedLead.lastContactedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Budget Card */}
                <div className="rounded-xl bg-slate-900 p-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">Estimated Budget</p>
                      <p className="text-4xl font-black tracking-tight text-white">
                        {formatAmount(selectedLead.estimatedValue) || "—"}
                      </p>
                    </div>
                    <Badge className="text-xs bg-white/10 text-slate-200 border-none hover:bg-white/10 font-semibold px-3 py-1 rounded-full">
                      {STAGE_LABELS[selectedLead.stage]}
                    </Badge>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-700/60">
                    <span className="text-xs text-slate-400">Pipeline value · {selectedLead.temperature} lead</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedLead.notes && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-amber-100/70 bg-amber-100/40">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Notes</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-amber-900 leading-relaxed">{selectedLead.notes}</p>
                    </div>
                  </div>
                )}

                {/* Follow-ups Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/70 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" /> Follow-ups
                      <span className="bg-slate-200 text-slate-700 text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {leadFollowUps.length}
                      </span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 rounded-lg bg-white"
                      onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>

                  <div className="p-4 space-y-3">
                    {showFollowUpForm && (
                      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                        <Select
                          value={followUpData.type}
                          onValueChange={(val) => setFollowUpData({ ...followUpData, type: val as FollowUp["type"] })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FOLLOW_UP_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="datetime-local"
                          className="h-9 text-xs rounded-lg bg-white"
                          value={followUpData.date}
                          onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                        />
                        <Input
                          placeholder="Notes (optional)"
                          className="h-9 text-xs rounded-lg bg-white"
                          value={followUpData.notes}
                          onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowFollowUpForm(false)}>Cancel</Button>
                          <Button size="sm" className="h-8 text-xs bg-slate-900 hover:bg-slate-800" onClick={handleAddFollowUp}>Schedule</Button>
                        </div>
                      </div>
                    )}

                    {leadFollowUps.length === 0 && !showFollowUpForm ? (
                      <div className="flex flex-col items-center justify-center py-7 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <Calendar className="h-7 w-7 text-gray-300 mb-2" />
                        <p className="text-xs text-gray-400 font-medium">No follow-ups scheduled</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">Click + Add to schedule one</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leadFollowUps.map((fu) => (
                          <div key={fu.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <Badge variant="outline" className="capitalize text-[10px] px-2 py-0.5 rounded-md font-semibold">
                                  {fu.type.replace(/_/g, " ")}
                                </Badge>
                                <Badge className={cn("text-[10px] border-none px-2 py-0.5 rounded-md font-semibold",
                                  fu.status === "completed" ? "bg-green-100 text-green-700" :
                                  fu.status === "missed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {fu.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600 font-medium">{formatDateTime(fu.scheduledAt)}</p>
                              {fu.notes && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{fu.notes}</p>}
                            </div>
                            {fu.status === "pending" && (
                              <button
                                onClick={() => handleCompleteFollowUp(fu.id)}
                                className="ml-3 shrink-0 rounded-full p-1.5 hover:bg-green-50 transition-colors"
                                title="Mark complete"
                              >
                                <CheckCircle className="h-4.5 w-4.5 text-green-500" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Activity Timeline Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/70">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5" /> Activity Timeline
                    </p>
                  </div>
                  <div className="p-5">
                    {/* Lead created */}
                    <div className="flex gap-3 pb-4">
                      <div className="flex flex-col items-center shrink-0">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        {(selectedLead.timeline?.length ?? 0) > 0 && (
                          <div className="w-px flex-1 bg-gray-200 mt-1.5" />
                        )}
                      </div>
                      <div className="pt-0.5 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">Lead Created</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(selectedLead.createdAt)}</p>
                      </div>
                    </div>

                    {selectedLead.timeline?.map((event, idx) => (
                      <div key={idx} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="h-8 w-8 rounded-full bg-blue-50 border-2 border-white shadow-sm flex items-center justify-center">
                            <Activity className="h-3.5 w-3.5 text-blue-500" />
                          </div>
                          {idx < (selectedLead.timeline?.length ?? 0) - 1 && (
                            <div className="w-px flex-1 bg-gray-200 mt-1.5" />
                          )}
                        </div>
                        <div className="pt-0.5 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 leading-snug">{event.action}</p>
                          {event.summary && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">"{event.summary}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(event.timestamp)}</p>
                        </div>
                      </div>
                    ))}

                    {(selectedLead.timeline?.length ?? 0) === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                        <Activity className="h-6 w-6 text-gray-300 mb-2" />
                        <p className="text-xs text-gray-400">No activity yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom padding */}
                <div className="h-2" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Mark Lead as Lost</DialogTitle>
          <DialogDescription>Optionally provide a reason for losing this lead.</DialogDescription>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Reason (optional)"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowLostDialog(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmLost}>Confirm Lost</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
