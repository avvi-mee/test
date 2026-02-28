"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { can as canCheck, PermissionAction } from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

export type UserType = "owner" | "employee" | "superadmin" | null;

export interface CurrentUser {
  userType: UserType;
  tenantId: string | null;
  roles: string[];
  employeeId: string | null;
  firebaseUser: User | null;
  loading: boolean;
  can: (action: PermissionAction) => boolean;
}

interface ResolvedUser {
  userType: UserType;
  tenantId: string | null;
  roles: string[];
  employeeId: string | null;
}

async function resolveUserFromDb(user: User): Promise<ResolvedUser> {
  const supabase = getSupabase();

  const { data: userData } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (userData?.role === "superadmin") {
    return { userType: "superadmin", tenantId: null, roles: ["owner"], employeeId: null };
  }

  if (userData?.role === "admin") {
    return { userType: "owner", tenantId: userData.tenant_id || null, roles: ["owner"], employeeId: null };
  }

  // Check employees table
  const { data: empData } = await supabase
    .from("employees")
    .select("id, tenant_id, roles, role")
    .eq("auth_uid", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (empData) {
    const empRoles =
      empData.roles && empData.roles.length > 0
        ? empData.roles
        : [empData.role || "designer"];
    return {
      userType: "employee",
      tenantId: empData.tenant_id || null,
      roles: Array.isArray(empRoles) ? empRoles : [empRoles],
      employeeId: empData.id || null,
    };
  }

  return { userType: null, tenantId: userData?.tenant_id || null, roles: [], employeeId: null };
}

export function useCurrentUser(): CurrentUser {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      if (!session?.user && typeof window !== "undefined") {
        sessionStorage.removeItem("employeeSession");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: resolved, isLoading } = useQuery<ResolvedUser>({
    queryKey: ["current-user", supabaseUser?.id],
    queryFn: () => resolveUserFromDb(supabaseUser!),
    enabled: !!supabaseUser?.id,
  });

  const userType = resolved?.userType ?? null;
  const roles = resolved?.roles ?? [];
  const tenantId = resolved?.tenantId ?? null;
  const employeeId = resolved?.employeeId ?? null;

  const can = useCallback(
    (action: PermissionAction) => {
      if (userType === "superadmin") return true;
      return canCheck(roles, action);
    },
    [roles, userType]
  );

  return {
    userType,
    tenantId,
    roles,
    employeeId,
    firebaseUser: supabaseUser,
    loading: supabaseUser === undefined ? true : isLoading,
    can,
  };
}
