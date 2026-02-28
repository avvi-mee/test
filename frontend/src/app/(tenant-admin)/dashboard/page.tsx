"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Users,
  Clock,
  CalendarDays,
  Eye,
  Download,
  AlertCircle,
  Plus,
  List,
  Settings,
  Globe,
  X,
  User,
  Home,
  Layers,
  IndianRupee,
  CheckCircle,
  XCircle,
  Briefcase,
  Flame,
  DollarSign,
  Phone,
} from "lucide-react";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useTenantDashboard } from "@/hooks/useTenantDashboard";
import { useLeads } from "@/hooks/useLeads";
import { useProjects } from "@/hooks/useProjects";
import { useFinance } from "@/hooks/useFinance";
import { useFollowUps } from "@/hooks/useFollowUps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function TenantDashboardPage() {
  const { tenant, isAuthenticated, loading: authLoading } = useTenantAuth();
  const tenantId = tenant?.id || null;
  const stats = useTenantDashboard(tenantId);
  const { stats: leadStats, loading: leadsLoading } = useLeads(tenantId);
  const { stats: projectStats, loading: projectsLoading } = useProjects(tenantId);
  const { stats: financeStats, loading: financeLoading } = useFinance(tenantId);
  const { todayFollowUps, overdueFollowUps } = useFollowUps(tenantId);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Seed sample data if needed (once per session to prevent concurrent race)
  useEffect(() => {
    if (tenant?.id) {
      const key = `seeded-${tenant.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      import("@/lib/seeder").then((module) => {
        module.checkAndSeed(tenant.id);
      });
    }
  }, [tenant?.id]);

  if (authLoading || stats.loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-sm text-gray-500">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  if (!tenant) return null;

  const formatAmount = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "₹0";
    return amount >= 100000
      ? `₹${(amount / 100000).toFixed(1)}L`
      : `₹${amount.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Welcome back, {tenant.name?.split(" ")[0] || "Admin"}. Here's what's happening today.</p>
      </div>

      {/* Top-level Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Estimates</CardTitle>
            <FileText className="h-5 w-5 text-gray-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#0F172A]">{stats.estimatesCount}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Leads</CardTitle>
            <Users className="h-5 w-5 text-gray-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#0F172A]">{leadStats.total}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="text-[10px] border-none bg-red-100 text-red-700 gap-0.5">
                <Flame className="h-2.5 w-2.5" /> {leadStats.hotCount}
              </Badge>
              <Badge className="text-[10px] border-none bg-orange-100 text-orange-700">{leadStats.warmCount} warm</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active Projects</CardTitle>
            <Briefcase className="h-5 w-5 text-gray-300" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-[#0F172A]">{projectStats.inProgress + projectStats.planning}</div>
            {projectStats.totalOverdueTasks > 0 && (
              <p className="text-xs text-red-600 mt-1">{projectStats.totalOverdueTasks} overdue tasks</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Outstanding Receivable</CardTitle>
            <DollarSign className="h-5 w-5 text-gray-300" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#0F172A]">{formatAmount(financeStats.totalReceivable)}</div>
            {financeStats.overdueReceivable > 0 && (
              <p className="text-xs text-red-600 mt-1">{formatAmount(financeStats.overdueReceivable)} overdue</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention */}
      {(todayFollowUps.length > 0 || overdueFollowUps.length > 0 || stats.pendingApprovalsCount > 0 || projectStats.delayed > 0) && (
        <Card className="border-none shadow-sm bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Needs Your Attention</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {todayFollowUps.length > 0 && (
                    <p className="text-sm text-amber-700">
                      <strong>{todayFollowUps.length}</strong> follow-up{todayFollowUps.length !== 1 ? "s" : ""} due today
                    </p>
                  )}
                  {overdueFollowUps.length > 0 && (
                    <p className="text-sm text-red-700">
                      <strong>{overdueFollowUps.length}</strong> overdue follow-up{overdueFollowUps.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  {stats.pendingApprovalsCount > 0 && (
                    <p className="text-sm text-amber-700">
                      <strong>{stats.pendingApprovalsCount}</strong> pending approval{stats.pendingApprovalsCount !== 1 ? "s" : ""}
                    </p>
                  )}
                  {projectStats.delayed > 0 && (
                    <p className="text-sm text-red-700">
                      <strong>{projectStats.delayed}</strong> delayed project{projectStats.delayed !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/dashboard/orders">
                <Button variant="outline" size="sm" className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100">
                  View Pipeline
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline + Projects + Finance Mini-summaries */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Lead Pipeline */}
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-gray-50/30 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-700">Sales Pipeline</CardTitle>
              <Link href="/dashboard/orders">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">New</span>
              <span className="font-bold text-gray-900">{leadStats.new}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Contacted</span>
              <span className="font-bold text-gray-900">{leadStats.contacted}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Qualified</span>
              <span className="font-bold text-gray-900">{leadStats.qualified}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Won</span>
              <span className="font-bold text-green-700">{leadStats.won}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Conversion Rate</span>
                <span className="font-bold text-[#0F172A]">{leadStats.conversionRate}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Overview */}
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-gray-50/30 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-700">Projects</CardTitle>
              <Link href="/dashboard/projects">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Planning</span>
              <span className="font-bold text-gray-900">{projectStats.planning}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">In Progress</span>
              <span className="font-bold text-blue-700">{projectStats.inProgress}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Completed</span>
              <span className="font-bold text-green-700">{projectStats.completed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">At Risk</span>
              <span className="font-bold text-yellow-700">{projectStats.atRisk}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Value</span>
                <span className="font-bold text-[#0F172A]">{formatAmount(projectStats.totalValue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Finance Snapshot */}
        <Card className="border-none shadow-sm">
          <CardHeader className="border-b bg-gray-50/30 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-gray-700">Finance</CardTitle>
              <Link href="/dashboard/finance">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500 h-7">View All</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Receivable</span>
              <span className="font-bold text-green-700">{formatAmount(financeStats.totalReceivable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Overdue AR</span>
              <span className="font-bold text-red-700">{formatAmount(financeStats.overdueReceivable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Payable</span>
              <span className="font-bold text-orange-700">{formatAmount(financeStats.totalPayable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Overdue AP</span>
              <span className="font-bold text-red-700">{formatAmount(financeStats.overduePayable)}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Net Position</span>
                <span className={cn("font-bold", financeStats.netPosition >= 0 ? "text-green-700" : "text-red-700")}>
                  {formatAmount(financeStats.netPosition)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/${tenant.id}/estimate`} target="_blank">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" /> New Estimate
          </Button>
        </Link>
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm" className="gap-2">
            <List className="h-4 w-4" /> Sales Pipeline
          </Button>
        </Link>
        <Link href="/dashboard/projects">
          <Button variant="outline" size="sm" className="gap-2">
            <Briefcase className="h-4 w-4" /> Projects
          </Button>
        </Link>
        <Link href="/dashboard/finance">
          <Button variant="outline" size="sm" className="gap-2">
            <DollarSign className="h-4 w-4" /> Finance
          </Button>
        </Link>
        <Link href="/dashboard/analytics">
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Analytics
          </Button>
        </Link>
      </div>
    </div>
  );
}
