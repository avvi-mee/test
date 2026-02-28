"use client";

import { useAuth } from "./useAuth";
import type { Customer } from "./useAuth";

// Re-export for backward compatibility
export type { Customer };

/**
 * Legacy wrapper — delegates to unified useAuth.
 * Consumer files destructure: customer, loading, isAdmin, loginWithEmail, signupWithEmail, loginWithGoogle, logout, resetPassword.
 */
export function useCustomerAuth() {
  const auth = useAuth();

  return {
    customer: auth.customer,
    loading: auth.loading,
    isAdmin: auth.role === "admin" || auth.role === "superadmin",
    loginWithEmail: auth.loginCustomer,
    signupWithEmail: auth.signupCustomer,
    loginWithGoogle: auth.loginWithGoogle,
    logout: auth.logout,
    resetPassword: auth.resetPassword,
  };
}
