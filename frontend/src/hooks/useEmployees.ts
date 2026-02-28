"use client";

// =============================================================================
// v2: Backward-compatibility shim
// The employees table is gone. Team members are now in tenant_users + users + roles.
// This file re-exports useTeam as useEmployees with a compatible interface.
// New code should import from useTeam.ts directly.
// =============================================================================

import { useTeam, type TeamMember } from "./useTeam";

// Backward-compat Employee interface that maps TeamMember fields
export interface Employee {
  id: string;
  name: string;
  email: string;
  area: string;
  phone: string;
  role: string;
  roles: string[];
  isActive: boolean;
  tenantId: string;
  authUid?: string;
  createdAt?: any;
}

function toEmployee(m: TeamMember): Employee {
  return {
    id: m.id,
    name: m.fullName,
    email: m.email,
    area: m.area,
    phone: m.phone,
    role: m.roles[0] || "member",
    roles: m.roles,
    isActive: m.isActive,
    tenantId: m.tenantId,
    authUid: m.userId,
    createdAt: m.joinedAt,
  };
}

export function useEmployees(tenantId: string | null) {
  const team = useTeam(tenantId);

  const employees = team.members.map(toEmployee);

  const addEmployee = async (data: Omit<Employee, "id" | "tenantId" | "createdAt">) => {
    return team.addMember({
      email: data.email,
      fullName: data.name,
      phone: data.phone,
      area: data.area,
      roles: data.roles || [data.role],
    });
  };

  const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
    return team.updateMember(employeeId, {
      fullName: updates.name,
      phone: updates.phone,
      area: updates.area,
      isActive: updates.isActive,
    });
  };

  const deleteEmployee = async (employeeId: string) => {
    return team.removeMember(employeeId);
  };

  const getEmployeesByRole = (role: string) =>
    employees.filter((e) => (e.roles.includes(role) || e.role === role) && e.isActive);

  return { employees, loading: team.loading, addEmployee, updateEmployee, deleteEmployee, getEmployeesByRole };
}
