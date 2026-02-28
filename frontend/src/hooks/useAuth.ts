"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ---------- Types ----------

export interface Tenant {
  id: string;
  ownerId?: string;
  name: string;
  email: string;
  phone?: string;
  slug: string;
  status: "pending" | "active" | "inactive" | "rejected";
  createdAt: string;
  approvedAt?: string;
  subscription: "free" | "basic" | "pro" | "enterprise";
  settings?: Record<string, any>;
}

export interface Customer {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  city?: string;
  createdAt: any;
  lastLogin: any;
}

export type AuthRole = "superadmin" | "admin" | "customer" | "anonymous";

interface AuthState {
  user: User | null;
  role: AuthRole;
  tenant: Tenant | null;
  customer: Customer | null;
  loading: boolean;
  error: string;
}

// ---------- Tenant cache (module-level singleton) ----------

const tenantCache: Record<string, { data: Tenant; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

function getCachedTenant(email: string): Tenant | null {
  const entry = tenantCache[email];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCachedTenant(email: string, data: Tenant) {
  tenantCache[email] = { data, ts: Date.now() };
}

function clearCachedTenant(email: string) {
  delete tenantCache[email];
}

// ---------- DB helpers ----------

function rowToTenant(row: any): Tenant {
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
    subscription: row.subscription,
    settings: row.settings,
  };
}

function rowToCustomer(uid: string, row: any): Customer {
  return {
    uid,
    email: row.email,
    displayName: row.display_name || "",
    photoURL: row.photo_url,
    phoneNumber: row.phone_number,
    city: row.city,
    createdAt: row.created_at,
    lastLogin: row.last_login,
  };
}

// ---------- Unified hook ----------

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: "anonymous",
    tenant: null,
    customer: null,
    loading: true,
    error: "",
  });
  const resolvingRef = useRef(false);

  // Resolve user role + data from a Supabase User
  const resolveUser = useCallback(async (authUser: User) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;

    const supabase = getSupabase();

    try {
      // Step 1: Check users table for role
      const { data: userData } = await supabase
        .from("users")
        .select("role, tenant_id")
        .eq("id", authUser.id)
        .maybeSingle();

      const dbRole = userData?.role as string | undefined;

      // --- Superadmin ---
      if (dbRole === "superadmin") {
        setState({
          user: authUser,
          role: "superadmin",
          tenant: null,
          customer: null,
          loading: false,
          error: "",
        });
        return;
      }

      // --- Admin / Tenant owner ---
      if (dbRole === "admin" || !dbRole) {
        const email = authUser.email || "";
        const cached = getCachedTenant(email);

        if (cached) {
          setState({
            user: authUser,
            role: "admin",
            tenant: cached,
            customer: null,
            loading: false,
            error: "",
          });
          return;
        }

        // Look up tenant by email first (owner flow)
        const { data: tenantByEmail } = await supabase
          .from("tenants")
          .select("*")
          .eq("email", email)
          .limit(1)
          .maybeSingle();

        if (tenantByEmail) {
          const tenant = rowToTenant(tenantByEmail);
          setCachedTenant(email, tenant);
          setState({
            user: authUser,
            role: "admin",
            tenant,
            customer: null,
            loading: false,
            error: "",
          });
          return;
        }

        // Fallback: look up tenant by tenant_id from users table
        if (userData?.tenant_id) {
          const { data: tenantById } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", userData.tenant_id)
            .maybeSingle();

          if (tenantById) {
            const tenant = rowToTenant(tenantById);
            setCachedTenant(email, tenant);
            setState({
              user: authUser,
              role: "admin",
              tenant,
              customer: null,
              loading: false,
              error: "",
            });
            return;
          }
        }
      }

      // --- Customer ---
      if (dbRole === "customer" || !dbRole) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (customerData) {
          setState({
            user: authUser,
            role: "customer",
            tenant: null,
            customer: rowToCustomer(authUser.id, customerData),
            loading: false,
            error: "",
          });
          return;
        }
      }

      // Authenticated but no matching profile
      setState({
        user: authUser,
        role: "anonymous",
        tenant: null,
        customer: null,
        loading: false,
        error: "",
      });
    } catch (err) {
      console.error("Error resolving auth:", err);
      setState((prev) => ({ ...prev, loading: false }));
    } finally {
      resolvingRef.current = false;
    }
  }, []);

  // Single auth listener
  useEffect(() => {
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveUser(session.user);
      } else {
        setState({
          user: null,
          role: "anonymous",
          tenant: null,
          customer: null,
          loading: false,
          error: "",
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        resolveUser(session.user);
      } else {
        setState({
          user: null,
          role: "anonymous",
          tenant: null,
          customer: null,
          loading: false,
          error: "",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [resolveUser]);

  // ---------- Actions ----------

  /** Login for tenant admins / owners */
  const loginTenant = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: "", loading: true }));
    const supabase = getSupabase();

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const uid = authData.user.id;

      // Resolve tenant
      let tenantData: Tenant | null = null;
      let tenantRole: "owner" | "admin" = "owner";

      // Try owner flow
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("*")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (tenantRow) {
        tenantData = rowToTenant(tenantRow);
      } else {
        // Try admin flow via users table
        const { data: userData } = await supabase
          .from("users")
          .select("tenant_id, role")
          .eq("id", uid)
          .maybeSingle();

        if (userData?.tenant_id && userData?.role === "admin") {
          const { data: tenantById } = await supabase
            .from("tenants")
            .select("*")
            .eq("id", userData.tenant_id)
            .maybeSingle();
          if (tenantById) {
            tenantData = rowToTenant(tenantById);
            tenantRole = "admin";
          }
        }
      }

      if (!tenantData) {
        setState((prev) => ({
          ...prev,
          error: "No designer account found with this email",
          loading: false,
        }));
        await supabase.auth.signOut();
        return false;
      }

      if (tenantData.status !== "active") {
        const messages: Record<string, string> = {
          pending: "Your account is pending approval from the super admin",
          rejected: "Your account has been rejected",
          inactive: "Your account has been deactivated",
        };
        setState((prev) => ({
          ...prev,
          error: messages[tenantData!.status] || "Your account is not active",
          loading: false,
        }));
        await supabase.auth.signOut();
        return false;
      }

      setCachedTenant(email, tenantData);

      // Sync users table
      await supabase
        .from("users")
        .upsert(
          {
            id: uid,
            email,
            role: "admin",
            tenant_role: tenantRole,
            tenant_id: tenantData.id,
            last_login: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .then(({ error }) => {
          if (error) console.error("Failed to sync admin user:", error);
        });

      setState({
        user: authData.user,
        role: "admin",
        tenant: tenantData,
        customer: null,
        loading: false,
        error: "",
      });
      return true;
    } catch (err: any) {
      console.error("Login error:", err);
      setState((prev) => ({ ...prev, error: "Invalid email or password", loading: false }));
      return false;
    }
  }, []);

  /** Login for superadmin */
  const loginAdmin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, error: "", loading: true }));
    const supabase = getSupabase();

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Auth state change listener will handle role resolution
      return true;
    } catch (err: any) {
      console.error("Login failed:", err);
      setState((prev) => ({ ...prev, error: "Invalid email or password", loading: false }));
      return false;
    }
  }, []);

  /** Login for customers (email/password) */
  const loginCustomer = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const now = new Date().toISOString();
    // Update last_login in both tables (best effort)
    await Promise.allSettled([
      supabase.from("customers").update({ last_login: now }).eq("id", data.user.id),
      supabase.from("users").update({ last_login: now }).eq("id", data.user.id),
    ]);

    return data;
  }, []);

  /** Sign up customer */
  const signupCustomer = useCallback(
    async (email: string, password: string, displayName: string, mobile: string, tenantId: string) => {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Signup failed");

      const uid = data.user.id;
      const now = new Date().toISOString();

      await supabase.from("users").upsert(
        { id: uid, name: displayName, email, phone: mobile, role: "customer", tenant_id: tenantId, last_login: now },
        { onConflict: "id" }
      );

      await supabase.from("customers").upsert(
        { id: uid, email, display_name: displayName, phone_number: mobile, last_login: now },
        { onConflict: "id" }
      );

      setState((prev) => ({
        ...prev,
        customer: { uid, email, displayName, phoneNumber: mobile, createdAt: now, lastLogin: now },
        role: "customer",
      }));

      return data;
    },
    []
  );

  /** Google OAuth login for customers */
  const loginWithGoogle = useCallback(async (tenantId?: string) => {
    const supabase = getSupabase();
    const redirectUrl =
      typeof window !== "undefined" ? new URL(window.location.origin) : undefined;

    if (redirectUrl && tenantId) {
      redirectUrl.searchParams.set("tenant_id", tenantId);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl?.toString(),
        queryParams: tenantId ? { tenant_id: tenantId } : undefined,
      },
    });
    if (error) throw error;
    return data;
  }, []);

  /** Password reset */
  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  /** Unified logout */
  const logout = useCallback(async () => {
    const supabase = getSupabase();
    if (state.user?.email) {
      clearCachedTenant(state.user.email);
    }
    await supabase.auth.signOut();
    setState({
      user: null,
      role: "anonymous",
      tenant: null,
      customer: null,
      loading: false,
      error: "",
    });
  }, [state.user?.email]);

  return {
    // State
    user: state.user,
    role: state.role,
    tenant: state.tenant,
    customer: state.customer,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user && state.role !== "anonymous",

    // Actions
    loginTenant,
    loginAdmin,
    loginCustomer,
    signupCustomer,
    loginWithGoogle,
    resetPassword,
    logout,
  };
}
