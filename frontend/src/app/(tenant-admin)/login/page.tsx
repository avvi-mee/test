"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getFirebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { ShieldCheck, Users, Eye, EyeOff, Mail, ArrowLeft, Lock } from "lucide-react";

type View = "choose" | "admin" | "employee";

export default function LoginPage() {
  const router = useRouter();
  const { login: adminLogin, loading: adminLoading, error: adminError, isAuthenticated } = useTenantAuth();

  const [view, setView] = useState<View>("choose");

  // Admin form
  const [adminEmail, setAdminEmail]       = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPw, setShowAdminPw]     = useState(false);

  // Employee form
  const [empEmail, setEmpEmail]           = useState("");
  const [empPassword, setEmpPassword]     = useState("");
  const [showEmpPw, setShowEmpPw]         = useState(false);
  const [empLoading, setEmpLoading]       = useState(false);
  const [empError, setEmpError]           = useState("");

  useEffect(() => {
    if (isAuthenticated) router.push("/dashboard");
  }, [isAuthenticated, router]);

  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await adminLogin(adminEmail, adminPassword);
    if (ok) router.push("/dashboard");
  }

  async function handleEmpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmpError(""); setEmpLoading(true);
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, empEmail, empPassword);
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setEmpError(d.error || "Login failed. Contact your admin.");
        await auth.signOut();
        return;
      }
      const { employee } = await res.json();
      const empRoles: string[] = employee?.roles || [employee?.role || "designer"];
      let target = "/dashboard";
      if (empRoles.includes("designer"))             target = "/dashboard/designer";
      else if (empRoles.includes("site_supervisor")) target = "/dashboard/supervisor";
      else if (empRoles.includes("sales"))           target = "/dashboard/orders";
      else if (empRoles.includes("accountant"))      target = "/dashboard/finance";
      else if (empRoles.includes("project_manager")) target = "/dashboard/projects";
      router.push(target);
    } catch (err: any) {
      if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(err.code)) {
        setEmpError("Invalid email or password.");
      } else {
        setEmpError(err.message || "Login failed.");
      }
    } finally {
      setEmpLoading(false);
    }
  }

  if (isAuthenticated) return null;

  // ── shared card wrapper ────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: "var(--glass)",
    backdropFilter: "var(--glass-blur)",
    border: "1px solid var(--glass-border-in)",
    boxShadow: "var(--glass-shadow)",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--mesh-base)" }}>

      {/* orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--mesh-1)" }} />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--mesh-2)" }} />
      </div>

      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="mx-auto h-12 w-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "var(--brand)" }}>
            <Lock className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black" style={{ color: "var(--fg-900)" }}>UNMATRIX</h1>
          <p className="text-sm" style={{ color: "var(--fg-500)" }}>
            {view === "choose"   ? "Who are you signing in as?"   :
             view === "admin"    ? "Admin / Owner Login"          :
                                   "Team Member Login"}
          </p>
        </div>

        {/* ── CHOOSE VIEW ── */}
        {view === "choose" && (
          <div className="space-y-3">
            <button onClick={() => setView("admin")}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.02]"
              style={cardStyle}>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--brand)" }}>
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--fg-900)" }}>Admin / Owner</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-500)" }}>Full access to all modules</p>
              </div>
              <svg className="ml-auto h-4 w-4 flex-shrink-0" style={{ color: "var(--fg-400)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <button onClick={() => setView("employee")}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all hover:scale-[1.02]"
              style={{ ...cardStyle, border: "1px solid rgba(139,92,246,0.30)" }}>
              <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#7C3AED" }}>
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--fg-900)" }}>Team Member</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-500)" }}>
                  Sales · Designer · Supervisor · Accountant
                </p>
              </div>
              <svg className="ml-auto h-4 w-4 flex-shrink-0" style={{ color: "var(--fg-400)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        {/* ── ADMIN FORM ── */}
        {view === "admin" && (
          <div className="rounded-3xl p-6 space-y-5" style={cardStyle}>
            {/* coloured top strip */}
            <div className="-mx-6 -mt-6 mb-2 px-6 py-4 rounded-t-3xl flex items-center gap-3"
              style={{ background: "linear-gradient(135deg, var(--brand) 0%, #0EA5E9 100%)" }}>
              <ShieldCheck className="h-5 w-5 text-white flex-shrink-0" />
              <span className="text-white font-bold text-sm">Admin / Owner</span>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--fg-500)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--fg-400)" }} />
                  <input type="email" required autoComplete="username"
                    placeholder="owner@company.com"
                    value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                    style={{ background: "var(--glass)", color: "var(--fg-900)",
                      borderColor: "var(--glass-border-in)" }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--fg-500)" }}>Password</label>
                <div className="relative">
                  <input type={showAdminPw ? "text" : "password"} required
                    autoComplete="current-password" placeholder="••••••••"
                    value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm border outline-none"
                    style={{ background: "var(--glass)", color: "var(--fg-900)",
                      borderColor: "var(--glass-border-in)" }} />
                  <button type="button" onClick={() => setShowAdminPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--fg-400)" }}>
                    {showAdminPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <p className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: "rgba(220,38,38,0.10)", color: "var(--red)",
                    border: "1px solid rgba(220,38,38,0.20)" }}>
                  {adminError}
                </p>
              )}

              <button type="submit" disabled={adminLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--brand)", opacity: adminLoading ? 0.7 : 1 }}>
                {adminLoading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="flex items-center justify-between text-xs pt-1"
              style={{ color: "var(--fg-400)" }}>
              <Link href="/forgot-password" style={{ color: "var(--brand)" }}
                className="hover:underline">Forgot password?</Link>
              <Link href="/signup" style={{ color: "var(--brand)" }}
                className="hover:underline">Create account</Link>
            </div>
          </div>
        )}

        {/* ── EMPLOYEE FORM ── */}
        {view === "employee" && (
          <div className="rounded-3xl p-6 space-y-5"
            style={{ ...cardStyle, border: "1px solid rgba(139,92,246,0.30)" }}>
            <div className="-mx-6 -mt-6 mb-2 px-6 py-4 rounded-t-3xl flex items-center gap-3"
              style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" }}>
              <Users className="h-5 w-5 text-white flex-shrink-0" />
              <span className="text-white font-bold text-sm">Team Member</span>
            </div>

            <form onSubmit={handleEmpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--fg-500)" }}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--fg-400)" }} />
                  <input type="email" required autoComplete="username"
                    placeholder="you@company.com"
                    value={empEmail} onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border outline-none"
                    style={{ background: "var(--glass)", color: "var(--fg-900)",
                      borderColor: "var(--glass-border-in)" }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--fg-500)" }}>Password</label>
                <div className="relative">
                  <input type={showEmpPw ? "text" : "password"} required
                    autoComplete="current-password" placeholder="••••••••"
                    value={empPassword} onChange={(e) => setEmpPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm border outline-none"
                    style={{ background: "var(--glass)", color: "var(--fg-900)",
                      borderColor: "var(--glass-border-in)" }} />
                  <button type="button" onClick={() => setShowEmpPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--fg-400)" }}>
                    {showEmpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {empError && (
                <p className="text-xs px-3 py-2 rounded-xl"
                  style={{ background: "rgba(220,38,38,0.10)", color: "var(--red)",
                    border: "1px solid rgba(220,38,38,0.20)" }}>
                  {empError}
                </p>
              )}

              <button type="submit" disabled={empLoading}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "#7C3AED", opacity: empLoading ? 0.7 : 1 }}>
                {empLoading ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="text-center text-xs">
              <Link href="/forgot-password" style={{ color: "#A78BFA" }}
                className="hover:underline">Forgot password?</Link>
            </div>
          </div>
        )}

        {/* Back button */}
        {view !== "choose" && (
          <button onClick={() => setView("choose")}
            className="flex items-center gap-1.5 mx-auto text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--fg-500)" }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to login options
          </button>
        )}
      </div>
    </div>
  );
}
