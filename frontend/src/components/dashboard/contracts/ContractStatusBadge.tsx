"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, Check } from "lucide-react";
import type { ContractStatus } from "@/types/contracts";

const STATUS_CONFIG: Record<
  ContractStatus,
  { bg: string; text: string; dot?: "pulse" | "solid"; icon?: "check" | "warn"; lineThrough?: boolean }
> = {
  draft:      { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]" },
  sent:       { bg: "bg-[#E8F4FD]", text: "text-[#1D6FA4]", dot: "pulse" },
  viewed:     { bg: "bg-[#FFF8E8]", text: "text-[#A0700A]" },
  signed:     { bg: "bg-[#EEF2FF]", text: "text-[#4B56D2]", icon: "check" },
  active:     { bg: "bg-[#EDFBF3]", text: "text-[#1A7A47]", dot: "solid" },
  expired:    { bg: "bg-[#FFF0F0]", text: "text-[#B83232]" },
  completed:  { bg: "bg-[#EDFBF3]", text: "text-[#1A7A47]" },
  terminated: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", lineThrough: true },
  renewed:    { bg: "bg-[#EDFBF3]", text: "text-[#1A7A47]" },
};

interface ContractStatusBadgeProps {
  status: ContractStatus;
  showDot?: boolean;
  className?: string;
}

export function ContractStatusBadge({ status, showDot = true, className }: ContractStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
        config.bg,
        config.text,
        className
      )}
    >
      {/* Dot indicators */}
      {showDot && config.dot === "pulse" && (
        <span className={cn("h-1.5 w-1.5 rounded-full bg-current animate-pulse")} />
      )}
      {showDot && config.dot === "solid" && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}

      {/* Icon indicators */}
      {config.icon === "check" && <Check className="h-3 w-3" />}
      {config.icon === "warn" && <AlertTriangle className="h-3 w-3" />}

      <span className={cn(config.lineThrough && "line-through")}>{label}</span>
    </span>
  );
}
