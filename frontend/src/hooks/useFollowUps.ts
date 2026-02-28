"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface FollowUp {
  id: string;
  leadId: string;
  tenantId: string;
  type: "call" | "email" | "meeting" | "site_visit" | "whatsapp";
  scheduledAt: any;
  completedAt?: any;
  status: "pending" | "completed" | "missed" | "rescheduled";
  notes?: string;
  outcome?: string;
  createdBy?: string;
  createdByName?: string;
}

function mapRow(row: any): FollowUp {
  return {
    id: row.id,
    leadId: row.lead_id ?? "",
    tenantId: row.tenant_id ?? "",
    type: row.type ?? "call",
    scheduledAt: row.scheduled_at ?? null,
    completedAt: row.completed_at ?? undefined,
    status: row.status ?? "pending",
    notes: row.notes ?? undefined,
    outcome: row.outcome ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdByName: row.created_by_name ?? undefined,
  };
}

export function useFollowUps(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["follow-ups", tenantId] as const;

  const { data: followUps = [], isLoading: loading } = useRealtimeQuery<FollowUp[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "follow_ups",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), [now]);
  const todayEnd = useMemo(() => todayStart + 86400000, [todayStart]);

  const todayFollowUps = useMemo(
    () => followUps.filter((f) => {
      if (f.status !== "pending") return false;
      const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : 0;
      return t >= todayStart && t < todayEnd;
    }),
    [followUps, todayStart, todayEnd]
  );

  const overdueFollowUps = useMemo(
    () => followUps.filter((f) => {
      if (f.status !== "pending") return false;
      const t = f.scheduledAt ? new Date(f.scheduledAt).getTime() : 0;
      return t > 0 && t < todayStart;
    }),
    [followUps, todayStart]
  );

  const addFollowUp = useCallback(async (data: Omit<FollowUp, "id">) => {
    if (!tenantId) return "";
    try {
      const supabase = getSupabase();
      const { data: inserted, error } = await supabase
        .from("follow_ups")
        .insert({
          lead_id: data.leadId,
          tenant_id: tenantId,
          type: data.type,
          scheduled_at: data.scheduledAt,
          status: data.status || "pending",
          notes: data.notes || null,
          outcome: data.outcome || null,
          created_by: data.createdBy || null,
          created_by_name: data.createdByName || null,
        })
        .select()
        .single();
      if (error) { console.error("Error adding follow-up:", error); return ""; }
      invalidate();
      return inserted?.id ?? "";
    } catch (error) { console.error("Error adding follow-up:", error); return ""; }
  }, [tenantId, invalidate]);

  const completeFollowUp = useCallback(async (followUpId: string, outcome: string) => {
    if (!tenantId) return false;
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "completed", outcome, completed_at: new Date().toISOString() })
        .eq("id", followUpId);
      if (error) { console.error("Error completing follow-up:", error); return false; }
      invalidate();
      return true;
    } catch (error) { console.error("Error completing follow-up:", error); return false; }
  }, [tenantId, invalidate]);

  const rescheduleFollowUp = useCallback(async (followUpId: string, newDate: string | Date) => {
    if (!tenantId) return false;
    try {
      const supabase = getSupabase();
      const scheduledAt = typeof newDate === "string" ? newDate : newDate.toISOString();

      const { error: updateError } = await supabase
        .from("follow_ups")
        .update({ status: "rescheduled" })
        .eq("id", followUpId);
      if (updateError) { console.error("Error rescheduling follow-up:", updateError); return false; }

      const original = followUps.find((f) => f.id === followUpId);
      if (original) {
        await supabase.from("follow_ups").insert({
          lead_id: original.leadId,
          tenant_id: tenantId,
          type: original.type,
          scheduled_at: scheduledAt,
          status: "pending",
          notes: original.notes || null,
          created_by: original.createdBy || null,
          created_by_name: original.createdByName || null,
        });
      }
      invalidate();
      return true;
    } catch (error) { console.error("Error rescheduling follow-up:", error); return false; }
  }, [tenantId, followUps, invalidate]);

  return { followUps, todayFollowUps, overdueFollowUps, loading, addFollowUp, completeFollowUp, rescheduleFollowUp };
}
