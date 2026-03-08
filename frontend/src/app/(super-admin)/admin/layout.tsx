"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2 as Building, Settings as Config, LogOut as Leave, Shield as Lock, LayoutDashboard as Dashboard, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/hooks/useAdminAuth";

const ADMIN_ITEMS = [
    { label: "Overview",      href: "/admin/dashboard",     icon: Dashboard  },
    { label: "Companies",     href: "/admin/designers",     icon: Building   },
    { label: "Feature Flags", href: "/admin/feature-flags", icon: Zap        },
    { label: "Analytics",     href: "/admin/analytics",     icon: BarChart3  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, loading, logout } = useAdminAuth();

    useEffect(() => {
        const isAuthPage = pathname?.startsWith("/admin/login") || pathname?.startsWith("/admin/signup");
        if (!loading && !user && !isAuthPage) {
            router.push("/admin/login");
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // If on auth pages, render children without the sidebar layout
    if (pathname?.startsWith("/admin/login") || pathname?.startsWith("/admin/signup")) {
        return <>{children}</>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="flex min-h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 border-r bg-slate-900 text-slate-50">
                <div className="flex h-16 items-center px-6">
                    <Lock className="mr-2 h-6 w-6 text-blue-400" />
                    <span className="text-xl font-bold tracking-tight">PlatformAdmin</span>
                </div>

                <nav className="mt-6 space-y-1 px-3">
                    {ADMIN_ITEMS.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        return (
                            <Link key={item.href} href={item.href}>
                                <span className={cn(
                                    "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                                    isActive
                                        ? "bg-blue-600 text-white shadow-lg"
                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                )}>
                                    <Icon className="mr-3 h-5 w-5" />
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </nav>

                <div className="absolute bottom-10 left-4 right-4 z-50">
                    <Button
                        variant="destructive"
                        className="w-full justify-start shadow-xl"
                        onClick={async () => {
                            console.log("Logout triggered");
                            await logout();
                        }}
                    >
                        <Leave className="mr-2 h-4 w-4" />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 flex-1">
                <header className="flex h-16 items-center justify-between border-b bg-white px-8 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800">Super Admin Console</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <div className="h-8 w-8 rounded-full bg-blue-100 ring-2 ring-blue-500/20"></div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
