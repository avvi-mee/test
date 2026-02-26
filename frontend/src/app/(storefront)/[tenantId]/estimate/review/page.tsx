"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { useCities } from "@/hooks/useCities";
import { getTenantByStoreId, Tenant } from "@/lib/firestoreHelpers";
import { getEstimateDraft, clearEstimateDraft, EstimateDraft } from "@/lib/estimateTypes";
import { calculateEstimate, BreakdownItem } from "@/lib/calculateEstimate";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface StorefrontUser {
    phone: string;
    name: string;
    email: string;
    isLoggedIn: boolean;
    loginTime: number;
}

export default function EstimateReviewPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const router = useRouter();

    const [resolvedTenant, setResolvedTenant] = useState<Tenant | null>(null);
    const [tenantLoading, setTenantLoading] = useState(true);
    const [draft, setDraft] = useState<EstimateDraft | null>(null);
    const [user, setUser] = useState<StorefrontUser | null>(null);

    const { config: websiteConfig, loading: websiteLoading } = usePublicWebsiteConfig(tenantSlug);
    const { config: pricingConfig, loading: pricingLoading } = usePricingConfig(resolvedTenant?.id || null);
    const { cities, loading: citiesLoading } = useCities(resolvedTenant?.id || null);

    const primaryColor = websiteConfig?.primaryColor || "#0F172A";
    const secondaryColor = websiteConfig?.secondaryColor || "#1E293B";
    const buttonRadius = websiteConfig?.buttonRadius || 12;

    // Customer form state
    const [customerName, setCustomerName] = useState("");
    const [customerEmail, setCustomerEmail] = useState("");
    const [selectedCity, setSelectedCity] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [breakdownOpen, setBreakdownOpen] = useState(false);

    // Resolve tenant
    useEffect(() => {
        const resolveTenant = async () => {
            if (!tenantSlug) return;
            try {
                const tenant = await getTenantByStoreId(tenantSlug.toLowerCase()) || await getTenantByStoreId(tenantSlug);
                if (tenant) setResolvedTenant(tenant);
            } catch (error) {
                console.error("Error resolving tenant:", error);
            } finally {
                setTenantLoading(false);
            }
        };
        resolveTenant();
    }, [tenantSlug]);

    // Guard: check draft + login
    useEffect(() => {
        const storedDraft = getEstimateDraft(tenantSlug);
        if (!storedDraft) {
            router.replace(`/${tenantSlug}/estimate`);
            return;
        }
        setDraft(storedDraft);

        const storedUser = localStorage.getItem(`storefront_user_${tenantSlug}`);
        if (!storedUser) {
            router.replace(`/${tenantSlug}/estimate/login`);
            return;
        }
        try {
            const parsed = JSON.parse(storedUser) as StorefrontUser;
            if (!parsed.isLoggedIn) {
                router.replace(`/${tenantSlug}/estimate/login`);
                return;
            }
            setUser(parsed);
        } catch {
            router.replace(`/${tenantSlug}/estimate/login`);
        }
    }, [tenantSlug, router]);

    const loading = tenantLoading || websiteLoading || pricingLoading || citiesLoading;

    // Calculate estimate
    const estimateResult = draft && pricingConfig
        ? calculateEstimate(pricingConfig, {
            segment: draft.segment,
            selectedPlan: draft.plan,
            carpetArea: draft.carpetArea,
            livingAreaItems: draft.livingAreaItems,
            kitchenItems: draft.kitchenItems,
            bedrooms: draft.bedrooms,
            bathrooms: draft.bathrooms,
            cabins: draft.cabins
        })
        : { total: 0, breakdown: [] as BreakdownItem[] };

    const enabledCities = cities.length > 0
        ? cities.filter(c => c.enabled)
        : [
            { id: 'def-1', name: 'Mumbai', enabled: true },
            { id: 'def-2', name: 'Delhi', enabled: true },
            { id: 'def-3', name: 'Bangalore', enabled: true },
            { id: 'def-4', name: 'Hyderabad', enabled: true },
            { id: 'def-5', name: 'Ahmedabad', enabled: true },
            { id: 'def-6', name: 'Chennai', enabled: true },
            { id: 'def-7', name: 'Kolkata', enabled: true },
            { id: 'def-8', name: 'Pune', enabled: true }
        ];

    const handleSubmit = async () => {
        if (!customerName.trim()) {
            alert("Please enter your name");
            return;
        }
        if (!customerEmail.includes("@")) {
            alert("Please enter a valid email");
            return;
        }
        if (!selectedCity) {
            alert("Please select a city");
            return;
        }
        if (!draft || !resolvedTenant) return;

        setIsSubmitting(true);
        try {
            const estimateData = {
                customerInfo: {
                    name: customerName.trim(),
                    phone: user?.phone || "",
                    email: customerEmail.trim(),
                    city: selectedCity
                },
                segment: draft.segment,
                plan: draft.plan,
                carpetArea: draft.carpetArea,
                bedrooms: draft.bedroomCount,
                bathrooms: draft.bathroomCount,
                configuration: {
                    livingArea: draft.livingAreaItems,
                    kitchen: {
                        layout: draft.kitchenLayout,
                        material: draft.kitchenMaterial,
                        items: draft.kitchenItems
                    },
                    bedrooms: draft.bedrooms,
                    bathrooms: draft.bathrooms,
                    cabins: draft.cabins
                },
                totalAmount: estimateResult.total,
                tenantId: resolvedTenant.id,
                customerId: null,
                createdAt: serverTimestamp()
            };

            const estimatesRef = collection(db, `tenants/${resolvedTenant.id}/estimates`);
            await addDoc(estimatesRef, estimateData);

            // Update localStorage session with name + email
            const updatedUser = {
                ...user,
                name: customerName.trim(),
                email: customerEmail.trim()
            };
            localStorage.setItem(`storefront_user_${tenantSlug}`, JSON.stringify(updatedUser));

            // Clear draft
            clearEstimateDraft(tenantSlug);

            // Redirect to dashboard
            router.push(`/${tenantSlug}/dashboard`);
        } catch (error) {
            console.error("Error submitting estimate:", error);
            alert("Failed to submit estimate. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !draft || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen text-[#0F172A] font-sans py-12 px-4 transition-colors duration-500" style={{ backgroundColor: `${primaryColor}08` }}>
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-3 animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Your Estimate</h1>
                    <p className="text-xl text-gray-500 font-light">Review your estimate and confirm details</p>
                </div>

                {/* Estimated Cost Card */}
                <div
                    className="rounded-3xl p-10 text-white text-center shadow-2xl transform hover:scale-[1.01] transition-all duration-500 relative overflow-hidden animate-in slide-in-from-bottom-8 fade-in duration-700"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`, borderRadius: buttonRadius * 2 }}
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10">
                        <p className="font-bold mb-3 uppercase tracking-widest text-xs opacity-80">Estimated Cost</p>
                        <div className="text-6xl font-bold mb-3 tracking-tight">
                            ₹ {estimateResult.total.toLocaleString('en-IN')}
                        </div>
                        <p className="text-sm opacity-60 font-medium">Based on {draft.plan} Plan • {draft.segment}</p>
                    </div>
                </div>

                {/* Breakdown Table */}
                {estimateResult.breakdown.length > 0 && (
                    <div className="animate-in slide-in-from-bottom-8 fade-in duration-700">
                        <button
                            onClick={() => setBreakdownOpen(!breakdownOpen)}
                            className="w-full flex items-center justify-between p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                        >
                            <h3 className="font-bold text-lg text-gray-900">Detailed Breakdown</h3>
                            <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform duration-300", breakdownOpen && "rotate-180")} />
                        </button>
                        {breakdownOpen && (
                            <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in slide-in-from-top-4 fade-in duration-300">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                                                <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                                <th className="text-right p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {estimateResult.breakdown.map((item, index) => (
                                                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-4 text-sm font-medium text-gray-900">{item.category}</td>
                                                    <td className="p-4 text-sm text-gray-600">{item.item}</td>
                                                    <td className="p-4 text-sm text-right text-gray-600">{item.quantity}</td>
                                                    <td className="p-4 text-sm text-right text-gray-600">₹ {item.unitPrice.toLocaleString('en-IN')}</td>
                                                    <td className="p-4 text-sm text-right font-bold text-gray-900">₹ {item.total.toLocaleString('en-IN')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Customer Details Form */}
                <div className="space-y-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <h3 className="font-bold text-lg border-b border-gray-100 pb-4 text-gray-900">Customer Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-gray-500">Full Name</Label>
                            <Input
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg"
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-gray-500">Phone</Label>
                            <Input
                                value={user?.phone || ""}
                                readOnly
                                className="h-14 bg-gray-100 border-0 rounded-xl px-4 text-lg text-gray-500 cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold uppercase text-gray-500">Email</Label>
                            <Input
                                type="email"
                                value={customerEmail}
                                onChange={(e) => setCustomerEmail(e.target.value)}
                                className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg"
                                placeholder="john@example.com"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-xs font-bold uppercase text-gray-500">City</Label>
                            <Select value={selectedCity} onValueChange={setSelectedCity}>
                                <SelectTrigger className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg">
                                    <SelectValue placeholder="Select City" />
                                </SelectTrigger>
                                <SelectContent>
                                    {enabledCities.map(city => (
                                        <SelectItem key={city.id} value={city.name}>{city.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="pb-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
                    <Button
                        className="w-full text-white py-7 text-lg font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                        style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 2 }}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting...</>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-5 w-5" /> Confirm & Submit
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
