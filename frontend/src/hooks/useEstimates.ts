"use client";

import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface Estimate {
  id: string;
  customerName: string;
  phoneNumber: string;
  email: string;
  type: string;
  amount: number;
  status: "pending" | "approved" | "contacted" | "rejected";
  createdAt: any;
  pdfLink?: string;
  tenantId: string;
}

function mapRow(row: any): Estimate {
  return {
    id: row.id,
    customerName: row.customer_info?.name ?? row.customer_name ?? "",
    phoneNumber: row.customer_info?.phone ?? row.phone_number ?? "",
    email: row.customer_info?.email ?? row.email ?? "",
    type: row.type ?? row.segment ?? "",
    amount: row.total_amount ?? row.amount ?? 0,
    status: row.status || "pending",
    createdAt: row.created_at,
    pdfLink: row.pdf_url ?? row.pdf_link ?? undefined,
    tenantId: row.tenant_id,
  };
}

export function useEstimates(tenantId: string | null) {
  const { data: estimates = [], isLoading: loading } = useRealtimeQuery<Estimate[]>({
    queryKey: ["estimates", tenantId],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("estimates")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "estimates",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
  });

  return { estimates, loading };
}
