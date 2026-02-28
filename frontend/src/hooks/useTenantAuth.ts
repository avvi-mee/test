"use client";

import { useAuth } from "./useAuth";
import type { Tenant } from "./useAuth";

// Re-export Tenant for backward compatibility
export type { Tenant };

/**
 * Legacy wrapper — delegates to unified useAuth.
 * All 13 consumer files destructure: tenant, user, loading, error, login, logout, isAuthenticated.
 */
export function useTenantAuth() {
  const auth = useAuth();

  return {
    tenant: auth.tenant,
    user: auth.user,
    loading: auth.loading,
    error: auth.error,
    login: auth.loginTenant,
    logout: auth.logout,
    isAuthenticated: !!auth.user && !!auth.tenant && auth.tenant.status === "active",
  };
}
