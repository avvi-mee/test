"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useCompanies } from "@/hooks/useCompanies";
import { getDb } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Loader2, Zap, Search, IndianRupee, FileSignature, Lock, BarChart2, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Feature definitions ──────────────────────────────────────────────────────

const FEATURES: Array<{ key: string; label: string; description: string; icon: ReactNode }> = [
  { key: "finance",        label: "Finance Module",    description: "Invoices, vendor bills, cash flow", icon: <IndianRupee className="h-5 w-5" /> },
  { key: "contracts",      label: "Contract System",   description: "Create, send, and sign contracts",  icon: <FileSignature className="h-5 w-5" /> },
  { key: "clientPortal",   label: "Client Portal",     description: "Clients can log in to track projects", icon: <Lock className="h-5 w-5" /> },
  { key: "analytics",      label: "Analytics",         description: "Revenue charts and pipeline analytics", icon: <BarChart2 className="h-5 w-5" /> },
  { key: "multiBranch",    label: "Multi-Branch",      description: "Manage multiple branches/locations", icon: <Building2 className="h-5 w-5" /> },
];

// ─── Per-tenant feature state ─────────────────────────────────────────────────

type FeatureMap = Record<string, boolean>;
type TenantFeatures = Record<string, FeatureMap>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeatureFlagsPage() {
  const { companies, loading: companiesLoading, searchQuery, setSearchQuery } = useCompanies();
  const [features, setFeatures] = useState<TenantFeatures>({});
  const [loadingTenants, setLoadingTenants] = useState(new Set<string>());
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const db = getDb();

  // Load features for all visible companies
  useEffect(() => {
    if (!companies.length) return;
    companies.forEach(async (company) => {
      if (features[company.id]) return; // already loaded
      try {
        const snap = await getDoc(doc(db, "tenants", company.id));
        const data = snap.data();
        setFeatures(prev => ({
          ...prev,
          [company.id]: (data?.features as FeatureMap) ?? {},
        }));
      } catch {
        setFeatures(prev => ({ ...prev, [company.id]: {} }));
      }
    });
  }, [companies]);

  async function toggleFeature(tenantId: string, featureKey: string, value: boolean) {
    const key = `${tenantId}-${featureKey}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateDoc(doc(db, "tenants", tenantId), {
        [`features.${featureKey}`]: value,
      });
      setFeatures(prev => ({
        ...prev,
        [tenantId]: { ...(prev[tenantId] ?? {}), [featureKey]: value },
      }));
    } catch (err) {
      console.error("Error toggling feature:", err);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  if (companiesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-6 w-6 text-indigo-500" /> Feature Flags
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Enable or disable features per tenant. Changes take effect immediately.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tenants..."
          className="pl-10 bg-white border-gray-200 h-9"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Legend */}
      <div className="hidden lg:flex gap-6 px-4 pb-2 border-b border-gray-100">
        <div className="w-64 shrink-0" />
        {FEATURES.map(f => (
          <div key={f.key} className="flex-1 min-w-[100px] text-center">
            <div className="flex justify-center text-gray-600 mb-0.5">{f.icon}</div>
            <p className="text-xs font-semibold text-gray-700 leading-tight">{f.label}</p>
          </div>
        ))}
      </div>

      {/* Tenant rows */}
      <div className="space-y-3">
        {companies.map(company => {
          const tenantFeatures = features[company.id] ?? null;

          return (
            <div
              key={company.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
            >
              {/* Company info */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-black text-sm shrink-0">
                    {company.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{company.name}</p>
                    <p className="text-xs text-gray-400 truncate">{company.email}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                  company.status === "active" ? "bg-emerald-100 text-emerald-700" :
                  company.status === "pending" ? "bg-amber-100 text-amber-700" :
                  "bg-gray-100 text-gray-500"
                )}>
                  {company.status}
                </span>
              </div>

              {/* Feature toggles */}
              {tenantFeatures === null ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading features...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {FEATURES.map(feature => {
                    const isEnabled = tenantFeatures[feature.key] ?? false;
                    const key = `${company.id}-${feature.key}`;
                    const isSaving = saving[key];

                    return (
                      <div
                        key={feature.key}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                          isEnabled ? "border-indigo-100 bg-indigo-50/50" : "border-gray-100 bg-gray-50/50"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 leading-tight flex items-center gap-1.5">
                            <span className="text-gray-500 shrink-0">{feature.icon}</span>{feature.label}
                          </p>
                        </div>
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 shrink-0" />
                        ) : (
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={v => toggleFeature(company.id, feature.key, v)}
                            className="shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {companies.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No tenants found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
