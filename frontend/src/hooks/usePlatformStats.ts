"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  platformRevenue: number;
  growthRate: number;
  companiesLastMonth: number;
  companiesThisMonth: number;
  revenueLastMonth: number;
  loading: boolean;
}

const EMPTY: PlatformStats = {
  totalCompanies: 0,
  activeCompanies: 0,
  platformRevenue: 0,
  growthRate: 0,
  companiesLastMonth: 0,
  companiesThisMonth: 0,
  revenueLastMonth: 0,
  loading: true,
};

export function usePlatformStats(): PlatformStats {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("tenants")
        .select("id,status,activated_at,created_at");

      if (error) throw error;

      const companies = data ?? [];
      const now = new Date();
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalCompanies = companies.filter((c: any) => c.status !== "rejected").length;
      const activeCompanies = companies.filter((c: any) => c.status === "active" && c.activated_at).length;

      const companiesLastMonth = companies.filter((c: any) => {
        if (!c.created_at) return false;
        return new Date(c.created_at) < startOfThisMonth;
      }).length;

      const companiesThisMonth = companies.filter((c: any) => {
        if (!c.created_at) return false;
        return new Date(c.created_at) >= startOfThisMonth;
      }).length;

      const growthRate = companiesLastMonth > 0
        ? ((totalCompanies - companiesLastMonth) / companiesLastMonth) * 100
        : totalCompanies > 0 ? 100 : 0;

      return {
        totalCompanies,
        activeCompanies,
        platformRevenue: 0,
        growthRate,
        companiesLastMonth,
        companiesThisMonth,
        revenueLastMonth: 0,
        loading: false,
      };
    },
    staleTime: 60 * 1000, // 1 minute (was polling every 60s)
    refetchInterval: 60 * 1000,
  });

  return data ?? { ...EMPTY, loading: isLoading };
}
