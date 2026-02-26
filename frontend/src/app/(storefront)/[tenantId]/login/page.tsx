"use client";

import { useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import Link from "next/link";

export default function CustomerLoginPage({ params }: { params: Promise<{ tenantId: string }> }) {
    const { tenantId } = use(params);

    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectUrl = searchParams.get("redirect") || `/${tenantId}/estimate`;

    const { loginWithEmail } = useCustomerAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await loginWithEmail(email, password);
            router.push(redirectUrl);
        } catch (err: any) {
            setError(err.message || "Failed to login. Please check your credentials.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                    <CardDescription>Login to get your interior estimate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="text-right">
                            <Link
                                href={`/${tenantId}/forgot-password`}
                                className="text-sm text-primary hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <Button type="submit" className="w-full h-12" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Logging in...
                                </>
                            ) : (
                                "Login"
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href={`/${tenantId}/signup?redirect=${encodeURIComponent(redirectUrl)}`} className="text-primary hover:underline font-semibold">
                            Sign up
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
