"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useContracts } from "@/hooks/useContracts";
import { CreateEmployeeContractDrawer } from "@/components/dashboard/contracts/CreateEmployeeContractDrawer";
import { ContractDetailDrawer } from "@/components/dashboard/contracts/ContractDetailDrawer";
import { ContractStatusBadge } from "@/components/dashboard/contracts/ContractStatusBadge";
import type { Contract, EmployeeContractFields } from "@/types/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import { useTeam, type TeamMember } from "@/hooks/useTeam";
import { useLeads } from "@/hooks/useLeads";
import type { EmployeeRole } from "@/types";
import { getFirebaseAuth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Edit,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldOff,
  Check,
  Copy,
  Loader2,
  Users,
  FileSignature,
  Crown,
  Zap,
  Target,
  Pen,
  HardHat,
  BarChart2,
  ClipboardList,
} from "lucide-react";

// ─── Static Config ───────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { icon: ReactNode; label: string; pill: string; topBorder: string; avatar: string }
> = {
  owner: {
    icon: <Crown className="h-2.5 w-2.5" />,
    label: "OWNER",
    pill: "bg-[#FFF8E8] text-[#A0700A]",
    topBorder: "border-t-[2px] border-[#A0700A]",
    avatar: "from-amber-400 to-orange-500",
  },
  admin: {
    icon: <Zap className="h-2.5 w-2.5" />,
    label: "ADMIN",
    pill: "bg-[#FFF3E0] text-[#C26700]",
    topBorder: "border-t-[2px] border-[#C26700]",
    avatar: "from-orange-400 to-amber-500",
  },
  sales: {
    icon: <Target className="h-2.5 w-2.5" />,
    label: "SALES",
    pill: "bg-[#EEF2FF] text-[#4B56D2]",
    topBorder: "border-t-[2px] border-[#4B56D2]",
    avatar: "from-indigo-400 to-violet-500",
  },
  designer: {
    icon: <Pen className="h-2.5 w-2.5" />,
    label: "DESIGNER",
    pill: "bg-[#EDFBF3] text-[#1A7A47]",
    topBorder: "border-t-[2px] border-[#1A7A47]",
    avatar: "from-emerald-400 to-teal-500",
  },
  site_supervisor: {
    icon: <HardHat className="h-2.5 w-2.5" />,
    label: "SITE SUPERVISOR",
    pill: "bg-[#E8F4FD] text-[#1D6FA4]",
    topBorder: "border-t-[2px] border-[#1D6FA4]",
    avatar: "from-sky-400 to-blue-500",
  },
  accountant: {
    icon: <BarChart2 className="h-2.5 w-2.5" />,
    label: "ACCOUNTANT",
    pill: "bg-[#F3F0FF] text-[#6B4FBB]",
    topBorder: "border-t-[2px] border-[#6B4FBB]",
    avatar: "from-violet-400 to-purple-500",
  },
  project_manager: {
    icon: <ClipboardList className="h-2.5 w-2.5" />,
    label: "PROJECT MANAGER",
    pill: "bg-[#FDF0F8] text-[#9B2158]",
    topBorder: "border-t-[2px] border-[#9B2158]",
    avatar: "from-pink-400 to-rose-500",
  },
};

const FILTER_TABS = [
  { value: "all",             label: "All"             },
  { value: "admin",           label: "Admin"           },
  { value: "sales",           label: "Sales"           },
  { value: "designer",        label: "Designer"        },
  { value: "site_supervisor", label: "Site Supervisor" },
  { value: "accountant",      label: "Accountant"      },
  { value: "project_manager", label: "Project Manager" },
];

const ROLE_OPTIONS = [
  "admin",
  "sales",
  "designer",
  "site_supervisor",
  "accountant",
  "project_manager",
] as const;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPrimaryRole(member: TeamMember): string {
  if (member.isOwner) return "owner";
  return member.roles[0] ?? "sales";
}

