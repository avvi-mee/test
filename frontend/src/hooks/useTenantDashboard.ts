"use client";

import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface RecentOrder {
  id: string;
  estimateId: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  carpetArea?: number;
  numberOfRooms?: number;
  rooms?: string[];
  selectedRooms?: string[];
  materialGrade?: string;
  finishType?: string;
  estimatedAmount?: number;
  status: "pending" | "approved" | "rejected" | "generated";
  createdAt: any;
  pdfUrl?: string;
}

export interface TenantDashboardStats {
  revenue: { total: number; thisMonth: number; lastMonth: number; growth: number };
  subscription: { plan: string; status: string };
  estimatesCount: number;
  ordersCount: number;
  pendingApprovalsCount: number;
  todayEstimatesCount: number;
  rejectedThisWeekCount: number;
  recentOrders: RecentOrder[];
  loading: boolean;
}

const EMPTY: TenantDashboardStats = {
  revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
  subscription: { plan: "free", status: "active" },
  estimatesCount: 0,
  ordersCount: 0,
  pendingApprovalsCount: 0,
  todayEstimatesCount: 0,
  rejectedThisWeekCount: 0,
  recentOrders: [],
  loading: true,
};

export function useTenantDashboard(tenantId: string | null) {
  const { data, isLoading } = useRealtimeQuery<TenantDashboardStats>({
    queryKey: ["tenant-dashboard", tenantId],
    queryFn: async () => {
      const supabase = getSupabase();

      const [tenantRes, estimatesRes] = await Promise.all([
        supabase
          .from("tenants")
          .select("id,name,status,subscription,settings")
          .eq("id", tenantId!)
          .single(),
        supabase
          .from("estimates")
          .select("id,status,total_amount,customer_info,carpet_area,bedrooms,material_grade,finish_type,pdf_url,created_at")
          .eq("tenant_id", tenantId!)
          .order("created_at", { ascending: false })
          .range(0, 49),
      ]);

      if (tenantRes.error || !tenantRes.data) throw tenantRes.error || new Error("Tenant not found");

      const tenantRow = tenantRes.data;
      const allEstimates = estimatesRes.data ?? [];

      const allOrders: RecentOrder[] = allEstimates.map((row: any) => ({
        id: row.id,
        estimateId: row.id,
        clientName: row.customer_info?.name ?? undefined,
        clientPhone: row.customer_info?.phone ?? undefined,
        clientEmail: row.customer_info?.email ?? undefined,
        carpetArea: row.carpet_area ?? undefined,
        numberOfRooms: row.bedrooms ?? undefined,
        materialGrade: row.material_grade ?? undefined,
        finishType: row.finish_type ?? undefined,
        estimatedAmount: row.total_amount ?? undefined,
        status: row.status || "pending",
        createdAt: row.created_at,
        pdfUrl: row.pdf_url ?? undefined,
      }));

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      return {
        revenue: { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 },
        subscription: {
          plan: (tenantRow as any).subscription_plan || (tenantRow as any).subscription || "free",
          status: (tenantRow as any).subscription_status || "active",
        },
        estimatesCount: allEstimates.length,
        ordersCount: allEstimates.length,
        pendingApprovalsCount: allOrders.filter((o) => o.status === "pending").length,
        todayEstimatesCount: allOrders.filter((o) => o.createdAt && new Date(o.createdAt).getTime() >= startOfToday.getTime()).length,
        rejectedThisWeekCount: allOrders.filter((o) => o.status === "rejected" && o.createdAt && new Date(o.createdAt).getTime() >= startOfWeek.getTime()).length,
        recentOrders: allOrders.slice(0, 5),
        loading: false,
      };
    },
    table: "estimates",
    filter: `tenant_id=eq.${tenantId}`,
    additionalTables: [{ table: "tenants", filter: `id=eq.${tenantId}` }],
    enabled: !!tenantId,
  });

  return data ?? { ...EMPTY, loading: isLoading };
}
