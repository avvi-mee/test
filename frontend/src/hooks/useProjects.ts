"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";
import type { Project, ActivityLogEntry } from "@/lib/services/projectService";
import { logActivity } from "@/lib/services/projectService";
import type { Phase, Task, TaskAttachment, TaskComment } from "@/lib/services/taskTemplates";
import { uploadImage } from "@/lib/storageHelpers";

export type { Project };

// ---------------------------------------------------------------------------
// v2: Table renames
//   project_phases -> phases
//   project_tasks  -> tasks
//   timeline_events / project_activity_log -> activity_logs
//   No more *_name denormalized columns
//   tasks now have tenant_id (denorm for RLS)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Row types (snake_case from Supabase)
// ---------------------------------------------------------------------------
interface ProjectRow {
  id: string;
  tenant_id: string;
  lead_id: string;
  estimate_id?: string;
  name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_city?: string;
  contract_value: number;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  manager_id?: string;
  designer_id?: string;
  supervisor_id?: string;
  progress?: number;
  start_date?: string;
  target_end_date?: string;
  actual_end_date?: string;
  created_at: string;
  updated_at?: string;
}

interface PhaseRow {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  start_date?: string;
  end_date?: string;
}

interface TaskRow {
  id: string;
  phase_id: string;
  project_id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  status: "pending" | "in_progress" | "completed" | "blocked";
  progress: number;
  assignee_id?: string;
  due_date?: string;
  completed_at?: string;
  notes?: string;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  name: string;
  url: string;
  uploaded_by: string;
  created_at: string;
}

interface CommentRow {
  id: string;
  task_id: string;
  text: string;
  author_id: string;
  created_at: string;
  is_internal: boolean;
}

interface ActivityRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  actor_id?: string;
  metadata?: any;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Column selections (avoid SELECT *)
// ---------------------------------------------------------------------------
const PROJECT_COLS = "id,tenant_id,lead_id,estimate_id,name,client_name,client_email,client_phone,client_city,contract_value,status,manager_id,designer_id,supervisor_id,progress,start_date,target_end_date,actual_end_date,created_at,updated_at";
const PHASE_COLS = "id,project_id,name,sort_order,status,start_date,end_date";
const TASK_COLS = "id,phase_id,project_id,tenant_id,name,sort_order,status,progress,assignee_id,due_date,completed_at,notes";
const ATTACHMENT_COLS = "id,task_id,name,url,uploaded_by,created_at";
const COMMENT_COLS = "id,task_id,text,author_id,created_at,is_internal";

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function mapTaskRow(
  row: TaskRow,
  attachments: TaskAttachment[],
  comments: TaskComment[]
): Task {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    progress: row.progress ?? 0,
    assignedTo: row.assignee_id,
    dueDate: row.due_date || undefined,
    completedAt: row.completed_at || undefined,
    notes: row.notes,
    attachments,
    comments,
  };
}

function mapPhaseRow(row: PhaseRow, tasks: Task[]): Phase {
  return {
    id: row.id,
    name: row.name,
    order: row.sort_order,
    status: row.status,
    tasks,
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
  };
}

function mapProjectRow(
  row: ProjectRow,
  phases: Phase[],
  timeline: Project["timeline"]
): Project {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    leadId: row.lead_id,
    estimateId: row.estimate_id,
    clientName: row.client_name,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    clientCity: row.client_city,
    totalAmount: row.contract_value,
    status: row.status,
    projectName: row.name,
    // v2: role assignments point to tenant_users IDs
    assignedDesigner: row.designer_id,
    assignedSupervisor: row.supervisor_id,
    assignedTo: row.manager_id,
    phases,
    startDate: row.start_date,
    expectedEndDate: row.target_end_date,
    completedDate: row.actual_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timeline,
    projectProgress: row.progress,
  };
}

// ---------------------------------------------------------------------------
// Enrichment: progress, overdue, health (computed from tasks -- no stored health_status)
// ---------------------------------------------------------------------------

