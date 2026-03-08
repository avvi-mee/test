// ─── Canonical UNMATRIX Type Registry ────────────────────────────────────────
// This file is the single source of truth for shared domain types.
// Hook-local interfaces (Lead, Project, etc.) import from here or extend these.

// ─── Employee / Roles ─────────────────────────────────────────────────────────

export type EmployeeRole =
  | "owner"
  | "admin"
  | "sales"
  | "designer"
  | "site_supervisor"
  | "project_manager"
  | "accountant";

export interface Employee {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  area: string;
  roles: EmployeeRole[];
  isOwner: boolean;
  isActive: boolean;
  joinedAt: string;
  tenantId: string;
}

// ─── Estimate Snapshot (attached to leads & projects) ─────────────────────────

export interface MaterialItem {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitRate: number;
  total: number;
}

export interface RoomEstimate {
  name: string;
  sqft: number;
  items: MaterialItem[];
  cost: number;
}

export interface EstimateSnapshot {
  carpetArea?: number;
  rooms?: RoomEstimate[];
  selectedMaterials?: MaterialItem[];
  laborCost?: number;
  materialCost?: number;
  designFee?: number;
  gst?: number;
  totalCost: number;
  plan?: string;
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  type: string;
  summary: string;
  createdBy?: string;
  createdAt: any;
}

// ─── Lead ─────────────────────────────────────────────────────────────────────

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource = "website" | "consultation" | "referral" | "manual" | "import";

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  city?: string;
  stage: LeadStage;
  status?: "active" | "converted" | "closed";
  source: LeadSource;
  score: number;
  temperature: "hot" | "warm" | "cold";
  estimatedValue: number;
  assignedTo?: string;
  customerId?: string | null;
  estimateId?: string;
  estimateData?: EstimateSnapshot | null;
  projectId?: string;
  nextFollowUp?: any;
  followUpCount: number;
  lastContactedAt?: any;
  lostReason?: string;
  notes?: string;
  createdAt: any;
  updatedAt?: any;
  activityLog?: ActivityEntry[];
  timeline: Array<{
    action: string;
    summary: string;
    timestamp: any;
    actorId?: string;
  }>;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "planning"
  | "design"
  | "material_selection"
  | "execution"
  | "handover"
  | "completed"
  | "on_hold";

export interface ProjectTeam {
  designerIds: string[];
  supervisorIds: string[];
  pmIds: string[];
  accountantIds: string[];
}

export interface ProjectPhase {
  id: string;
  name: string;
  order: number;
  status: "pending" | "in_progress" | "completed";
  completedAt?: any;
  completedBy?: string;
  notes?: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type:
    | "floor_plan"
    | "render_3d"
    | "mood_board"
    | "material_board"
    | "drawing"
    | "site_photo"
    | "document"
    | "other";
  phase?: string;
  size?: number;
  uploadedBy: string;
  visibleToClient: boolean;
  notes?: string;
  createdAt: any;
}

export interface Project {
  id: string;
  tenantId: string;
  leadId: string;
  customerId?: string | null;
  estimateId?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCity?: string;
  totalAmount: number;
  status: ProjectStatus | "in_progress" | "cancelled";
  assignedTo?: string;
  projectName?: string;
  team?: ProjectTeam;
  estimateSnapshot?: EstimateSnapshot;
  clientAccessEmail?: string | null;
  clientAuthUid?: string | null;
  startDate?: string;
  expectedEndDate?: string;
  completedDate?: string;
  createdAt: any;
  updatedAt?: any;
}

// ─── Finance: Invoice ─────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitRate: number;
  amount: number;
}

export type InvoiceType = "advance" | "progress" | "final";

export interface Invoice {
  id: string;
  tenantId: string;
  projectId: string;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  lineItems?: InvoiceLineItem[];
  gstPercent?: number;
  gstAmount?: number;
  type?: InvoiceType;
  dueDate: any;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
  paidAmount: number;
  description?: string;
  pdfUrl?: string;
  createdAt: any;
  updatedAt?: any;
  paidAt?: any;
}

// ─── Finance: Vendor Bill ─────────────────────────────────────────────────────

export type VendorBillStatus = "received" | "approved" | "paid" | "disputed" | "pending" | "partial" | "overdue";

export interface VendorBill {
  id: string;
  tenantId: string;
  projectId: string;
  vendorName: string;
  billNumber?: string;
  amount: number;
  dueDate: any;
  status: VendorBillStatus;
  paidAmount: number;
  attachmentUrl?: string;
  description?: string;
  category?: string;
  createdAt: any;
  updatedAt?: any;
  paidAt?: any;
}

// ─── Vendor ───────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  category: "Materials" | "Labour" | "Equipment" | "Other";
  phone: string;
  email: string;
  gstNumber?: string;
  address?: string;
  creditDays: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  createdAt: any;
  updatedAt?: any;
}

// ─── Client Account (portal access) ──────────────────────────────────────────

export interface ClientAccount {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  phone?: string;
  projectId: string;
  authUid: string;
  isActive: boolean;
  createdAt: any;
  lastLoginAt?: any;
}

// ─── Follow-Up ────────────────────────────────────────────────────────────────

export interface FollowUp {
  id: string;
  tenantId: string;
  leadId: string;
  type: "call" | "whatsapp" | "email" | "meeting" | "site_visit";
  scheduledAt: any;
  completedAt?: any;
  status: "pending" | "completed" | "missed" | "rescheduled";
  notes?: string;
  outcome?: string;
  createdBy?: string;
  createdByName?: string;
}