// ─── TableView ───────────────────────────────────────────────────────────────

function TableView({
  members,
  leadCountMap,
  contractByEmployeeId,
  onEdit,
  onAccess,
  onDelete,
  onToggleActive,
  onContract,
  onViewContract,
}: {
  members: TeamMember[];
  leadCountMap: Record<string, number>;
  contractByEmployeeId: Map<string, Contract>;
  onEdit: (m: TeamMember) => void;
  onAccess: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
  onToggleActive: (m: TeamMember) => void;
  onContract: (m: TeamMember) => void;
  onViewContract: (c: Contract) => void;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Employee</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Area</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead>Login Access</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const primaryRole = getPrimaryRole(m);
            const roleConf = ROLE_CONFIG[primaryRole] ?? ROLE_CONFIG.sales;
            const lc = leadCountMap[m.userId] ?? 0;
            return (
              <TableRow key={m.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-8 w-8 rounded-full bg-gradient-to-br ${roleConf.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}
                    >
                      {getInitials(m.fullName || "?")}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {m.fullName}
                      </p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {m.isOwner && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${ROLE_CONFIG.owner.pill}`}>
                        {ROLE_CONFIG.owner.icon} {ROLE_CONFIG.owner.label}
                      </span>
                    )}
                    {m.roles.map((r) => {
                      const rc = ROLE_CONFIG[r];
                      if (!rc) return null;
                      return (
                        <span key={r} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${rc.pill}`}>
                          {rc.icon} {rc.label}
                        </span>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {m.phone || "—"}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {m.area || "—"}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {lc}
                  </span>
                </TableCell>
                <TableCell>
                  {m.userId ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                      <ShieldOff className="h-3 w-3" /> No Access
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={m.isActive}
                    onCheckedChange={() => onToggleActive(m)}
                    disabled={m.isOwner}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(m)}
                      className="h-7 px-2"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAccess(m)}
                      className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    {(() => {
                      const empContract = contractByEmployeeId.get(m.id);
                      return empContract ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewContract(empContract)}
                          className="h-7 px-2 text-[#4B56D2] hover:bg-[#EEF2FF]"
                          title="View Contract"
                        >
                          <FileSignature className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onContract(m)}
                          className="h-7 px-2 text-[#8A8A8A] hover:text-[#4B56D2] hover:bg-[#EEF2FF]"
                          title="Create Contract"
                        >
                          <FileSignature className="h-3.5 w-3.5" />
                        </Button>
                      );
                    })()}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(m)}
                      disabled={m.isOwner}
                      className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── AddEditDrawer ───────────────────────────────────────────────────────────

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  area: string;
  roles: EmployeeRole[];
};