function enrichProjects(rawProjects: Project[]): Project[] {
  const now = new Date();

  return rawProjects.map((project) => {
    let totalOverdue = 0;

    const enrichedPhases = project.phases.map((phase) => {
      const total = phase.tasks?.length || 0;
      let phaseOverdueCount = 0;

      const enrichedTasks =
        phase.tasks?.map((task) => {
          const isOverdue =
            task.status !== "completed" &&
            task.dueDate &&
            new Date(task.dueDate) < now;
          if (isOverdue) {
            phaseOverdueCount++;
            totalOverdue++;
          }
          return { ...task, isOverdue: !!isOverdue };
        }) || [];

      const progressPercentage =
        total > 0
          ? Math.round(
              enrichedTasks.reduce(
                (sum, t) =>
                  sum + (t.progress ?? (t.status === "completed" ? 100 : 0)),
                0
              ) / total
            )
          : 0;

      const isDelayed = total > 0 && phaseOverdueCount / total > 0.3;

      return { ...phase, tasks: enrichedTasks, progressPercentage, isDelayed };
    });

    const projectProgress =
      enrichedPhases.length > 0
        ? Math.round(
            enrichedPhases.reduce(
              (sum, p) => sum + (p.progressPercentage || 0),
              0
            ) / enrichedPhases.length
          )
        : 0;

    const anyPhaseDelayed = enrichedPhases.some((p) => p.isDelayed);
    const healthStatus: "on_track" | "at_risk" | "delayed" = anyPhaseDelayed
      ? "delayed"
      : totalOverdue > 0
        ? "at_risk"
        : "on_track";

    return { ...project, phases: enrichedPhases, projectProgress, healthStatus };
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProjects(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["projects", tenantId] as const;

  const { data: projects = [], isLoading: loading } = useRealtimeQuery<Project[]>({
    queryKey: qk,
    queryFn: async () => {
      const supabase = getSupabase();

      // 1. Project rows (paginated -- first 50)
      const { data: projectRows, error: pErr } = await supabase
        .from("projects")
        .select(PROJECT_COLS)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .range(0, 49);

      if (pErr) throw pErr;
      if (!projectRows || projectRows.length === 0) return [];

      const projectIds = projectRows.map((p: ProjectRow) => p.id);

      // 2. Phases (renamed from project_phases)
      const { data: phaseRows } = await supabase
        .from("phases")
        .select(PHASE_COLS)
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });

      // 3. Tasks (renamed from project_tasks, now has tenant_id)
      const { data: taskRows } = await supabase
        .from("tasks")
        .select(TASK_COLS)
        .in("project_id", projectIds)
        .order("sort_order", { ascending: true });

      // 4. Attachments & comments
      const taskIds = (taskRows || []).map((t: TaskRow) => t.id);

      let attachmentRows: AttachmentRow[] = [];
      let commentRows: CommentRow[] = [];

      if (taskIds.length > 0) {
        const [attRes, comRes] = await Promise.all([
          supabase
            .from("task_attachments")
            .select(ATTACHMENT_COLS)
            .in("task_id", taskIds),
          supabase
            .from("task_comments")
            .select(COMMENT_COLS)
            .in("task_id", taskIds)
            .order("created_at", { ascending: true }),
        ]);
        attachmentRows = (attRes.data || []) as AttachmentRow[];
        commentRows = (comRes.data || []) as CommentRow[];
      }

      // 5. Activity logs (replaces timeline_events + project_activity_log)
      const { data: activityRows } = await supabase
        .from("activity_logs")
        .select("id,entity_type,entity_id,action,summary,actor_id,created_at")
        .eq("entity_type", "project")
        .in("entity_id", projectIds)
        .order("created_at", { ascending: false });

      // -- Index attachments by task_id --
      const attachmentsByTask = new Map<string, TaskAttachment[]>();
      for (const a of attachmentRows) {
        const list = attachmentsByTask.get(a.task_id) || [];
        list.push({
          name: a.name,
          url: a.url,
          uploadedAt: a.created_at,
          uploadedBy: a.uploaded_by,
        });
        attachmentsByTask.set(a.task_id, list);
      }

      // -- Index comments by task_id --
      const commentsByTask = new Map<string, TaskComment[]>();
      for (const c of commentRows) {
        const list = commentsByTask.get(c.task_id) || [];
        list.push({
          id: c.id,
          text: c.text,
          authorId: c.author_id,
          authorName: "", // v2: names resolved via JOIN in UI, not stored
          createdAt: c.created_at,
          isInternal: c.is_internal,
        });
        commentsByTask.set(c.task_id, list);
      }

      // -- Index tasks by phase_id --
      const tasksByPhase = new Map<string, Task[]>();
      for (const t of (taskRows || []) as TaskRow[]) {
        const list = tasksByPhase.get(t.phase_id) || [];
        list.push(
          mapTaskRow(
            t,
            attachmentsByTask.get(t.id) || [],
            commentsByTask.get(t.id) || []
          )
        );
        tasksByPhase.set(t.phase_id, list);
      }

      // -- Index phases by project_id --
      const phasesByProject = new Map<string, Phase[]>();
      for (const ph of (phaseRows || []) as PhaseRow[]) {
        const list = phasesByProject.get(ph.project_id) || [];
        list.push(mapPhaseRow(ph, tasksByPhase.get(ph.id) || []));
        phasesByProject.set(ph.project_id, list);
      }

      // -- Index activity logs by project_id --
      const activityByProject = new Map<string, Project["timeline"]>();
      for (const al of (activityRows || []) as ActivityRow[]) {
        const list = activityByProject.get(al.entity_id) || [];
        list.push({
          id: al.id,
          action: al.summary || al.action,
          timestamp: al.created_at,
          updatedBy: al.actor_id,
          note: al.summary,
        });
        activityByProject.set(al.entity_id, list);
      }

      // -- Assemble projects --
      const assembled = (projectRows as ProjectRow[]).map((row) =>
        mapProjectRow(
          row,
          phasesByProject.get(row.id) || [],
          activityByProject.get(row.id) || []
        )
      );

      // -- Enrich --
      return enrichProjects(assembled);
    },
    table: "projects",
    filter: `tenant_id=eq.${tenantId}`,
    enabled: !!tenantId,
    additionalTables: [
      { table: "phases", filter: `tenant_id=eq.${tenantId}` },
      { table: "tasks", filter: `tenant_id=eq.${tenantId}` },
    ],
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  // Stats derived via useMemo
  const stats = useMemo(() => {
    return {
      planning: projects.filter((p) => p.status === "planning").length,
      inProgress: projects.filter((p) => p.status === "in_progress").length,
      onHold: projects.filter((p) => p.status === "on_hold").length,
      completed: projects.filter((p) => p.status === "completed").length,
      totalValue: projects.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
      atRisk: projects.filter((p) => p.healthStatus === "at_risk").length,
      delayed: projects.filter((p) => p.healthStatus === "delayed").length,
      totalOverdueTasks: projects.reduce(
        (sum, p) =>
          sum +
          p.phases.reduce(
            (s, ph) =>
              s + (ph.tasks?.filter((t) => (t as any).isOverdue).length || 0),
            0
          ),
        0
      ),
    };
  }, [projects]);

  // -----------------------------------------------------------------------
  // updateProject
  // -----------------------------------------------------------------------
  const updateProject = useCallback(
    async (projectId: string, updates: Partial<Project>) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        const dbUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.projectName !== undefined) dbUpdates.name = updates.projectName;
        if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
        if (updates.expectedEndDate !== undefined) dbUpdates.target_end_date = updates.expectedEndDate;
        if (updates.completedDate !== undefined) dbUpdates.actual_end_date = updates.completedDate;
        if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
        if (updates.clientEmail !== undefined) dbUpdates.client_email = updates.clientEmail;
        if (updates.clientPhone !== undefined) dbUpdates.client_phone = updates.clientPhone;
        if (updates.clientCity !== undefined) dbUpdates.client_city = updates.clientCity;
        if (updates.projectProgress !== undefined) dbUpdates.progress = updates.projectProgress;

        const { error } = await supabase
          .from("projects")
          .update(dbUpdates)
          .eq("id", projectId)
          .eq("tenant_id", tenantId);

        if (error) throw error;

        logActivity(tenantId, projectId, {
          action: "Project updated",
          entityType: "project",
          entityId: projectId,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating project:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // updatePhase
  // -----------------------------------------------------------------------
  const updatePhase = useCallback(
    async (projectId: string, phaseId: string, newStatus: Phase["status"]) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        // v2: table is now "phases"
        const { error } = await supabase
          .from("phases")
          .update({ status: newStatus })
          .eq("id", phaseId)
          .eq("project_id", projectId);

        if (error) throw error;

        const project = projects.find((p) => p.id === projectId);
        const phaseName =
          project?.phases.find((p) => p.id === phaseId)?.name || "Unknown";

        // v2: insert into activity_logs (replaces timeline_events)
        await supabase.from("activity_logs").insert({
          tenant_id: tenantId,
          entity_type: "project",
          entity_id: projectId,
          action: "status_changed",
          summary: `Phase "${phaseName}" marked as ${newStatus}`,
        });

        logActivity(tenantId, projectId, {
          action: `Phase "${phaseName}" marked as ${newStatus}`,
          entityType: "phase",
          entityId: phaseId,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating phase:", error);
        return false;
      }
    },
    [tenantId, projects, invalidate]
  );

  // -----------------------------------------------------------------------
  // updateTask (+ auto-sync progress/status, phase status)
  // v2: No more cascading project health_status write -- computed lazily
  // -----------------------------------------------------------------------
  const updateTask = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      updates: Partial<Task>
    ) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        const dbUpdates: Record<string, any> = {};
        if (updates.name !== undefined) dbUpdates.name = updates.name;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.assignedTo !== undefined) dbUpdates.assignee_id = updates.assignedTo;
        if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;

        // Progress-status auto-sync
        if (updates.progress !== undefined) {
          dbUpdates.progress = updates.progress;
          if (updates.progress === 100) {
            dbUpdates.status = "completed";
            dbUpdates.completed_at = new Date().toISOString();
          } else if (updates.progress > 0) {
            dbUpdates.status = "in_progress";
            dbUpdates.completed_at = null;
          } else {
            dbUpdates.status = "pending";
            dbUpdates.completed_at = null;
          }
        } else if (updates.status !== undefined) {
          dbUpdates.status = updates.status;
          if (updates.status === "completed") {
            dbUpdates.progress = 100;
            dbUpdates.completed_at = new Date().toISOString();
          }
        }

        // v2: table is now "tasks"
        const { error: taskErr } = await supabase
          .from("tasks")
          .update(dbUpdates)
          .eq("id", taskId)
          .eq("phase_id", phaseId);

        if (taskErr) throw taskErr;

        // Recalculate phase status from all tasks in this phase
        const { data: phaseTasks } = await supabase
          .from("tasks")
          .select("status,progress")
          .eq("phase_id", phaseId);

        if (phaseTasks && phaseTasks.length > 0) {
          const allCompleted = phaseTasks.every(
            (t: any) => t.status === "completed"
          );
          const anyInProgress = phaseTasks.some(
            (t: any) =>
              t.status === "in_progress" || t.status === "completed"
          );
          const phaseStatus = allCompleted
            ? "completed"
            : anyInProgress
              ? "in_progress"
              : "pending";

          await supabase
            .from("phases")
            .update({ status: phaseStatus })
            .eq("id", phaseId);
        }

        // v2: Project progress is computed lazily via v_project_progress view.
        // No cascading project update needed. Just log the activity.
        logActivity(tenantId, projectId, {
          action:
            updates.progress !== undefined
              ? `Task progress updated to ${updates.progress}%`
              : `Task "${updates.status === "completed" ? "completed" : "updated"}"`,
          entityType: "task",
          entityId: taskId,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error updating task:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // addTaskAttachment
  // -----------------------------------------------------------------------
  const addTaskAttachment = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      file: File,
      uploadedBy: string
    ) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        const storagePath = `tenants/${tenantId}/projects/${projectId}/tasks/${taskId}/${Date.now()}_${file.name}`;
        const url = await uploadImage(file, storagePath);

        // v2: task_attachments now has tenant_id
        const { error } = await supabase.from("task_attachments").insert({
          task_id: taskId,
          tenant_id: tenantId,
          name: file.name,
          url,
          uploaded_by: uploadedBy,
        });

        if (error) throw error;

        logActivity(tenantId, projectId, {
          action: `File "${file.name}" uploaded to task`,
          entityType: "attachment",
          entityId: taskId,
          performedBy: uploadedBy,
          metadata: { fileName: file.name, url },
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding attachment:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // addTaskComment
  // -----------------------------------------------------------------------
  const addTaskComment = useCallback(
    async (
      projectId: string,
      phaseId: string,
      taskId: string,
      text: string,
      authorId: string,
      authorName: string,
      isInternal: boolean
    ) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        // v2: task_comments now has tenant_id, no author_name column
        const { error } = await supabase.from("task_comments").insert({
          task_id: taskId,
          tenant_id: tenantId,
          text,
          author_id: authorId,
          is_internal: isInternal,
        });

        if (error) throw error;

        logActivity(tenantId, projectId, {
          action: `Comment added to task${isInternal ? " (internal)" : ""}`,
          entityType: "comment",
          entityId: taskId,
          performedBy: authorId,
          performedByName: authorName,
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error adding comment:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // assignRole
  // v2: No more *_name columns. Only store the tenant_user ID.
  // -----------------------------------------------------------------------
  const assignRole = useCallback(
    async (
      projectId: string,
      role: "designer" | "supervisor" | "manager",
      tenantUserId: string,
      memberName: string
    ) => {
      if (!tenantId) return false;
      try {
        const supabase = getSupabase();

        // v2: only ID columns, no name columns
        const fieldMap: Record<string, string> = {
          designer: "designer_id",
          supervisor: "supervisor_id",
          manager: "manager_id",
        };

        const field = fieldMap[role];

        const { error } = await supabase
          .from("projects")
          .update({
            [field]: tenantUserId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", projectId)
          .eq("tenant_id", tenantId);

        if (error) throw error;

        // v2: activity_logs (replaces timeline_events)
        await supabase.from("activity_logs").insert({
          tenant_id: tenantId,
          entity_type: "project",
          entity_id: projectId,
          action: "assigned",
          summary: `${role.charAt(0).toUpperCase() + role.slice(1)} assigned: ${memberName}`,
        });

        logActivity(tenantId, projectId, {
          action: `${role.charAt(0).toUpperCase() + role.slice(1)} assigned: ${memberName}`,
          entityType: "project",
          entityId: projectId,
          metadata: { role, tenantUserId, memberName },
        }).catch(() => {});

        invalidate();
        return true;
      } catch (error) {
        console.error("Error assigning role:", error);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  // -----------------------------------------------------------------------
  // fetchActivityLog
  // v2: reads from activity_logs (replaces project_activity_log)
  // -----------------------------------------------------------------------
  const fetchActivityLog = useCallback(
    async (projectId: string): Promise<ActivityLogEntry[]> => {
      if (!tenantId) return [];
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("activity_logs")
        .select("id,entity_type,entity_id,action,summary,actor_id,metadata,created_at")
        .eq("tenant_id", tenantId)
        .eq("entity_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching activity log:", error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        action: row.summary || row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        performedBy: row.actor_id,
        metadata: row.metadata,
        timestamp: row.created_at,
      }));
    },
    [tenantId]
  );

  return {
    projects,
    stats,
    loading,
    updateProject,
    updatePhase,
    updateTask,
    fetchActivityLog,
    addTaskAttachment,
    addTaskComment,
    assignRole,
  };
}
