"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface Project {
  id: string;
  title: string;
  description: string;
  images: string[];
  completionDate: string;
  location: string;
  category: string;
  status: "active" | "hidden";
  tenantId: string;
  createdAt?: any;
}

function mapRow(row: any): Project {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    images: row.images ?? (row.image_url ? [row.image_url] : []),
    completionDate: row.completion_date ?? "",
    location: row.location ?? "",
    category: row.category ?? "",
    status: row.status ?? "active",
    tenantId: row.tenant_id,
    createdAt: row.created_at,
  };
}

export function usePortfolio(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["portfolio", tenantId] as const;

  const { data: projects = [], isLoading: loading } = useRealtimeQuery<Project[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("portfolio_projects")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "portfolio_projects",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
  });

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: qk }), [queryClient, qk]);

  const updateProjectStatus = useCallback(async (projectId: string, status: "active" | "hidden") => {
    const supabase = getSupabase();
    const { error } = await supabase.from("portfolio_projects").update({ status }).eq("id", projectId);
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  const addProject = useCallback(async (projectData: Omit<Project, "id" | "tenantId" | "createdAt" | "status">) => {
    if (!tenantId) throw new Error("No tenant ID");
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("portfolio_projects")
      .insert({
        tenant_id: tenantId,
        title: projectData.title,
        description: projectData.description,
        images: projectData.images,
        image_url: projectData.images?.[0] ?? null,
        completion_date: projectData.completionDate,
        location: projectData.location,
        category: projectData.category,
        status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    invalidate();
    return data.id;
  }, [tenantId, invalidate]);

  const deleteProject = useCallback(async (projectId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from("portfolio_projects").delete().eq("id", projectId);
    if (error) throw error;
    invalidate();
  }, [invalidate]);

  return { projects, loading, updateProjectStatus, addProject, deleteProject };
}
