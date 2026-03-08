// ── Contract Types ────────────────────────────────────────────────────────────

export type ContractType = "client" | "employee" | "contractor" | "vendor";

export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "active"
  | "completed"
  | "terminated"
  | "expired"
  | "renewed";

// ── Party ─────────────────────────────────────────────────────────────────────

export interface ContractParty {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  designation?: string;
}

// ── Clause ────────────────────────────────────────────────────────────────────

export interface ContractClause {
  order: number;
  title: string;
  body: string;
  isRequired: boolean;
  isEditable: boolean;
}

// ── Payment Schedule ──────────────────────────────────────────────────────────

export interface PaymentMilestone {
  label: string;
  percentage: number;
  amount: number;
  dueDate?: string;
  isPaid: boolean;
}

// ── Salary ────────────────────────────────────────────────────────────────────

export interface SalaryComponent {
  label: string;
  amount: number;
  type: "fixed" | "variable";
}

// ── Custom Fields per Type ────────────────────────────────────────────────────

export interface ClientContractFields {
  projectId?: string;
  leadId?: string;
  projectName?: string;
  projectAddress?: string;
  totalValue: number;
  paymentSchedule: PaymentMilestone[];
  deliverables?: string;
  completionDate?: string;
  warrantyPeriodDays?: number;
}

export interface EmployeeContractFields {
  employeeId?: string;
  designation: string;
  department?: string;
  salary: number;
  salaryBreakdown: SalaryComponent[];
  joiningDate: string;
  probationDays?: number;
  noticePeriodDays?: number;
  workingHoursPerWeek?: number;
  leaveEntitlement?: number;
}

export interface ContractorFields {
  projectId?: string;
  projectName?: string;
  scopeOfWork: string;
  totalValue: number;
  paymentSchedule: PaymentMilestone[];
  startDate?: string;
  endDate?: string;
  materialProvisionBy?: "contractor" | "studio" | "shared";
  penaltyClause?: string;
}

export interface VendorAgreementFields {
  vendorCategory?: string;
  supplyItems?: string;
  creditPeriodDays?: number;
  discountPercent?: number;
  deliveryTerms?: string;
  qualityStandards?: string;
  exclusivity?: boolean;
}

// ── Base Contract ─────────────────────────────────────────────────────────────

export interface Contract {
  id: string;
  tenantId: string;
  contractNumber: string;
  type: ContractType;
  title: string;
  status: ContractStatus;

  partyA: ContractParty;
  partyB: ContractParty;

  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;

  clauses: ContractClause[];
  customFields: ClientContractFields | EmployeeContractFields | ContractorFields | VendorAgreementFields;

  // Signing
  signToken?: string;
  signTokenExpiry?: any;
  sentAt?: any;
  viewedAt?: any;
  partyBSignedAt?: any;
  partyBSignature?: string;
  partyBSignedIP?: string;
  signedByPartyB?: boolean;
  partyASignedAt?: any;
  partyASignature?: string;

  // PDF
  pdfUrl?: string;
  pdfGeneratedAt?: any;

  notes?: string;
  templateId?: string;
  createdAt: any;
  updatedAt?: any;
}

// ── Discriminated Union for Type-Safe Narrowing ───────────────────────────────

export type ContractWithType =
  | (Omit<Contract, "type" | "customFields"> & { type: "client"; customFields: ClientContractFields })
  | (Omit<Contract, "type" | "customFields"> & { type: "employee"; customFields: EmployeeContractFields })
  | (Omit<Contract, "type" | "customFields"> & { type: "contractor"; customFields: ContractorFields })
  | (Omit<Contract, "type" | "customFields"> & { type: "vendor"; customFields: VendorAgreementFields });

// ── Activity Log ──────────────────────────────────────────────────────────────

export interface ContractActivityLog {
  id: string;
  action: string;
  summary: string;
  actorId: string;
  createdAt: any;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface ContractTemplate {
  id?: string;
  tenantId: string;
  type: ContractType;
  defaultClauses: ContractClause[];
  updatedAt: any;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface ContractStats {
  total: number;
  draft: number;
  active: number;
  awaitingSignature: number;
  expiring: number;
  expired: number;
  terminated: number;
  totalValue: number;
}
