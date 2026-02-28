"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

// =============================================================================
// v2 changes:
//   - estimates table restructured: customer_info JSONB → typed columns
//   - timeline_events → activity_logs
//   - assigned_to_name removed (join to get names)
//   - status enum: 'pending'→'draft', 'generated'→'sent'
//   - Column selection instead of SELECT *
// =============================================================================

export interface Order {
    id: string;
    // v2: typed columns from estimates
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    customerCity?: string;
    segment?: string;
    plan?: string;
    carpetArea?: number;
    lineItems?: any[];
    totalAmount?: number;

    // Shared fields
    status?: "draft" | "sent" | "approved" | "rejected" | "expired";
    createdAt?: any;
    tenantId: string;
    pdfUrl?: string;
    assignedTo?: string;
    leadId?: string;
    validUntil?: string;

    // Legacy compat aliases
    clientName?: string;
    clientPhone?: string;
    clientEmail?: string;
    estimatedAmount?: number;
    timeline?: Array<{
        action: string;
        summary: string;
        timestamp: any;
        actorId?: string;
    }>;
}

export interface OrderStats {
    draft: number;
    sent: number;
    approved: number;
    rejected: number;
    totalValue: number;
}

const ESTIMATE_COLS = "id,tenant_id,lead_id,customer_name,customer_email,customer_phone,customer_city,segment,plan,carpet_area,line_items,total_amount,status,assigned_to,pdf_url,valid_until,created_at,updated_at";

function mapRowToOrder(row: any, activityLogs: any[] = []): Order {
    return {
        id: row.id,
        customerName: row.customer_name ?? undefined,
        customerPhone: row.customer_phone ?? undefined,
        customerEmail: row.customer_email ?? undefined,
        customerCity: row.customer_city ?? undefined,
        segment: row.segment ?? undefined,
        plan: row.plan ?? undefined,
        carpetArea: row.carpet_area ?? undefined,
        lineItems: row.line_items ?? [],
        totalAmount: row.total_amount ?? undefined,
        status: row.status || "draft",
        createdAt: row.created_at ?? undefined,
        tenantId: row.tenant_id ?? "",
        pdfUrl: row.pdf_url ?? undefined,
        assignedTo: row.assigned_to ?? undefined,
        leadId: row.lead_id ?? undefined,
        validUntil: row.valid_until ?? undefined,
        // Legacy compat
        clientName: row.customer_name ?? undefined,
        clientPhone: row.customer_phone ?? undefined,
        clientEmail: row.customer_email ?? undefined,
        estimatedAmount: row.total_amount ?? undefined,
        timeline: activityLogs.map((e: any) => ({
            action: e.action ?? "",
            summary: e.summary ?? "",
            timestamp: e.created_at ?? null,
            actorId: e.actor_id ?? undefined,
        })),
    };
}

export function useOrders(tenantId: string | null, storeId?: string | null) {
    const queryClient = useQueryClient();
    const qk = ["orders", tenantId, storeId] as const;

    const { data: orders = [], isLoading: loading } = useRealtimeQuery<Order[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();

            const { data: estimatesData, error } = await supabase
                .from("estimates")
                .select(ESTIMATE_COLS)
                .eq("tenant_id", tenantId!)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const rows = estimatesData ?? [];

            // v2: Fetch activity logs (replaces timeline_events)
            const estimateIds = rows.map((r: any) => r.id);
            let activityMap: Record<string, any[]> = {};

            if (estimateIds.length > 0) {
                const { data: activityData } = await supabase
                    .from("activity_logs")
                    .select("entity_id,action,summary,actor_id,created_at")
                    .eq("entity_type", "estimate")
                    .in("entity_id", estimateIds)
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

            return rows.map((row: any) =>
                mapRowToOrder(row, activityMap[row.id] ?? [])
            );
        },
        table: "estimates",
        filter: `tenant_id=eq.${tenantId}`,
        additionalTables: [{ table: "activity_logs" }],
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Derive stats from orders via useMemo instead of separate useState
    const stats: OrderStats = useMemo(() => {
        const draft = orders.filter((o) => o.status === "draft").length;
        const sent = orders.filter((o) => o.status === "sent").length;
        const approved = orders.filter((o) => o.status === "approved").length;
        const rejected = orders.filter((o) => o.status === "rejected").length;
        const totalValue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        return { draft, sent, approved, rejected, totalValue };
    }, [orders]);

    const updateOrderStatus = useCallback(
        async (orderId: string, status: "draft" | "sent" | "approved" | "rejected") => {
            if (!tenantId) return false;
            try {
                const supabase = getSupabase();

                const { error: updateError } = await supabase
                    .from("estimates")
                    .update({ status })
                    .eq("id", orderId);

                if (updateError) {
                    console.error("Error updating order status:", updateError);
                    return false;
                }

                // v2: activity_logs instead of timeline_events
                await supabase.from("activity_logs").insert({
                    tenant_id: tenantId,
                    entity_type: "estimate",
                    entity_id: orderId,
                    action: "status_changed",
                    summary: `Order status updated to ${status}`,
                });

                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating order status:", error);
                return false;
            }
        },
        [tenantId, invalidate]
    );

    const updateOrderDetails = useCallback(
        async (orderId: string, updates: Partial<Order>) => {
            if (!tenantId) return false;
            try {
                const supabase = getSupabase();

                const dbUpdates: Record<string, any> = {};
                const fieldMap: Record<string, string> = {
                    customerName: "customer_name",
                    customerPhone: "customer_phone",
                    customerEmail: "customer_email",
                    customerCity: "customer_city",
                    totalAmount: "total_amount",
                    carpetArea: "carpet_area",
                    lineItems: "line_items",
                    assignedTo: "assigned_to",
                    pdfUrl: "pdf_url",
                    validUntil: "valid_until",
                    leadId: "lead_id",
                };

                for (const [key, value] of Object.entries(updates)) {
                    if (key === "id" || key === "timeline") continue;
                    const dbKey = fieldMap[key] || key;
                    dbUpdates[dbKey] = value;
                }

                const { error: updateError } = await supabase
                    .from("estimates")
                    .update(dbUpdates)
                    .eq("id", orderId);

                if (updateError) {
                    console.error("Error updating order details:", updateError);
                    return false;
                }

                if (updates.assignedTo) {
                    await supabase.from("activity_logs").insert({
                        tenant_id: tenantId,
                        entity_type: "estimate",
                        entity_id: orderId,
                        action: "assigned",
                        summary: `Order assigned`,
                    });
                }

                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating order details:", error);
                return false;
            }
        },
        [tenantId, invalidate]
    );

    return { orders, stats, loading, updateOrderStatus, updateOrderDetails };
}
