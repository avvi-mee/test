"use client";

import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { DateRange } from "@/lib/analyticsHelpers";

// =============================================================================
// v2: Server-side aggregation via DB functions
// Instead of fetching ALL rows and computing in JS (100MB+ at scale),
// we call fn_sales_overview, fn_financial_summary, fn_employee_metrics, etc.
// Returns ~1KB instead of 100MB. Browser never sees raw rows.
// =============================================================================

// -- Interfaces --

export interface SalesAnalytics {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  lostLeads: number;
  temperatureDistribution: { hot: number; warm: number; cold: number };
  avgLeadScore: number;
  avgConversionTimeDays: number;
  totalPipelineValue: number;
  funnelData: Array<{ stage: string; count: number }>;
  leadsOverTime: Array<{ date: string; count: number }>;
  sourceBreakdown: Array<{ source: string; count: number }>;
}

export interface ProjectAnalytics {
  activeProjects: number;
  completedProjects: number;
  delayedProjects: number;
  onTrackPercent: number;
  avgCompletionTimeDays: number;
  totalProjectValue: number;
  stageDistribution: Array<{ status: string; count: number }>;
  healthDistribution: Array<{ health: string; count: number }>;
  avgProjectProgress: number;
}

export interface FinancialAnalytics {
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;
  overdue: number;
  totalExpenses: number;
  totalPaidToVendors: number;
  netCashflow: number;
  revenueTrend: Array<{ month: string; invoiced: number; received: number }>;
  expenseTrend: Array<{ month: string; billed: number; paid: number }>;
  receivableAging: AgingBucket;
  payableAging: AgingBucket;
  collectionRate: number;
}

export interface AgingBucket {
  current: number;
  thirtyOne: number;
  sixtyOne: number;
  ninetyPlus: number;
}

export interface EmployeeMetrics {
  id: string;
  name: string;
  role: string;
  assignedLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgResponseTimeHours: number;
  tasksCompleted: number;
  overdueTasks: number;
  activeProjects: number;
  executionCompletionPercent: number;
}

