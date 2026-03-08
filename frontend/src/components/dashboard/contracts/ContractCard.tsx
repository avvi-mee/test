"use client";

import { Eye, Send, Download, Trash2, Loader2, CheckCircle } from "lucide-react";
import { ContractStatusBadge } from "./ContractStatusBadge";
import type { Contract, ContractType } from "@/types/contracts";

const CONTRACT_TYPE_CONFIG: Record<ContractType, {
  label: string;
  topBorder: string;
  pill: string;
  icon: string;
}> = {
  client:     { label: "CLIENT",     topBorder: "border-t-[#4B56D2]", pill: "bg-[#EEF2FF] text-[#4B56D2]",   icon: "👤" },
  employee:   { label: "EMPLOYEE",   topBorder: "border-t-[#1A7A47]", pill: "bg-[#EDFBF3] text-[#1A7A47]",   icon: "👷" },
  contractor: { label: "CONTRACTOR", topBorder: "border-t-[#A0700A]", pill: "bg-[#FFF8E8] text-[#A0700A]",   icon: "🔧" },
  vendor:     { label: "VENDOR",     topBorder: "border-t-[#6B4FBB]", pill: "bg-[#F3F0FF] text-[#6B4FBB]",   icon: "📦" },
};

interface ContractCardProps {
  contract: Contract;
  onView: () => void;
  onSend: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onActivate?: () => void;
  sending: boolean;
}

export function ContractCard({
  contract,
  onView,
  onSend,
  onDownload,
  onDelete,
  onActivate,
  sending,
}: ContractCardProps) {
  const typeConf = CONTRACT_TYPE_CONFIG[contract.type];
  const cf = contract.customFields as any;

  // Type-specific meta
  let metaLine: string | null = null;
  if (contract.type === "client" && cf?.totalValue) {
    metaLine = `₹${Number(cf.totalValue).toLocaleString("en-IN")}`;
  } else if (contract.type === "employee" && cf?.salary) {
    metaLine = `Salary: ₹${Number(cf.salary).toLocaleString("en-IN")}/mo`;
  } else if (contract.type === "contractor") {
    const parts: string[] = [];
    if (cf?.totalValue) parts.push(`Fee: ₹${Number(cf.totalValue).toLocaleString("en-IN")}`);
    if (contract.endDate) parts.push(`Ends: ${contract.endDate}`);
    if (parts.length) metaLine = parts.join(" · ");
  } else if (contract.type === "vendor") {
    metaLine = contract.endDate ? `Expires: ${contract.endDate}` : "Expires: —";
  }

  return (
    <div
      className={`group relative bg-white rounded-[14px] border border-t-[2px] border-[rgba(0,0,0,0.08)] overflow-hidden hover:border-[rgba(0,0,0,0.16)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all duration-200 ${typeConf.topBorder}`}
    >
      <div className="px-4 pt-4 pb-12">
        {/* Type + Number */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${typeConf.pill}`}>
            {typeConf.icon} {typeConf.label}
          </span>
          <span className="text-[11px] font-mono text-[#8A8A8A]">{contract.contractNumber}</span>
        </div>

        {/* Title */}
        <h3 className="font-bold text-[#0A0A0A] text-[14px] leading-snug mb-1.5 truncate">
          {contract.title}
        </h3>

        {/* Party B */}
        <p className="text-[12px] text-[#3D3D3D] font-medium truncate">{contract.partyB.name}</p>
        <p className="text-[11px] text-[#8A8A8A] truncate mb-2">{contract.partyB.email}</p>

        {/* Status badge + meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <ContractStatusBadge status={contract.status} />
          {metaLine && (
            <span className="text-[11px] text-[#8A8A8A] truncate">{metaLine}</span>
          )}
        </div>

        {/* Dates (client & employee may not show end date from meta) */}
        {contract.type !== "contractor" && contract.type !== "vendor" && (contract.startDate || contract.endDate) && (
          <p className="text-[10px] text-[#8A8A8A] mt-1.5">
            {contract.startDate && <span>{contract.startDate}</span>}
            {contract.startDate && contract.endDate && <span className="mx-1">→</span>}
            {contract.endDate && <span>{contract.endDate}</span>}
          </p>
        )}
      </div>

      {/* Hover action bar */}
      <div className="absolute bottom-0 left-0 right-0 flex border-t border-black/[0.06] bg-white/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onView}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-[#3D3D3D] hover:bg-black/[0.03] transition-colors"
        >
          <Eye className="h-3.5 w-3.5" /> View
        </button>
        {contract.status === "signed" && onActivate ? (
          <button
            onClick={onActivate}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-[#1A7A47] hover:bg-[#EDFBF3] transition-colors border-x border-black/[0.06]"
          >
            <CheckCircle className="h-3.5 w-3.5" /> Activate
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={sending || contract.status === "signed" || contract.status === "active"}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-[#1D6FA4] hover:bg-[#E8F4FD] transition-colors border-x border-black/[0.06] disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {sending ? "Sending..." : "Send"}
          </button>
        )}
        <button
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-[#6B4FBB] hover:bg-[#F3F0FF] transition-colors border-r border-black/[0.06]"
        >
          <Download className="h-3.5 w-3.5" /> PDF
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-[#B83232] hover:bg-[#FFF0F0] transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
