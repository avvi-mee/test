"use client";

import { useAuth } from "./useAuth";

/**
 * Legacy wrapper — delegates to unified useAuth.
 * Consumer files destructure: user, loading, login, logout, isAuthenticated.
 */
export function useAdminAuth() {
  const auth = useAuth();

  return {
    user: auth.role === "superadmin" ? auth.user : null,
    loading: auth.loading,
    login: auth.loginAdmin,
    logout: auth.logout,
    isAuthenticated: auth.role === "superadmin",
  };
}
