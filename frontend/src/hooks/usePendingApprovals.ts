"use client";

import { useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { Tenant, approveTenant, rejectTenant } from "@/lib/firestoreHelpers";
import { useRealtimeQuery } from "@/lib/supabaseQuery";
import { useQueryClient } from "@tanstack/react-query";

export interface PendingApproval extends Tenant {}

function mapRow(row: any): PendingApproval {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    subscription: row.subscription ?? "free",
    settings: row.settings,
  };
}

export function usePendingApprovals() {
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading: loading } = useRealtimeQuery<PendingApproval[]>({
    queryKey: ["pending-approvals"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "tenants",
  });

  const handleApprove = useCallback(async (tenantId: string) => {
    await approveTenant(tenantId);
    queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  }, [queryClient]);

  const handleReject = useCallback(async (tenantId: string) => {
    await rejectTenant(tenantId);
    queryClient.invalidateQueries({ queryKey: ["pending-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
  }, [queryClient]);

  return { approvals, loading, handleApprove, handleReject };
}
