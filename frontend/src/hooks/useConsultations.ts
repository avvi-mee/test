"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

// =============================================================================
// v2 changes:
//   - timeline_events → activity_logs
//   - assigned_to_name removed (join to get names)
//   - convertToLead: uses v2 lead fields (estimated_value, no temperature write)
// =============================================================================

export interface ConsultationRequest {
    id: string;
    clientName: string;
    phone?: string;
    email?: string;
    source: string;
    requirement: string;
    status: "new" | "contacted" | "closed";
    createdAt: any;
    tenantId: string;
    assignedTo?: string;
    timeline?: Array<{
        action: string;
        summary: string;
        timestamp: any;
        actorId?: string;
    }>;
}

const CONSULT_COLS = "id,tenant_id,name,email,phone,requirement,status,assigned_to,source,lead_id,created_at,updated_at";

function mapRowToConsultation(row: any, activityLogs: any[] = []): ConsultationRequest {
    return {
        id: row.id,
        clientName: row.name ?? "",
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        source: row.source ?? "",
        requirement: row.requirement ?? "",
        status: row.status ?? "new",
        createdAt: row.created_at ?? null,
        tenantId: row.tenant_id ?? "",
        assignedTo: row.assigned_to ?? undefined,
        timeline: activityLogs.map((e: any) => ({
            action: e.action ?? "",
            summary: e.summary ?? "",
            timestamp: e.created_at ?? null,
            actorId: e.actor_id ?? undefined,
        })),
    };
}

export function useConsultations(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["consultations", tenantId] as const;

    const { data: requests = [], isLoading: loading } = useRealtimeQuery<ConsultationRequest[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();

            const { data: consultationsData, error } = await supabase
                .from("consultations")
                .select(CONSULT_COLS)
                .eq("tenant_id", tenantId!)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const rows = consultationsData ?? [];

            // v2: Fetch from activity_logs instead of timeline_events
            const consultationIds = rows.map((r: any) => r.id);
            let activityMap: Record<string, any[]> = {};

            if (consultationIds.length > 0) {
                const { data: activityData } = await supabase
                    .from("activity_logs")
                    .select("entity_id,action,summary,actor_id,created_at")
                    .eq("entity_type", "consultation")
                    .in("entity_id", consultationIds)
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
                mapRowToConsultation(row, activityMap[row.id] ?? [])
            );
        },
        table: "consultations",
        filter: `tenant_id=eq.${tenantId}`,
        additionalTables: [{ table: "activity_logs" }],
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Derive stats from data via useMemo instead of separate useState
    const stats = useMemo(() => {
        const newCount = requests.filter(r => r.status === "new").length;
        const contactedCount = requests.filter(r => r.status === "contacted").length;
        const closedCount = requests.filter(r => r.status === "closed").length;
        const total = requests.length;

        return {
            new: newCount,
            inProgress: contactedCount,
            conversionRate: total > 0 ? Math.round((closedCount / total) * 100) : 0,
        };
    }, [requests]);

    const updateRequest = useCallback(
        async (requestId: string, updates: Partial<ConsultationRequest>) => {
            if (!tenantId) return false;
            try {
                const dbUpdates: Record<string, any> = {};
                const fieldMap: Record<string, string> = {
                    clientName: "name",
                    assignedTo: "assigned_to",
                    createdAt: "created_at",
                    tenantId: "tenant_id",
                };

                for (const [key, value] of Object.entries(updates)) {
                    if (key === "id" || key === "timeline") continue;
                    const dbKey = fieldMap[key] || key;
                    dbUpdates[dbKey] = value;
                }

                const supabase = getSupabase();
                const { error } = await supabase
                    .from("consultations")
                    .update(dbUpdates)
                    .eq("id", requestId);

                if (error) {
                    console.error("Error updating consultation request:", error);
                    return false;
                }
                invalidate();
                return true;
            } catch (error) {
                console.error("Error updating consultation request:", error);
                return false;
            }
        },
        [tenantId, invalidate]
    );

    const createConsultation = useCallback(
        async (data: Omit<ConsultationRequest, "id" | "createdAt">) => {
            if (!tenantId) return null;
            try {
                const supabase = getSupabase();

                const { data: inserted, error } = await supabase
                    .from("consultations")
                    .insert({
                        tenant_id: tenantId,
                        name: data.clientName,
                        phone: data.phone || null,
                        email: data.email || null,
                        source: data.source,
                        requirement: data.requirement,
                        status: data.status || "new",
                        assigned_to: data.assignedTo || null,
                    })
                    .select()
                    .single();

                if (error) {
                    console.error("Error creating consultation:", error);
                    return null;
                }

                invalidate();
                return inserted?.id ?? null;
            } catch (error) {
                console.error("Error creating consultation:", error);
                return null;
            }
        },
        [tenantId, invalidate]
    );

    const convertToLead = useCallback(
        async (requestId: string) => {
            if (!tenantId) return null;
            try {
                const request = requests.find(r => r.id === requestId);
                if (!request) return null;

                const supabase = getSupabase();

                // v2: Create lead with new schema fields
                const { data: leadDoc, error: leadError } = await supabase
                    .from("leads")
                    .insert({
                        tenant_id: tenantId,
                        name: request.clientName,
                        email: request.email || "",
                        phone: request.phone || "",
                        source: "consultation",
                        stage: "new",
                        score: 0,
                        estimated_value: 0,
                        follow_up_count: 0,
                    })
                    .select()
                    .single();

                if (leadError || !leadDoc) {
                    console.error("Error creating lead from consultation:", leadError);
                    return null;
                }

                // v2: activity_logs instead of timeline_events
                await supabase.from("activity_logs").insert({
                    tenant_id: tenantId,
                    entity_type: "lead",
                    entity_id: leadDoc.id,
                    action: "created",
                    summary: `Converted from consultation request ${requestId}`,
                });

                // Update consultation status to closed and link lead
                await supabase
                    .from("consultations")
                    .update({ status: "closed", lead_id: leadDoc.id })
                    .eq("id", requestId);

                // Log consultation conversion
                await supabase.from("activity_logs").insert({
                    tenant_id: tenantId,
                    entity_type: "consultation",
                    entity_id: requestId,
                    action: "status_changed",
                    summary: `Converted to lead ${leadDoc.id}`,
                });

                invalidate();
                return leadDoc.id;
            } catch (error) {
                console.error("Error converting to lead:", error);
                return null;
            }
        },
        [tenantId, requests, invalidate]
    );

    return { requests, stats, loading, updateRequest, createConsultation, convertToLead };
}
