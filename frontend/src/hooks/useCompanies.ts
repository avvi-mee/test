"use client";

import { useState, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import { Tenant } from "@/lib/firestoreHelpers";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

function mapRow(row: any): Tenant {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    subscription: row.subscription ?? row.subscription_plan ?? "free",
    settings: row.settings,
  };
}

export function useCompanies() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: companies = [], isLoading: loading } = useRealtimeQuery<Tenant[]>({
    queryKey: ["companies"],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    table: "tenants",
  });

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.slug ?? "").toLowerCase().includes(q)
    );
  }, [searchQuery, companies]);

  return {
    companies: filteredCompanies,
    loading,
    searchQuery,
    setSearchQuery,
    totalCount: companies.length,
    filteredCount: filteredCompanies.length,
  };
}
