"use client";

import { useState, useEffect } from "react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { firebaseUser, employeeId, tenantId, loading: userLoading } = useCurrentUser();
  const { toast } = useToast();

  // Profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passSaving, setPassSaving] = useState(false);

  // Notifications
  const [emailReminders, setEmailReminders] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);

  // Loading
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (userLoading || !tenantId || !employeeId) return;
    const db = getDb();
    getDoc(doc(db, `tenants/${tenantId}/employees/${employeeId}`))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setName(d.fullName ?? d.name ?? firebaseUser?.displayName ?? "");
          setPhone(d.phone ?? "");
          setEmailReminders(d.notifications?.emailReminders ?? false);
        } else {
          setName(firebaseUser?.displayName ?? "");
        }
        setLoaded(true);
      })
      .catch(() => {
        setName(firebaseUser?.displayName ?? "");
        setLoaded(true);
      });
  }, [userLoading, tenantId, employeeId, firebaseUser]);

  async function handleSaveProfile() {
    if (!tenantId || !employeeId) return;
    setProfileSaving(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, `tenants/${tenantId}/employees/${employeeId}`), {
        fullName: name,
        phone,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!firebaseUser || !firebaseUser.email) return;
    if (newPass !== confirmPass) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPass.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setPassSaving(true);
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPass);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPass);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      toast({ title: "Password updated successfully" });
    } catch (err: any) {
      const msg =
        err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential"
          ? "Current password is incorrect"
          : "Failed to update password";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setPassSaving(false);
    }
  }

  async function handleSaveNotifications() {
    if (!tenantId || !employeeId) return;
    setNotifSaving(true);
    try {
      const db = getDb();
      await updateDoc(doc(db, `tenants/${tenantId}/employees/${employeeId}`), {
        "notifications.emailReminders": emailReminders,
      });
      toast({ title: "Notification preferences saved" });
    } catch {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    } finally {
      setNotifSaving(false);
    }
  }

  const inputStyle = {
    background: "var(--glass-strong)",
    border: "1px solid var(--glass-border-in)",
    color: "var(--fg-900)",
  };

  if (userLoading || !loaded) {
    return (
      <div className="space-y-6 max-w-2xl">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-2xl animate-pulse"
            style={{ background: "var(--glass)", border: "1px solid var(--glass-border-in)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg-900)" }}>
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--fg-500)" }}>
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile Section */}
      <section
        className="rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--glass)",
          backdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border-in)",
        }}
      >
        <h2 className="font-semibold text-base" style={{ color: "var(--fg-900)" }}>
          Profile
        </h2>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            Full Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            Email
          </label>
          <input
            value={firebaseUser?.email ?? ""}
            readOnly
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--glass)",
              border: "1px solid var(--glass-border-in)",
              color: "var(--fg-500)",
              cursor: "not-allowed",
            }}
          />
          <p className="text-xs mt-1" style={{ color: "var(--fg-400)" }}>
            Email cannot be changed here.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            Phone
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            {profileSaving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </section>

      {/* Password Section */}
      <section
        className="rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--glass)",
          backdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border-in)",
        }}
      >
        <h2 className="font-semibold text-base" style={{ color: "var(--fg-900)" }}>
          Change Password
        </h2>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            Current Password
          </label>
          <input
            type="password"
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            New Password
          </label>
          <input
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block" style={{ color: "var(--fg-700)" }}>
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleChangePassword}
            disabled={passSaving || !currentPass || !newPass || !confirmPass}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            {passSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </section>

      {/* Notifications Section */}
      <section
        className="rounded-2xl p-6 space-y-4"
        style={{
          background: "var(--glass)",
          backdropFilter: "var(--glass-blur)",
          border: "1px solid var(--glass-border-in)",
        }}
      >
        <h2 className="font-semibold text-base" style={{ color: "var(--fg-900)" }}>
          Notifications
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--fg-900)" }}>
              Email Follow-up Reminders
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--fg-500)" }}>
              Receive email reminders for scheduled follow-ups
            </p>
          </div>
          <button
            onClick={() => setEmailReminders((v) => !v)}
            className="relative shrink-0 w-11 h-6 rounded-full transition-colors"
            style={{ background: emailReminders ? "var(--brand)" : "var(--fg-200)" }}
            role="switch"
            aria-checked={emailReminders}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: emailReminders ? "translateX(20px)" : "translateX(0)" }}
            />
          </button>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleSaveNotifications}
            disabled={notifSaving}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ background: "var(--brand)", color: "#fff" }}
          >
            {notifSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </section>
    </div>
  );
}
