"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { getSupabase } from "./supabase";

/**
 * A React Query wrapper that subscribes to Supabase realtime changes
 * and auto-invalidates the query when the table changes.
 *
 * Usage:
 *   useRealtimeQuery({
 *     queryKey: ["leads", tenantId],
 *     queryFn: async () => { ... },
 *     table: "leads",
 *     filter: `tenant_id=eq.${tenantId}`,
 *     enabled: !!tenantId,
 *   })
 */
export function useRealtimeQuery<T>({
  queryKey,
  queryFn,
  table,
  filter,
  enabled = true,
  staleTime,
  additionalTables,
}: {
  queryKey: readonly unknown[];
  queryFn: () => Promise<T>;
  table: string;
  filter?: string;
  enabled?: boolean;
  staleTime?: number;
  additionalTables?: Array<{ table: string; filter?: string }>;
}) {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes
  useEffect(() => {
    if (!enabled) return;

    const supabase = getSupabase();
    const channelName = `rq-${queryKey.join("-")}`;

    let channel = supabase.channel(channelName);

    // Primary table
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
      () => {
        queryClient.invalidateQueries({ queryKey });
      }
    );

    // Additional tables (e.g., activity_logs for a leads query)
    if (additionalTables) {
      for (const t of additionalTables) {
        channel = channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) },
          () => {
            queryClient.invalidateQueries({ queryKey });
          }
        );
      }
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, table, filter, queryKey, queryClient, additionalTables]);

  return useQuery<T>({
    queryKey,
    queryFn,
    enabled,
    ...(staleTime !== undefined ? { staleTime } : {}),
  });
}

/**
 * Create a mutation that auto-invalidates related queries on success.
 */
export function useSupabaseMutation<TArgs, TResult = void>({
  mutationFn,
  invalidateKeys,
}: {
  mutationFn: (args: TArgs) => Promise<TResult>;
  invalidateKeys: readonly unknown[][];
}) {
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TArgs>({
    mutationFn,
    onSuccess: () => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
