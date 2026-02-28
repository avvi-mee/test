"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  Download,
  Package,
  X,
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
    await changeStage(leadId, newStage, undefined, employeeId, roles);
  };

  const confirmLost = async () => {
    if (pendingLostLeadId) {
      await changeStage(pendingLostLeadId, "lost", lostReason || undefined, employeeId, roles);
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
          {filteredLeads.length === 0 ? (
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
                {filteredLeads.map((lead) => (
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
        <DialogContent className="max-w-[800px] h-[90vh] overflow-hidden flex flex-col">
          {selectedLead && (
            <>
              {/* Sticky Header */}
              <div className="shrink-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedLead.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={cn("text-[10px] border-none", STAGE_COLORS[selectedLead.stage])}>
                      {STAGE_LABELS[selectedLead.stage]}
                    </Badge>
                    <Badge className={cn("text-[10px] capitalize border-none", TEMP_COLORS[selectedLead.temperature])}>
                      {selectedLead.temperature}
                    </Badge>
                    <span className="text-xs text-gray-500">Score: {selectedLead.score}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedLead.stage}
                    onValueChange={(val) => {
                      handleStageChange(selectedLead.id, val);
                      if (val !== "lost") {
                        setSelectedLead({ ...selectedLead, stage: val as Lead["stage"] });
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[160px] text-xs">
                      <SelectValue placeholder="Change Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.filter((s) => s === selectedLead.stage || isValidTransition(selectedLead.stage, s)).map((s) => (
                        <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DialogClose asChild>
                    <button className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </DialogClose>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
                {/* Client Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                    <User className="h-4 w-4 text-gray-500" />
                    Lead Information
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Email</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">City</p>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.city || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Source</p>
                      <Badge variant="outline" className="capitalize text-xs">{selectedLead.source?.replace(/_/g, " ")}</Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Assigned To</p>
                      <p className="text-sm font-medium text-gray-900">{employees.find(e => e.id === selectedLead.assignedTo)?.name || "Unassigned"}</p>
                    </div>
                  </div>
                </div>

                {/* Estimate / Budget Info */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-medium mb-1">Total Budget</p>
                      <div className="text-3xl font-bold text-blue-900">{formatAmount(selectedLead.estimatedValue)}</div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-600 mb-1">Lead Details</p>
                      <p className="text-sm font-medium text-blue-800">{selectedLead.source?.replace(/_/g, " ")}</p>
                      <p className="text-xs text-blue-600">{selectedLead.city || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Follow-ups Section */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Follow-ups ({leadFollowUps.length})
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Follow-up
                    </Button>
                  </div>

                  {showFollowUpForm && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Select
                          value={followUpData.type}
                          onValueChange={(val) => setFollowUpData({ ...followUpData, type: val as FollowUp["type"] })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FOLLOW_UP_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="datetime-local"
                          className="h-8 text-xs"
                          value={followUpData.date}
                          onChange={(e) => setFollowUpData({ ...followUpData, date: e.target.value })}
                        />
                      </div>
                      <Input
                        placeholder="Notes (optional)"
                        className="h-8 text-xs"
                        value={followUpData.notes}
                        onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowFollowUpForm(false)}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs bg-[#0F172A]" onClick={handleAddFollowUp}>Schedule</Button>
                      </div>
                    </div>
                  )}

                  {leadFollowUps.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No follow-ups scheduled</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {leadFollowUps.map((fu) => (
                        <div key={fu.id} className="flex items-center justify-between bg-gray-50 rounded-md p-2.5">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="capitalize text-[10px]">{fu.type.replace(/_/g, " ")}</Badge>
                            <span className="text-xs text-gray-600">{formatDateTime(fu.scheduledAt)}</span>
                            {fu.notes && <span className="text-xs text-gray-400 truncate max-w-[150px]">{fu.notes}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn(
                                "text-[10px] border-none",
                                fu.status === "completed" ? "bg-green-100 text-green-700" :
                                fu.status === "missed" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                              )}
                            >
                              {fu.status}
                            </Badge>
                            {fu.status === "pending" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleCompleteFollowUp(fu.id)}
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-4">
                    <Activity className="h-4 w-4 text-gray-500" />
                    Activity Timeline
                  </div>
                  <div className="relative pl-4 border-l-2 border-gray-200 space-y-4">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gray-300 border-2 border-white"></div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">Lead Created</p>
                        <span className="text-xs text-gray-400">{formatDateTime(selectedLead.createdAt)}</span>
                      </div>
                    </div>
                    {selectedLead.timeline?.map((event, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white"></div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{event.action}</p>
                            {event.summary && (
                              <p className="text-xs text-gray-500 mt-0.5 italic">"{event.summary}"</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(event.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                {selectedLead.notes && (
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Notes</h4>
                    <p className="text-sm text-gray-700">{selectedLead.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <Dialog open={showLostDialog} onOpenChange={setShowLostDialog}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4 p-4">
            <h3 className="font-semibold text-gray-900">Mark Lead as Lost</h3>
            <p className="text-sm text-gray-500">Optionally provide a reason for losing this lead.</p>
            <Input
              placeholder="Reason (optional)"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowLostDialog(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmLost}>Confirm</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
