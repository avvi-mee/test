"use client";

import { ChevronUp, ChevronDown, Lock, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ContractClause, ContractType } from "@/types/contracts";

interface ClausesEditorProps {
  clauses: ContractClause[];
  onChange: (clauses: ContractClause[]) => void;
  contractType?: ContractType;
  readOnly?: boolean;
  onResetToDefaults?: () => void;
}

export function ClausesEditor({
  clauses,
  onChange,
  readOnly = false,
  onResetToDefaults,
}: ClausesEditorProps) {
  const updateClause = (i: number, upd: Partial<ContractClause>) => {
    onChange(clauses.map((c, idx) => (idx === i ? { ...c, ...upd } : c)));
  };

  const moveClause = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= clauses.length) return;
    const arr = [...clauses];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    onChange(arr.map((c, idx) => ({ ...c, order: idx + 1 })));
  };

  const removeClause = (i: number) => {
    onChange(
      clauses
        .filter((_, idx) => idx !== i)
        .map((c, idx) => ({ ...c, order: idx + 1 }))
    );
  };

  const addCustomClause = () => {
    onChange([
      ...clauses,
      {
        order: clauses.length + 1,
        title: "Custom Clause",
        body: "",
        isRequired: false,
        isEditable: true,
      },
    ]);
  };

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Review and edit the standard clauses. Locked clauses cannot be removed.
        </p>
        {onResetToDefaults && !readOnly && (
          <button
            type="button"
            onClick={onResetToDefaults}
            className="text-[11px] text-gray-400 underline hover:text-gray-600"
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* Clause cards */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {clauses.map((clause, i) => (
          <div
            key={i}
            className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50/50"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-gray-400 w-5 shrink-0">
                {clause.order}.
              </span>
              <Input
                value={clause.title}
                onChange={(e) => updateClause(i, { title: e.target.value })}
                className="text-sm font-semibold flex-1"
                disabled={!clause.isEditable || readOnly}
              />
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveClause(i, -1)}
                    disabled={i === 0}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveClause(i, 1)}
                    disabled={i === clauses.length - 1}
                    className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {clause.isRequired ? (
                    <Lock className="h-3.5 w-3.5 text-gray-300" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeClause(i)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <textarea
              className="w-full min-h-[60px] px-2 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#4B56D2]/30 bg-white"
              value={clause.body}
              onChange={(e) => updateClause(i, { body: e.target.value })}
              disabled={!clause.isEditable || readOnly}
            />
          </div>
        ))}
      </div>

      {/* Add custom clause */}
      {!readOnly && (
        <button
          type="button"
          onClick={addCustomClause}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-[#4B56D2] border border-dashed border-[#4B56D2] rounded-lg py-2 hover:bg-[#EEF2FF] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add Custom Clause
        </button>
      )}
    </div>
  );
}
