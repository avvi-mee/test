"use client";

import { getSupabase } from "@/lib/supabase";
import { Order } from "./useOrders";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

const STOREFRONT_COLS = "id,tenant_id,customer_name,customer_email,customer_phone,customer_city,segment,plan,carpet_area,line_items,total_amount,status,assigned_to,pdf_url,valid_until,created_at,updated_at";

function mapRow(row: any): Order {
  return {
    id: row.id,
    customerName: row.customer_name ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerCity: row.customer_city ?? undefined,
    segment: row.segment ?? undefined,
    plan: row.plan ?? undefined,
    carpetArea: row.carpet_area ?? undefined,
    totalAmount: row.total_amount ?? undefined,
    status: row.status || "draft",
    createdAt: row.created_at ?? undefined,
    tenantId: row.tenant_id ?? "",
    pdfUrl: row.pdf_url ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    clientName: row.customer_name ?? undefined,
    clientPhone: row.customer_phone ?? undefined,
    clientEmail: row.customer_email ?? undefined,
    estimatedAmount: row.total_amount ?? undefined,
  };
}

export function useStorefrontOrders({ tenantId, userEmail }: { tenantId: string; userEmail: string | null }) {
  const { data: orders = [], isLoading: loading } = useRealtimeQuery<Order[]>({
    queryKey: ["storefront-orders", tenantId, userEmail],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("estimates")
        .select(STOREFRONT_COLS)
        .eq("tenant_id", tenantId)
        .eq("customer_email", userEmail!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "estimates",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId && !!userEmail,
  });

  return { orders, loading };
}
