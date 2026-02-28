"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";
import { createProjectFromLead } from "@/lib/services/projectService";
import { calculateLeadScore, LeadScoringInput } from "@/lib/services/leadScoringService";
import { hasAnyRole } from "@/lib/permissions";

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  stage: "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost";
  source: "website" | "consultation" | "referral" | "manual" | "import";
  score: number;
  temperature: "hot" | "warm" | "cold"; // GENERATED from score — read-only
  estimatedValue: number;
  assignedTo?: string; // references tenant_users.id
  estimateId?: string;
  projectId?: string;
  nextFollowUp?: any;
  followUpCount: number;
  lastContactedAt?: any;
  lostReason?: string;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
  timeline: Array<{
    action: string;
    summary: string;
    timestamp: any;
    actorId?: string;
  }>;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent: number;
  negotiation: number;
  won: number;
  lost: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  totalValue: number;
  conversionRate: number;
}

// --- Stage Transition Map ---

export const VALID_TRANSITIONS: Record<string, string[]> = {
  new:            ["contacted", "lost"],
  contacted:      ["qualified", "lost"],
  qualified:      ["proposal_sent", "lost"],
  proposal_sent:  ["negotiation", "lost"],
  negotiation:    ["won", "lost"],
  won:            [],
  lost:           ["new"],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- Assignment Enforcement ---

export function canModifyLead(
  lead: Pick<Lead, "assignedTo">,
  currentUserId: string | null,
  userRoles: string[]
): boolean {
  if (hasAnyRole(userRoles, ["owner"])) return true;
  if (hasAnyRole(userRoles, ["sales"])) {
    return !lead.assignedTo || lead.assignedTo === currentUserId;
  }
  return false;
}

// --- Column selection for leads queries ---

const LEAD_COLUMNS =
  "id,tenant_id,name,email,phone,city,stage,source,score,temperature,estimated_value,assigned_to,estimate_id,project_id,next_follow_up,follow_up_count,last_contacted_at,lost_reason,notes,created_at,updated_at";

// --- Helper: map DB row to Lead ---

function mapRowToLead(row: any, activityLogs: any[] = []): Lead {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? "",
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    city: row.city ?? undefined,
    stage: row.stage ?? "new",
    source: row.source ?? "website",
    score: row.score ?? 0,
    temperature: row.temperature ?? "cold",
    estimatedValue: row.estimated_value ?? 0,
    assignedTo: row.assigned_to ?? undefined,
    estimateId: row.estimate_id ?? undefined,
    projectId: row.project_id ?? undefined,
    nextFollowUp: row.next_follow_up ?? undefined,
    followUpCount: row.follow_up_count ?? 0,
    lastContactedAt: row.last_contacted_at ?? undefined,
    lostReason: row.lost_reason ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? undefined,
    timeline: activityLogs.map((e: any) => ({
      action: e.action ?? "",
      summary: e.summary ?? "",
      timestamp: e.created_at ?? null,
      actorId: e.actor_id ?? undefined,
    })),
  };
}

// --- Helper: compute stats from a leads array ---

function computeStats(mappedLeads: Lead[]): LeadStats {
  const total = mappedLeads.length;
  const wonCount = mappedLeads.filter((l) => l.stage === "won").length;
  return {
    total,
    new: mappedLeads.filter((l) => l.stage === "new").length,
    contacted: mappedLeads.filter((l) => l.stage === "contacted").length,
    qualified: mappedLeads.filter((l) => l.stage === "qualified").length,
    proposal_sent: mappedLeads.filter((l) => l.stage === "proposal_sent").length,
    negotiation: mappedLeads.filter((l) => l.stage === "negotiation").length,
    won: wonCount,
    lost: mappedLeads.filter((l) => l.stage === "lost").length,
    hotCount: mappedLeads.filter((l) => l.temperature === "hot").length,
    warmCount: mappedLeads.filter((l) => l.temperature === "warm").length,
    coldCount: mappedLeads.filter((l) => l.temperature === "cold").length,
    totalValue: mappedLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
    conversionRate: total > 0 ? Math.round((wonCount / total) * 100) : 0,
  };
}

const EMPTY_STATS: LeadStats = {
  total: 0,
  new: 0,
  contacted: 0,
  qualified: 0,
  proposal_sent: 0,
  negotiation: 0,
  won: 0,
  lost: 0,
  hotCount: 0,
  warmCount: 0,
  coldCount: 0,
  totalValue: 0,
  conversionRate: 0,
};