export interface AnalyticsData {
  sales: SalesAnalytics;
  projects: ProjectAnalytics;
  financial: FinancialAnalytics;
  employees: EmployeeMetrics[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// -- Defaults --

const emptySales: SalesAnalytics = {
  totalLeads: 0, convertedLeads: 0, conversionRate: 0, lostLeads: 0,
  temperatureDistribution: { hot: 0, warm: 0, cold: 0 },
  avgLeadScore: 0, avgConversionTimeDays: 0, totalPipelineValue: 0,
  funnelData: [], leadsOverTime: [], sourceBreakdown: [],
};

const emptyProjects: ProjectAnalytics = {
  activeProjects: 0, completedProjects: 0, delayedProjects: 0,
  onTrackPercent: 0, avgCompletionTimeDays: 0, totalProjectValue: 0,
  stageDistribution: [], healthDistribution: [],
  avgProjectProgress: 0,
};

const emptyFinancial: FinancialAnalytics = {
  totalInvoiced: 0, totalReceived: 0, outstanding: 0, overdue: 0,
  totalExpenses: 0, totalPaidToVendors: 0, netCashflow: 0,
  revenueTrend: [], expenseTrend: [],
  receivableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
  payableAging: { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 },
  collectionRate: 0,
};

// -- Helper: parse aging bucket rows from DB --

function parseAgingRows(rows: Array<{ bucket: string; amount: number }>): AgingBucket {
  const result: AgingBucket = { current: 0, thirtyOne: 0, sixtyOne: 0, ninetyPlus: 0 };
  for (const row of rows) {
    switch (row.bucket) {
      case "current": result.current = Number(row.amount) || 0; break;
      case "31-60": result.thirtyOne = Number(row.amount) || 0; break;
      case "61-90": result.sixtyOne = Number(row.amount) || 0; break;
      case "90+": result.ninetyPlus = Number(row.amount) || 0; break;
    }
  }
  return result;
}

// v2 stage names
const FUNNEL_STAGES = [
  "new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost",
];

// -- Internal data shape --

interface AnalyticsRawData {
  sales: SalesAnalytics;
  projects: ProjectAnalytics;
  financial: FinancialAnalytics;
  employees: EmployeeMetrics[];
}

// -- Hook --

export function useAnalytics(
  tenantId: string | null,
  dateRange: DateRange
): AnalyticsData {
  const queryClient = useQueryClient();

  const startMs = dateRange.start.getTime();
  const endMs = dateRange.end.getTime();
  const qk = ["analytics", tenantId, startMs, endMs] as const;

  const { data, isLoading: loading, error: queryError } = useQuery<AnalyticsRawData>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();
      const startIso = dateRange.start.toISOString();
      const endIso = dateRange.end.toISOString();

      // All server-side aggregation calls in parallel
      const [
        salesOverviewRes,
        funnelRes,
        sourceRes,
        leadsTimeRes,
        projectOverviewRes,
        financialRes,
        receivableAgingRes,
        payableAgingRes,
        revenueTrendRes,
        expenseTrendRes,
        employeeRes,
      ] = await Promise.all([
        supabase.rpc("fn_sales_overview", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_sales_funnel", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_lead_sources", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_leads_over_time", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_project_overview", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_financial_summary", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_receivable_aging", { p_tenant: tenantId! }),
        supabase.rpc("fn_payable_aging", { p_tenant: tenantId! }),
        supabase.rpc("fn_revenue_trend", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_expense_trend", {
          p_tenant: tenantId!, p_from: startIso, p_to: endIso,
        }),
        supabase.rpc("fn_employee_metrics", { p_tenant: tenantId! }),
      ]);

      // -- Sales --
      const so = salesOverviewRes.data?.[0] || {};
      const funnelRows = funnelRes.data || [];
      const sourceRows = sourceRes.data || [];
      const leadsTimeRows = leadsTimeRes.data || [];

      // Build funnel with all stages (fill zeros for missing stages)
      const funnelMap = new Map<string, number>();
      for (const row of funnelRows) {
        funnelMap.set(row.stage, Number(row.cnt) || 0);
      }
      const funnelData = FUNNEL_STAGES.map((stage) => ({
        stage,
        count: funnelMap.get(stage) || 0,
      }));

      const sales: SalesAnalytics = {
        totalLeads: Number(so.total_leads) || 0,
        convertedLeads: Number(so.won_leads) || 0,
        conversionRate: Number(so.conversion_rate) || 0,
        lostLeads: Number(so.lost_leads) || 0,
        temperatureDistribution: {
          hot: Number(so.hot_count) || 0,
          warm: Number(so.warm_count) || 0,
          cold: Number(so.cold_count) || 0,
        },
        avgLeadScore: Number(so.avg_score) || 0,
        avgConversionTimeDays: 0, // TODO: add DB function if needed
        totalPipelineValue: Number(so.pipeline_value) || 0,
        funnelData,
        leadsOverTime: leadsTimeRows.map((r: any) => ({
          date: r.day,
          count: Number(r.cnt) || 0,
        })),
        sourceBreakdown: sourceRows.map((r: any) => ({
          source: r.source,
          count: Number(r.cnt) || 0,
        })),
      };

      // -- Projects --
      const projectRows = projectOverviewRes.data || [];
      let activeProjects = 0;
      let completedProjects = 0;
      let totalValue = 0;
      let avgProgress = 0;
      const stageDistribution: Array<{ status: string; count: number }> = [];

      if (projectRows.length > 0) {
        activeProjects = Number(projectRows[0].active_projects) || 0;
        completedProjects = Number(projectRows[0].completed_projects) || 0;
        totalValue = Number(projectRows[0].total_value) || 0;
        avgProgress = Number(projectRows[0].avg_progress) || 0;

        for (const row of projectRows) {
          if (row.status_label) {
            stageDistribution.push({
              status: row.status_label,
              count: Number(row.status_count) || 0,
            });
          }
        }
      }

      const projects: ProjectAnalytics = {
        activeProjects,
        completedProjects,
        delayedProjects: 0, // computed client-side from v_project_progress if needed
        onTrackPercent: activeProjects > 0 ? 100 : 0,
        avgCompletionTimeDays: 0,
        totalProjectValue: totalValue,
        stageDistribution,
        healthDistribution: [],
        avgProjectProgress: avgProgress,
      };

      // -- Financial --
      const fin = financialRes.data?.[0] || {};
      const receivableAging = parseAgingRows(receivableAgingRes.data || []);
      const payableAging = parseAgingRows(payableAgingRes.data || []);

      const financial: FinancialAnalytics = {
        totalInvoiced: Number(fin.total_invoiced) || 0,
        totalReceived: Number(fin.total_received) || 0,
        outstanding: Number(fin.outstanding) || 0,
        overdue: Number(fin.overdue_amount) || 0,
        totalExpenses: Number(fin.total_billed) || 0,
        totalPaidToVendors: Number(fin.total_paid_vendors) || 0,
        netCashflow: Number(fin.net_cashflow) || 0,
        revenueTrend: (revenueTrendRes.data || []).map((r: any) => ({
          month: r.month,
          invoiced: Number(r.invoiced) || 0,
          received: Number(r.received) || 0,
        })),
        expenseTrend: (expenseTrendRes.data || []).map((r: any) => ({
          month: r.month,
          billed: Number(r.billed) || 0,
          paid: Number(r.paid) || 0,
        })),
        receivableAging,
        payableAging,
        collectionRate: Number(fin.collection_rate) || 0,
      };

      // -- Employees --
      const empRows = employeeRes.data || [];
      const employees: EmployeeMetrics[] = empRows.map((r: any) => ({
        id: r.user_id,
        name: r.full_name || "Unknown",
        role: (r.role_names || [])[0] || "member",
        assignedLeads: Number(r.assigned_leads) || 0,
        convertedLeads: Number(r.won_leads) || 0,
        conversionRate: Number(r.lead_conversion_rate) || 0,
        avgResponseTimeHours: 0,
        tasksCompleted: Number(r.tasks_completed) || 0,
        overdueTasks: Number(r.overdue_tasks) || 0,
        activeProjects: Number(r.active_projects) || 0,
        executionCompletionPercent: 0,
      }));

      return { sales, projects, financial, employees };
    },
    enabled: !!tenantId,
  });

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  return {
    sales: data?.sales ?? emptySales,
    projects: data?.projects ?? emptyProjects,
    financial: data?.financial ?? emptyFinancial,
    employees: data?.employees ?? [],
    loading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}
