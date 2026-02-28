"use client";

import { getSupabase } from "@/lib/supabase";
import { Activity, formatRelativeTime } from "@/lib/firestoreHelpers";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface ActivityWithTime extends Activity {
  relativeTime: string;
}

export function useRecentActivity(maxItems: number = 10) {
  const { data: activities = [], isLoading: loading } = useRealtimeQuery<ActivityWithTime[]>({
    queryKey: ["recent-activities", maxItems],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(maxItems);

      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        type: row.type,
        description: row.description,
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        createdAt: row.created_at,
        metadata: row.metadata,
        relativeTime: row.created_at ? formatRelativeTime(row.created_at) : "Unknown",
      }));
    },
    table: "activities",
  });

  return { activities, loading };
}
