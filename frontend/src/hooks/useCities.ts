"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface City {
  id: string;
  name: string;
  enabled: boolean;
  tier?: "Tier 1" | "Tier 2" | "Tier 3";
  createdAt?: any;
}

function mapRow(row: any): City {
  return {
    id: row.id,
    name: row.name,
    enabled: row.is_enabled ?? row.enabled ?? true,
    tier: row.tier ?? undefined,
    createdAt: row.created_at,
  };
}

export function useCities(tenantId: string | null) {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const qk = ["cities", tenantId] as const;

  const { data: cities = [], isLoading: loading } = useRealtimeQuery<City[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "cities",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const addCity = useCallback(async (name: string): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("cities").insert({ tenant_id: tenantId, name, is_enabled: true });
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error("Error adding city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, invalidate]);

  const updateCity = useCallback(async (id: string, updates: Partial<City>): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      const supabase = getSupabase();
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.enabled !== undefined) dbUpdates.is_enabled = updates.enabled;
      if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
      const { error } = await supabase.from("cities").update(dbUpdates).eq("id", id);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error("Error updating city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, invalidate]);

  const deleteCity = useCallback(async (id: string): Promise<boolean> => {
    if (!tenantId) return false;
    setSaving(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.from("cities").delete().eq("id", id);
      if (error) throw error;
      invalidate();
      return true;
    } catch (error) {
      console.error("Error deleting city:", error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [tenantId, invalidate]);

  const toggleCity = useCallback(async (id: string, currentStatus: boolean): Promise<boolean> => {
    return updateCity(id, { enabled: !currentStatus });
  }, [updateCity]);

  return { cities, loading, saving, addCity, updateCity, deleteCity, toggleCity };
}
