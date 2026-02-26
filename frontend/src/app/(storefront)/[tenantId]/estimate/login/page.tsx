"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { usePublicWebsiteConfig } from "@/hooks/useWebsiteConfig";
import { getEstimateDraft } from "@/lib/estimateTypes";

export default function EstimateLoginPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId: tenantSlug } = use(params);
    const router = useRouter();
    const { config: websiteConfig, loading: configLoading } = usePublicWebsiteConfig(tenantSlug);

    const primaryColor = websiteConfig?.primaryColor || "#0F172A";
    const secondaryColor = websiteConfig?.secondaryColor || "#1E293B";
    const buttonRadius = websiteConfig?.buttonRadius || 12;

    const [phoneNumber, setPhoneNumber] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [sending, setSending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [error, setError] = useState("");

    // Guard: redirect if no draft exists
    useEffect(() => {
        const draft = getEstimateDraft(tenantSlug);
        if (!draft) {
            router.replace(`/${tenantSlug}/estimate`);
            return;
        }
        // If already logged in, redirect to review
        const storedUser = localStorage.getItem(`storefront_user_${tenantSlug}`);
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                if (user.isLoggedIn) {
                    router.replace(`/${tenantSlug}/estimate/review`);
                }
            } catch { }
        }
    }, [tenantSlug, router]);

    // Cooldown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const isValidPhone = phoneNumber.replace(/\D/g, "").length === 10;

    const handleSendOtp = useCallback(async () => {
        if (!isValidPhone) return;
        setError("");
        setSending(true);
        // Simulated OTP send (1s delay)
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSending(false);
        setOtpSent(true);
        setCooldown(30);
    }, [isValidPhone]);

    const handleVerifyOtp = useCallback(async () => {
        const cleanOtp = otp.replace(/\D/g, "");
        if (cleanOtp.length < 4 || cleanOtp.length > 6) {
            setError("Please enter a valid 4-6 digit OTP");
            return;
        }
        setError("");
        setVerifying(true);
        // Simulated verification (1.5s delay)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Save session
        const cleanPhone = phoneNumber.replace(/\D/g, "");
        const session = {
            phone: cleanPhone,
            name: "",
            email: "",
            isLoggedIn: true,
            loginTime: Date.now()
        };
        localStorage.setItem(`storefront_user_${tenantSlug}`, JSON.stringify(session));

        // Dispatch storage event for other tabs
        window.dispatchEvent(new StorageEvent("storage", {
            key: `storefront_user_${tenantSlug}`,
            newValue: JSON.stringify(session)
        }));

        setVerifying(false);
        router.push(`/${tenantSlug}/estimate/review`);
    }, [otp, phoneNumber, tenantSlug, router]);

    const handleResendOtp = useCallback(async () => {
        if (cooldown > 0) return;
        setSending(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSending(false);
        setCooldown(30);
    }, [cooldown]);

    if (configLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: `${primaryColor}08` }}>
            <div className="w-full max-w-md">
                <Card className="border-none shadow-2xl rounded-3xl overflow-hidden" style={{ borderRadius: buttonRadius * 2 }}>
                    <CardHeader className="text-center pb-2 pt-10 px-8">
                        <div
                            className="mx-auto mb-6 h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg"
                            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                        >
                            {otpSent ? <ShieldCheck className="h-8 w-8" /> : <Phone className="h-8 w-8" />}
                        </div>
                        <CardTitle className="text-2xl font-bold text-gray-900">
                            {otpSent ? "Verify OTP" : "Login to View Estimate"}
                        </CardTitle>
                        <CardDescription className="text-gray-500 mt-2">
                            {otpSent
                                ? `Enter the OTP sent to ${phoneNumber}`
                                : "Enter your mobile number to receive an OTP"}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-10 pt-6 space-y-6">
                        {!otpSent ? (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Mobile Number</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400 font-medium text-lg pl-1">+91</span>
                                        <Input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                                                setPhoneNumber(val);
                                            }}
                                            className="h-14 bg-gray-50 border-0 rounded-xl px-4 text-lg font-medium tracking-wider"
                                            placeholder="98765 43210"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                {error && <p className="text-red-500 text-sm">{error}</p>}
                                <Button
                                    className="w-full text-white py-7 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                                    style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 2 }}
                                    onClick={handleSendOtp}
                                    disabled={!isValidPhone || sending}
                                >
                                    {sending ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending OTP...</>
                                    ) : (
                                        "Send OTP"
                                    )}
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase text-gray-500 tracking-wider">Enter OTP</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        value={otp}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                            setOtp(val);
                                        }}
                                        className="h-16 bg-gray-50 border-0 rounded-xl px-4 text-2xl font-bold tracking-[0.5em] text-center"
                                        placeholder="- - - - - -"
                                        autoFocus
                                    />
                                </div>
                                {error && <p className="text-red-500 text-sm">{error}</p>}
                                <Button
                                    className="w-full text-white py-7 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                                    style={{ backgroundColor: primaryColor, borderRadius: buttonRadius * 2 }}
                                    onClick={handleVerifyOtp}
                                    disabled={otp.replace(/\D/g, "").length < 4 || verifying}
                                >
                                    {verifying ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...</>
                                    ) : (
                                        "Verify & Continue"
                                    )}
                                </Button>
                                <div className="text-center">
                                    <button
                                        onClick={handleResendOtp}
                                        disabled={cooldown > 0 || sending}
                                        className="text-sm font-medium disabled:text-gray-300 transition-colors"
                                        style={{ color: cooldown > 0 ? undefined : primaryColor }}
                                    >
                                        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                                    </button>
                                </div>
                                <button
                                    onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                                    className="flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600 w-full transition-colors"
                                >
                                    <ArrowLeft className="h-3 w-3" /> Change number
                                </button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