export function useLeads(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["leads", tenantId] as const;

  const { data: leads = [], isLoading: loading } = useRealtimeQuery<Lead[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();

      // Fetch leads with explicit column selection (paginated — first 100)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(LEAD_COLUMNS)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .range(0, 99);

      if (leadsError) throw leadsError;

      const rows = leadsData ?? [];

      // Fetch all activity logs for these leads in one query
      const leadIds = rows.map((r: any) => r.id);
      let activityMap: Record<string, any[]> = {};

      if (leadIds.length > 0) {
        const { data: activityData } = await supabase
          .from("activity_logs")
          .select("entity_id,action,summary,actor_id,created_at")
          .eq("entity_type", "lead")
          .in("entity_id", leadIds)
          .order("created_at", { ascending: true });

        if (activityData) {
          for (const event of activityData) {
            if (!activityMap[event.entity_id]) {
              activityMap[event.entity_id] = [];
            }
            activityMap[event.entity_id].push(event);
          }
        }
      }

      return rows.map((row: any) => mapRowToLead(row, activityMap[row.id] ?? []));
    },
    table: "leads",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
    additionalTables: [
      { table: "activity_logs", filter: "entity_type=eq.lead" },
    ],
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  // Derive stats from leads via useMemo (replaces the old setState-based stats)
  const stats = useMemo<LeadStats>(() => {
    if (!leads || leads.length === 0) return EMPTY_STATS;
    return computeStats(leads);
  }, [leads]);

  // --- Score Recalculation Helper ---

  const recalculateScore = useCallback(async (lead: Lead) => {
    if (!tenantId) return;
    const input: LeadScoringInput = {
      totalAmount: lead.estimatedValue,
      stage: lead.stage,
      source: lead.source,
      email: lead.email,
      followUpCount: lead.followUpCount,
      createdAt: lead.createdAt,
      lastContactedAt: lead.lastContactedAt,
    };
    const { score } = calculateLeadScore(input);
    const supabase = getSupabase();
    // Only write score — temperature is a GENERATED column derived from score
    await supabase
      .from("leads")
      .update({ score, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    invalidate();
  }, [tenantId, invalidate]);

  const updateLead = useCallback(
    async (
      leadId: string,
      updates: Partial<Lead>,
      currentUserId?: string | null,
      userRoles?: string[]
    ) => {
      if (!tenantId) return false;
      try {
        // Assignment enforcement when caller passes user context
        if (currentUserId !== undefined && userRoles) {
          const lead = leads.find((l) => l.id === leadId);
          if (lead && !canModifyLead(lead, currentUserId, userRoles)) return false;
        }

        // Map camelCase Lead fields to snake_case DB columns
        const dbUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
        const fieldMap: Record<string, string> = {
          tenantId: "tenant_id",
          estimatedValue: "estimated_value",
          estimateId: "estimate_id",
          lostReason: "lost_reason",
          assignedTo: "assigned_to",
          nextFollowUp: "next_follow_up",
          followUpCount: "follow_up_count",
          lastContactedAt: "last_contacted_at",
          projectId: "project_id",
          createdAt: "created_at",
          updatedAt: "updated_at",
        };

        // Fields that should never be written (read-only / generated)
        const readOnlyFields = new Set(["id", "timeline", "temperature"]);

        for (const [key, value] of Object.entries(updates)) {
          if (readOnlyFields.has(key)) continue;
          const dbKey = fieldMap[key] || key;
          dbUpdates[dbKey] = value;
        }

        const supabase = getSupabase();
        const { error } = await supabase
          .from("leads")
          .update(dbUpdates)
          .eq("id", leadId);

        if (error) {
          console.error("Error updating lead:", error);
          return false;
        }
        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating lead:", error);
        return false;
      }
    },
    [tenantId, leads, invalidate]
  );

  const addActivityLog = useCallback(
    async (
      leadId: string,
      action: "created" | "updated" | "deleted" | "status_changed" | "assigned" | "commented" | "uploaded" | "payment_recorded",
      summary: string,
      actorId?: string
    ) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        const { error } = await supabase.from("activity_logs").insert({
          tenant_id: tenantId,
          entity_type: "lead",
          entity_id: leadId,
          action,
          summary,
          actor_id: actorId || null,
        });

        if (error) {
          console.error("Error adding activity log:", error);
          return false;
        }

        // Also bump updated_at on the lead
        await supabase
          .from("leads")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", leadId);

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding activity log:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const assignLead = useCallback(
    async (leadId: string, userId: string) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from("leads")
          .update({
            assigned_to: userId,
            updated_at: now,
          })
          .eq("id", leadId);

        if (updateError) {
          console.error("Error assigning lead:", updateError);
          return false;
        }

        // Insert activity log
        await supabase.from("activity_logs").insert({
          tenant_id: tenantId,
          entity_type: "lead",
          entity_id: leadId,
          action: "assigned",
          summary: `Lead assigned to user ${userId}`,
          actor_id: null,
        });

        // Recalculate score after assignment
        const lead = leads.find((l) => l.id === leadId);
        if (lead) {
          await recalculateScore(lead);
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error assigning lead:", error);
        return false;
      }
    },
    [tenantId, leads, recalculateScore, invalidate]
  );

  const changeStage = useCallback(
    async (
      leadId: string,
      newStage: string,
      note?: string,
      currentUserId?: string | null,
      userRoles?: string[]
    ) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return false;

      // Stage transition validation
      if (!isValidTransition(lead.stage, newStage)) return false;

      // Assignment enforcement (only when caller passes user context)
      if (currentUserId !== undefined && userRoles) {
        if (!canModifyLead(lead, currentUserId, userRoles)) return false;
      }

      try {
        const supabase = getSupabase();
        const now = new Date().toISOString();

        const updates: Record<string, any> = {
          stage: newStage,
          updated_at: now,
        };

        if (newStage === "contacted" || newStage === "qualified") {
          updates.last_contacted_at = now;
        }

        if (newStage === "lost" && note) {
          updates.lost_reason = note;
        }

        const { error: updateError } = await supabase
          .from("leads")
          .update(updates)
          .eq("id", leadId);

        if (updateError) {
          console.error("Error changing stage:", updateError);
          return false;
        }

        // Insert activity log
        await supabase.from("activity_logs").insert({
          tenant_id: tenantId,
          entity_type: "lead",
          entity_id: leadId,
          action: "status_changed",
          summary: `Stage changed to ${newStage}${note ? `: ${note}` : ""}`,
          actor_id: currentUserId || null,
        });

        // Double-conversion guard: skip createProjectFromLead if projectId exists
        if (newStage === "won" && tenantId && !lead.projectId) {
          try {
            await createProjectFromLead(lead, tenantId);
          } catch (err) {
            console.error("Error creating project from lead:", err);
          }
        }

        // Recalculate score with new stage
        await recalculateScore({ ...lead, stage: newStage as Lead["stage"] });

        invalidate();
        return true;
      } catch (error) {
        console.error("Error changing stage:", error);
        return false;
      }
    },
    [tenantId, leads, recalculateScore, invalidate]
  );

  const createLead = useCallback(
    async (data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "temperature" | "timeline">) => {
      if (!tenantId) return null;
      try {
        // Compute initial score (temperature is GENERATED from score in DB)
        const input: LeadScoringInput = {
          totalAmount: data.estimatedValue,
          stage: data.stage,
          source: data.source,
          email: data.email,
          followUpCount: data.followUpCount,
          createdAt: null,
          lastContactedAt: null,
        };
        const { score } = calculateLeadScore(input);

        const now = new Date().toISOString();
        const supabase = getSupabase();

        const { data: inserted, error } = await supabase
          .from("leads")
          .insert({
            tenant_id: tenantId,
            name: data.name,
            email: data.email,
            phone: data.phone,
            city: data.city || null,
            stage: data.stage,
            source: data.source,
            score,
            estimated_value: data.estimatedValue,
            estimate_id: data.estimateId || null,
            assigned_to: data.assignedTo || null,
            next_follow_up: data.nextFollowUp || null,
            follow_up_count: data.followUpCount,
            last_contacted_at: data.lastContactedAt || null,
            project_id: data.projectId || null,
            lost_reason: data.lostReason || null,
            notes: data.notes || null,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          console.error("Error creating lead:", error);
          return null;
        }
        invalidate();
        return inserted?.id ?? null;
      } catch (error) {
        console.error("Error creating lead:", error);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  return { leads, stats, loading, updateLead, addActivityLog, assignLead, changeStage, createLead, recalculateScore };
}
