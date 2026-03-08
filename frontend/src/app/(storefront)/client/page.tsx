"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Home, Eye, EyeOff, Loader2 } from "lucide-react";

type ViewState = "login" | "reset_sent" | "no_portal";

export default function ClientLoginPage() {
  const router = useRouter();

  const [view, setView] = useState<ViewState>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      // Verify client portal access
      const res = await fetch("/api/client/project-data", {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 403) {
        await signOut(auth);
        setView("no_portal");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        await signOut(auth);
        setError("Unable to load your project. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/client/dashboard");
    } catch (err: any) {
      const code = err?.code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential"
      ) {
        setError("Invalid email or password.");
      } else {
        setError("Sign in failed. Please try again.");
      }
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email address above first.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
      setView("reset_sent");
    } catch {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo / wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-600 text-white mb-4">
            <Home className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Interior Studio</h1>
          <p className="text-sm text-gray-500 mt-1">Client Project Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {view === "reset_sent" ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-green-600 text-lg">✓</span>
              </div>
              <h2 className="font-semibold text-gray-900">Reset link sent</h2>
              <p className="text-sm text-gray-500">
                Check your email at <strong>{email}</strong> for a password reset link.
              </p>
              <button
                onClick={() => setView("login")}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                Back to sign in
              </button>
            </div>
          ) : view === "no_portal" ? (
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <span className="text-amber-600 text-lg">!</span>
              </div>
              <h2 className="font-semibold text-gray-900">No portal access</h2>
              <p className="text-sm text-gray-500">
                You don't have a project portal set up yet. Contact your designer.
              </p>
              <button
                onClick={() => setView("login")}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                Try a different account
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-sm text-gray-500 mb-6">Sign in to track your project</p>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In to Your Project Portal
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-medium disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Interior Studio OS
        </p>
      </div>
    </div>
  );
}
