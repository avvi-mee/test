export interface TaskAttachment {
  name: string;
  url: string;
  uploadedAt: any;
  uploadedBy: string;
}

export interface TaskComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  isInternal: boolean; // true = hidden from client portal
}

export interface Phase {
  id: string;
  name: string;
  order: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  tasks: Task[];
  progressPercentage?: number;
  isDelayed?: boolean;
  startDate?: any;
  endDate?: any;
}

export interface Task {
  id: string;
  name: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  assignedTo?: string;
  dueDate?: any;
  completedAt?: any;
  notes?: string;
  isOverdue?: boolean;
  progress: number; // 0-100
  attachments: TaskAttachment[];
  comments: TaskComment[];
}

function generateId(): string {
  return crypto.randomUUID();
}

function buildPhase(name: string, order: number, taskNames: string[]): Phase {
  return {
    id: generateId(),
    name,
    order,
    status: "pending",
    tasks: taskNames.map((t) => ({
      id: generateId(),
      name: t,
      status: "pending" as const,
      progress: 0,
      attachments: [],
      comments: [],
    })),
  };
}

export function getDefaultPhases(projectType: string): Phase[] {
  if (projectType === "Commercial") {
    return [
      buildPhase("Site Survey & Measurement", 1, [
        "Schedule site visit",
        "Take measurements",
        "Photo documentation",
        "Create floor plan",
      ]),
      buildPhase("Design & Planning", 2, [
        "Concept design",
        "3D visualization",
        "Material selection",
        "Client approval on design",
      ]),
      buildPhase("Procurement", 3, [
        "Material ordering",
        "Vendor coordination",
        "Delivery scheduling",
      ]),
      buildPhase("Execution", 4, [
        "Demolition (if needed)",
        "Civil work",
        "Electrical & plumbing",
        "Furniture installation",
        "Painting & finishing",
      ]),
      buildPhase("Handover", 5, [
        "Final inspection",
        "Client walkthrough",
        "Snag list resolution",
        "Project handover",
      ]),
    ];
  }
  // Residential (default)
  return [
    buildPhase("Site Survey & Measurement", 1, [
      "Schedule site visit",
      "Take measurements",
      "Photo documentation",
    ]),
    buildPhase("Design & Planning", 2, [
      "Concept design",
      "3D visualization",
      "Material selection",
      "Client approval on design",
    ]),
    buildPhase("Procurement", 3, [
      "Material ordering",
      "Vendor coordination",
      "Delivery scheduling",
    ]),
    buildPhase("Execution", 4, [
      "Civil work",
      "Electrical & plumbing",
      "Modular furniture installation",
      "Painting & finishing",
      "Deep cleaning",
    ]),
    buildPhase("Handover", 5, [
      "Final inspection",
      "Client walkthrough",
      "Project handover",
    ]),
  ];
}
