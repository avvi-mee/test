"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

// =============================================================================
// v2: Replaces useEmployees.ts
// Uses tenant_users + users + roles instead of the old employees table.
// =============================================================================

export interface TeamMember {
  id: string;           // tenant_users.id
  userId: string;       // auth user id
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  area: string;
  roles: string[];      // role names from roles table
  isOwner: boolean;
  isActive: boolean;
  joinedAt: string;
  tenantId: string;
}

// Backward-compat alias -- components that import Employee can switch to TeamMember
export type Employee = TeamMember;

function mapRow(row: any): TeamMember {
  return {
    id: row.tenant_user_id ?? row.id,
    userId: row.user_id,
    fullName: row.full_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    avatarUrl: row.avatar_url,
    area: row.area ?? "",
    roles: row.role_names ?? [],
    isOwner: row.is_owner ?? false,
    isActive: row.is_active ?? true,
    joinedAt: row.joined_at,
    tenantId: row.tenant_id,
  };
}

export function useTeam(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["team", tenantId] as const;

  const { data: members = [], isLoading: loading } = useRealtimeQuery<TeamMember[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();

      // Use the v_team_roster view which JOINs tenant_users + users + roles
      const { data, error } = await supabase
        .from("v_team_roster")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("joined_at", { ascending: false });

      if (error) {
        console.error("Error fetching team:", error);
        return [];
      }
      return (data || []).map(mapRow);
    },
    table: "tenant_users",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
    additionalTables: [
      { table: "user_roles" },
    ],
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  const addMember = useCallback(
    async (data: {
      email: string;
      fullName: string;
      phone?: string;
      area?: string;
      roles?: string[];
      password?: string;
    }) => {
      if (!tenantId) return null;
      try {
        // Create auth account via API route
        if (data.password) {
          const res = await fetch("/api/employee-register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId,
              name: data.fullName,
              email: data.email,
              phone: data.phone,
              area: data.area,
              password: data.password,
              roles: data.roles,
            }),
          });
          const result = await res.json();
          if (res.ok) {
            invalidate();
            return result.tenantUserId ?? result.employeeId;
          }
          console.warn("API member creation fallback:", result.error);
        }

        // Direct insert into tenant_users (user must already have auth account)
        const supabase = getSupabase();

        // Find or create user
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", data.email)
          .single();

        if (!existingUser) {
          console.error("User not found. They must sign up first.");
          return null;
        }

        // Create tenant_users entry
        const { data: tuData, error: tuErr } = await supabase
          .from("tenant_users")
          .insert({
            tenant_id: tenantId,
            user_id: existingUser.id,
            is_active: true,
            area: data.area || null,
          })
          .select("id")
          .single();

        if (tuErr) throw tuErr;

        // Assign roles
        if (data.roles && data.roles.length > 0) {
          const { data: roleRows } = await supabase
            .from("roles")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .in("name", data.roles);

          if (roleRows && roleRows.length > 0) {
            await supabase.from("user_roles").insert(
              roleRows.map((r: any) => ({
                tenant_user_id: tuData.id,
                role_id: r.id,
              }))
            );
          }
        }

        invalidate();
        return tuData.id;
      } catch (error) {
        console.error("Error adding team member:", error);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  const updateMember = useCallback(
    async (tenantUserId: string, updates: Partial<TeamMember>) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();
        const dbUpdates: Record<string, any> = {};
        if (updates.area !== undefined) dbUpdates.area = updates.area;
        if (updates.isActive !== undefined) {
          dbUpdates.is_active = updates.isActive;
          if (!updates.isActive) dbUpdates.deactivated_at = new Date().toISOString();
        }

        if (Object.keys(dbUpdates).length > 0) {
          const { error } = await supabase
            .from("tenant_users")
            .update(dbUpdates)
            .eq("id", tenantUserId);
          if (error) throw error;
        }

        // Update user profile fields if provided
        const member = members.find((m) => m.id === tenantUserId);
        if (member) {
          const userUpdates: Record<string, any> = {};
          if (updates.fullName !== undefined) userUpdates.full_name = updates.fullName;
          if (updates.phone !== undefined) userUpdates.phone = updates.phone;
          if (Object.keys(userUpdates).length > 0) {
            await supabase.from("users").update(userUpdates).eq("id", member.userId);
          }
        }

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating team member:", error);
        return false;
      }
    },
    [tenantId, members, invalidate]
  );

  const removeMember = useCallback(
    async (tenantUserId: string) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();
        // Soft-deactivate instead of hard delete
        const { error } = await supabase
          .from("tenant_users")
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq("id", tenantUserId);
        if (error) throw error;
        invalidate();
        return true;
      } catch (error) {
        console.error("Error removing team member:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const getMembersByRole = useCallback(
    (roleName: string) =>
      members.filter((m) => m.roles.includes(roleName) && m.isActive),
    [members]
  );

  // Backward compat: expose as "employees" too
  return {
    members,
    employees: members,
    loading,
    addMember,
    addEmployee: addMember,
    updateMember,
    updateEmployee: updateMember,
    removeMember,
    deleteEmployee: removeMember,
    getMembersByRole,
    getEmployeesByRole: getMembersByRole,
  };
}

// Backward-compat alias
export const useEmployees = useTeam;