function AddEditDrawer({
  open,
  isEdit,
  member,
  form,
  setForm,
  saving,
  onSave,
  onClose,
}: {
  open: boolean;
  isEdit: boolean;
  member: TeamMember | null;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const toggleRole = (role: string) => {
    if ((form.roles as string[]).includes(role)) {
      if (form.roles.length === 1) return; // must keep at least one
      setForm((f) => ({ ...f, roles: f.roles.filter((r) => r !== role) as EmployeeRole[] }));
    } else {
      setForm((f) => ({ ...f, roles: [...f.roles, role as EmployeeRole] }));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md sm:mr-0 sm:ml-auto sm:h-screen sm:rounded-l-2xl sm:rounded-r-none p-0 overflow-y-auto">
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {isEdit
                ? `Edit ${member?.fullName ?? "Member"}`
                : "Add Team Member"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name *</Label>
            <Input
              id="add-name"
              placeholder="e.g. Priya Sharma"
              value={form.fullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, fullName: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email *</Label>
            <Input
              id="add-email"
              type="email"
              placeholder="e.g. priya@example.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              disabled={isEdit && !!member?.userId}
            />
            {isEdit && !!member?.userId && (
              <p className="text-xs text-gray-400">
                Email cannot be changed after login access is granted.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-phone">Phone</Label>
            <Input
              id="add-phone"
              placeholder="e.g. +91 98765 43210"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-area">Area / Territory</Label>
            <Input
              id="add-area"
              placeholder="e.g. Mumbai West"
              value={form.area}
              onChange={(e) =>
                setForm((f) => ({ ...f, area: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>
              Roles *{" "}
              <span className="text-xs text-gray-400 font-normal">
                (select at least one)
              </span>
            </Label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((role) => {
                const conf = ROLE_CONFIG[role];
                const selected = form.roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      selected
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{conf.icon}</span>
                      {conf.label}
                    </span>
                    {selected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
              <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                This person will see sections for all their selected roles in their dashboard.
              </p>
            </div>
          </div>

          {!isEdit && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <KeyRound className="h-3 w-3 shrink-0" />
              After adding, use the key icon to grant this employee login
              access.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={
                saving ||
                !form.fullName ||
                !form.email ||
                form.roles.length === 0
              }
              className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEdit ? "Save Changes" : "Add Employee"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AccessModal ─────────────────────────────────────────────────────────────

function AccessModal({
  member,
  password,
  confirmPwd,
  showPwd,
  showConfirmPwd,
  saving,
  success,
  tenantDomain,
  onGrant,
  onClose,
  onPasswordChange,
  onConfirmChange,
  onTogglePwd,
  onToggleConfirmPwd,
}: {
  member: TeamMember | null;
  password: string;
  confirmPwd: string;
  showPwd: boolean;
  showConfirmPwd: boolean;
  saving: boolean;
  success: boolean;
  tenantDomain: string;
  onGrant: () => void;
  onClose: () => void;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onTogglePwd: () => void;
  onToggleConfirmPwd: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const loginUrl = `${tenantDomain}/dashboard`;
  const hasAccess = !!member?.userId;

  const copyUrl = () => {
    navigator.clipboard.writeText(loginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            {hasAccess ? "Manage Login Access" : "Grant Login Access"}
          </DialogTitle>
        </DialogHeader>

        {member && !success && (
          <div className="space-y-4 pt-1">
            {/* Employee info */}
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 flex items-center gap-3">
              {(() => {
                const primaryRole = getPrimaryRole(member);
                const roleConf = ROLE_CONFIG[primaryRole] ?? ROLE_CONFIG.sales;
                return (
                  <div
                    className={`h-9 w-9 rounded-full bg-gradient-to-br ${roleConf.avatar} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                  >
                    {getInitials(member.fullName || "?")}
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {member.fullName}
                </p>
                <p className="text-xs text-gray-500 truncate">{member.email}</p>
              </div>
              {hasAccess ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full shrink-0">
                  <ShieldOff className="h-3 w-3" /> No Access
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-pwd">
                {hasAccess ? "New Password" : "Create Password"}
              </Label>
              <div className="relative">
                <Input
                  id="modal-pwd"
                  type={showPwd ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onTogglePwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="modal-confirm">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="modal-confirm"
                  type={showConfirmPwd ? "text" : "password"}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  value={confirmPwd}
                  onChange={(e) => onConfirmChange(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onToggleConfirmPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPwd ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPwd && password !== confirmPwd && (
                <p className="text-xs text-red-500">
                  Passwords don&apos;t match.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={onGrant}
                disabled={
                  saving || password.length < 6 || password !== confirmPwd
                }
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-1" />
                )}
                {hasAccess ? "Update Password" : "Grant Access"}
              </Button>
            </div>
          </div>
        )}

        {/* Success state */}
        {member && success && (
          <div className="space-y-4 pt-1">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Access Granted!</h3>
              <p className="text-sm text-gray-500">
                {member.fullName} can now log in with their email.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Login URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 text-gray-700 text-xs rounded-lg px-3 py-2 truncate font-mono">
                  {loginUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyUrl}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button
              onClick={onClose}
              className="w-full bg-gray-900 text-white hover:bg-gray-800"
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── DeleteDialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
  member,
  saving,
  onDelete,
  onClose,
}: {
  member: TeamMember | null;
  saving: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            Remove {member?.fullName}?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mt-1">
          This will deactivate their account and remove them from your active
          team. This cannot be undone.
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            disabled={saving}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { tenant } = useTenantAuth();
  const { toast } = useToast();
  const tenantId = tenant?.id ?? null;

  const { members, loading, addMember, updateMember, removeMember } =
    useTeam(tenantId);
  const { leads } = useLeads(tenantId);

  // Filter
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add / Edit
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<FormState>({
    fullName: "",
    email: "",
    phone: "",
    area: "",
    roles: ["sales"],
  });
  const [formSaving, setFormSaving] = useState(false);

  // Access
  const [accessMember, setAccessMember] = useState<TeamMember | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessSuccess, setAccessSuccess] = useState(false);

  // Delete
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Contracts
  const { contracts } = useContracts(tenantId);
  const [createContractMember, setCreateContractMember] = useState<TeamMember | null>(null);
  const [detailContract, setDetailContract] = useState<Contract | null>(null);

  const contractByEmployeeId = useMemo(() => {
    const map = new Map<string, Contract>();
    for (const c of contracts) {
      if (c.type === "employee") {
        const cf = c.customFields as EmployeeContractFields;
        if (cf?.employeeId) map.set(cf.employeeId, c);
      }
    }
    return map;
  }, [contracts]);

  // Derived
  const leadCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.assignedTo) map[l.assignedTo] = (map[l.assignedTo] ?? 0) + 1;
    });
    return map;
  }, [leads]);

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        if (
          roleFilter !== "all" &&
          !(m.roles as string[]).includes(roleFilter) &&
          !(roleFilter === "owner" && m.isOwner)
        )
          return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            ![m.fullName, m.email, m.phone, m.area].some((f) =>
              f?.toLowerCase().includes(q)
            )
          )
            return false;
        }
        return true;
      }),
    [members, roleFilter, searchQuery]
  );

  // Handlers
  const openAdd = () => {
    setForm({ fullName: "", email: "", phone: "", area: "", roles: ["sales" as const] });
    setIsAddOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditMember(m);
    setForm({
      fullName: m.fullName,
      email: m.email,
      phone: m.phone || "",
      area: m.area || "",
      roles: [...m.roles],
    });
  };

  const openAccess = (m: TeamMember) => {
    setAccessMember(m);
    setPassword("");
    setConfirmPwd("");
    setShowPwd(false);
    setShowConfirmPwd(false);
    setAccessSuccess(false);
  };

  const handleSave = async () => {
    if (!form.fullName || !form.email) return;
    setFormSaving(true);
    try {
      if (editMember) {
        await updateMember(editMember.id, {
          fullName: form.fullName,
          phone: form.phone,
          area: form.area,
          roles: form.roles,
        });
        toast({ title: "Updated", description: `${form.fullName} updated.` });
        setEditMember(null);
      } else {
        await addMember({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          area: form.area,
          roles: form.roles,
        });
        toast({
          title: "Employee added",
          description: "Use the key icon to grant login access.",
        });
        setIsAddOpen(false);
      }
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleActive = async (m: TeamMember) => {
    await updateMember(m.id, { isActive: !m.isActive });
    toast({ title: m.isActive ? "Deactivated" : "Activated" });
  };

  const handleDelete = async () => {
    if (!deleteMember) return;
    setDeleteSaving(true);
    try {
      await removeMember(deleteMember.id);
      toast({
        title: "Removed",
        description: `${deleteMember.fullName} removed from your team.`,
      });
      setDeleteMember(null);
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!accessMember || password.length < 6 || password !== confirmPwd) return;
    setAccessSaving(true);
    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      const res = await fetch("/api/auth/set-employee-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tenantId,
          email: accessMember.email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAccessSuccess(true);
      toast({ title: data.created ? "Access granted!" : "Password updated!" });
    } catch (e: unknown) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setAccessSaving(false);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-bold text-[#0A0A0A] flex items-center gap-2">
            Team
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded text-[11px] font-semibold bg-black/[0.06] text-[#3D3D3D]">
              {members.length}
            </span>
          </h1>
        </div>
        <Button
          onClick={openAdd}
          className="bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] gap-1.5"
        >
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      {/* 2. FILTER TABS + SEARCH */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                roleFilter === tab.value
                  ? "bg-[#0A0A0A] text-white"
                  : "text-[#8A8A8A] hover:text-[#0A0A0A]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8A8A8A]" />
          <Input
            placeholder="Search team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-sm border-black/[0.08]"
          />
        </div>
      </div>

      {/* 3. CONTENT */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold text-gray-900">
              No team members yet
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Add your first employee to get started.
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="bg-gray-900 text-white hover:bg-gray-800 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-gray-400 text-sm">
            No employees match your filters.
          </p>
          <button
            onClick={() => {
              setRoleFilter("all");
              setSearchQuery("");
            }}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <TableView
          members={filteredMembers}
          leadCountMap={leadCountMap}
          contractByEmployeeId={contractByEmployeeId}
          onEdit={openEdit}
          onAccess={openAccess}
          onDelete={(m) => setDeleteMember(m)}
          onToggleActive={handleToggleActive}
          onContract={(m) => setCreateContractMember(m)}
          onViewContract={(c) => setDetailContract(c)}
        />
      )}

      {/* 5. ADD / EDIT DRAWER */}
      <AddEditDrawer
        open={isAddOpen || !!editMember}
        isEdit={!!editMember}
        member={editMember}
        form={form}
        setForm={setForm}
        saving={formSaving}
        onSave={handleSave}
        onClose={() => {
          setIsAddOpen(false);
          setEditMember(null);
        }}
      />

      {/* 6. ACCESS MODAL */}
      <AccessModal
        member={accessMember}
        password={password}
        confirmPwd={confirmPwd}
        showPwd={showPwd}
        showConfirmPwd={showConfirmPwd}
        saving={accessSaving}
        success={accessSuccess}
        tenantDomain={
          typeof window !== "undefined" ? window.location.origin : ""
        }
        onGrant={handleGrantAccess}
        onClose={() => {
          setAccessMember(null);
          setPassword("");
          setConfirmPwd("");
          setAccessSuccess(false);
        }}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirmPwd}
        onTogglePwd={() => setShowPwd((v) => !v)}
        onToggleConfirmPwd={() => setShowConfirmPwd((v) => !v)}
      />

      {/* 7. DELETE DIALOG */}
      <DeleteDialog
        member={deleteMember}
        saving={deleteSaving}
        onDelete={handleDelete}
        onClose={() => setDeleteMember(null)}
      />

      {/* 8. CONTRACT DRAWERS */}
      {tenantId && (
        <>
          <CreateEmployeeContractDrawer
            open={!!createContractMember}
            onClose={() => setCreateContractMember(null)}
            tenantId={tenantId}
            partyAName={tenant?.name ?? ""}
            partyAEmail=""
            prefill={{
              employeeId:  createContractMember?.id,
              partyBName:  createContractMember?.fullName,
              partyBEmail: createContractMember?.email,
              partyBPhone: createContractMember?.phone,
              designation: createContractMember?.roles?.[0],
              joiningDate: createContractMember?.joinedAt,
              title: createContractMember?.fullName
                ? `Employment Agreement – ${createContractMember.fullName}`
                : undefined,
            }}
            onCreated={() => setCreateContractMember(null)}
          />
          <ContractDetailDrawer
            contract={detailContract}
            tenantId={tenantId}
            onClose={() => setDetailContract(null)}
            onUpdated={() => {}}
          />
        </>
      )}
    </div>
  );
}
