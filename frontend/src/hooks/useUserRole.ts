"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface UserRoleData {
  uid: string;
  email: string;
  role: "admin" | "customer" | "superadmin";
  tenantId: string;
  name?: string;
  phone?: string;
}

export function useUserRole() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: roleData = null, isLoading } = useQuery<UserRoleData | null>({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      if (!data) return null;
      return {
        uid: data.id,
        email: data.email,
        role: data.role,
        tenantId: data.tenant_id,
        name: data.name,
        phone: data.phone,
      };
    },
    enabled: !!user?.id,
  });

  return { user, roleData, loading: !user ? true : isLoading };
}
