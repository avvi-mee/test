"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  getContractByToken,
  recordSignature,
  updateContract,
} from "@/lib/services/contractService";
import { serverTimestamp } from "firebase/firestore";
import type { Contract, PaymentMilestone } from "@/types/contracts";
import { CheckCircle, AlertTriangle, Clock, Loader2 } from "lucide-react";

// ── Signature Pad ─────────────────────────────────────────────────────────────

function SignaturePad({
  onSign,
  disabled,
}: {
  onSign: (dataUrl: string) => void;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#0A0A0A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const getPos = (e: MouseEvent | Touch) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "clientX" in e ? e.clientX : (e as Touch).clientX;
      const clientY = "clientY" in e ? e.clientY : (e as Touch).clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawing.current = true;
      const pos = getPos("touches" in e ? (e as TouchEvent).touches[0] : (e as MouseEvent));
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pos = getPos("touches" in e ? (e as TouchEvent).touches[0] : (e as MouseEvent));
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasDrawn(true);
    };
    const end = () => { drawing.current = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const confirmSign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSign(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={560}
          height={140}
          className="w-full touch-none cursor-crosshair"
          style={{ display: "block" }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex-1 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={confirmSign}
          disabled={!hasDrawn || disabled}
          className="flex-1 py-2.5 text-sm font-semibold bg-[#0A0A0A] text-white rounded-xl hover:bg-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {disabled ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Signing...
            </span>
          ) : "Confirm & Sign"}
        </button>
      </div>
    </div>
  );
}

// ── Contract Display ──────────────────────────────────────────────────────────

function ContractDisplay({ contract }: { contract: Contract }) {
  const cf = contract.customFields as any;
  const schedule: PaymentMilestone[] = cf?.paymentSchedule ?? [];

  return (
    <div className="space-y-6">
      {/* Parties */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Party A", party: contract.partyA },
          { label: "Party B (You)", party: contract.partyB },
        ].map(({ label, party }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className="font-semibold text-gray-900">{party.name}</p>
            <p className="text-sm text-gray-500">{party.email}</p>
            {party.phone && <p className="text-sm text-gray-500">{party.phone}</p>}
          </div>
        ))}
      </div>

      {/* Dates */}
      {(contract.startDate || contract.endDate) && (
        <div className="flex gap-4 text-sm text-gray-600">
          {contract.startDate && <span>Start: <strong>{contract.startDate}</strong></span>}
          {contract.endDate && <span>End: <strong>{contract.endDate}</strong></span>}
        </div>
      )}

      {/* Custom Fields Summary */}
      {(cf?.totalValue || cf?.salary || cf?.designation) && (
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Key Terms</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {cf.totalValue && <><span className="text-gray-500">Total Value</span><span className="font-medium">₹{Number(cf.totalValue).toLocaleString("en-IN")}</span></>}
            {cf.salary && <><span className="text-gray-500">Salary</span><span className="font-medium">₹{Number(cf.salary).toLocaleString("en-IN")}/mo</span></>}
            {cf.designation && <><span className="text-gray-500">Designation</span><span className="font-medium">{cf.designation}</span></>}
            {cf.projectName && <><span className="text-gray-500">Project</span><span className="font-medium">{cf.projectName}</span></>}
            {cf.joiningDate && <><span className="text-gray-500">Joining Date</span><span className="font-medium">{cf.joiningDate}</span></>}
            {cf.noticePeriodDays && <><span className="text-gray-500">Notice Period</span><span className="font-medium">{cf.noticePeriodDays} days</span></>}
          </div>
        </div>
      )}

      {/* Payment Schedule */}
      {schedule.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Payment Schedule</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs">Milestone</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs">Amount</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((m, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-3 py-2.5 text-gray-700">{m.label} ({m.percentage}%)</td>
                    <td className="px-3 py-2.5 text-right font-medium">₹{Number(m.amount).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clauses */}
      {contract.clauses && contract.clauses.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Terms & Conditions</p>
          {contract.clauses.map((clause, i) => (
            <div key={i} className="border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1.5">
                {clause.order}. {clause.title}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">{clause.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type PageState = "loading" | "invalid" | "expired" | "already-signed" | "signing" | "success";

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [contract, setContract] = useState<Contract | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }

    getContractByToken(token).then((result) => {
      if (!result) { setState("invalid"); return; }

      const { contract: c, tenantId: tid } = result;
      setContract(c);
      setTenantId(tid);

      // Check expiry
      const expiry = c.signTokenExpiry
        ? (typeof c.signTokenExpiry === "string"
          ? new Date(c.signTokenExpiry)
          : c.signTokenExpiry?.toDate?.() ?? new Date(c.signTokenExpiry))
        : null;
      if (expiry && expiry < new Date()) { setState("expired"); return; }

      // Check already signed
      if (c.signedByPartyB) { setState("already-signed"); return; }

      // Mark as viewed
      if (!c.viewedAt) {
        updateContract(tid, c.id, { viewedAt: serverTimestamp(), status: "viewed" }).catch(() => {});
      }

      setState("signing");
    }).catch(() => setState("invalid"));
  }, [token]);

  const handleSign = async (dataUrl: string) => {
    if (!contract || !tenantId || !agreed) return;
    setSigning(true);
    try {
      // Get IP from server headers (avoids third-party dependency)
      const ip = await fetch("/api/get-ip")
        .then((r) => r.json())
        .then((d) => d.ip)
        .catch(() => "unknown");

      // Upload signature image to Firebase Storage (avoids Firestore 1MB limit)
      let signatureUrl = dataUrl;
      try {
        const uploadRes = await fetch("/api/contracts/upload-signature", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, contractId: contract.id, token, dataUrl }),
        });
        if (uploadRes.ok) {
          const { url } = await uploadRes.json();
          if (url) signatureUrl = url;
        }
      } catch {
        // fall back to storing dataUrl if upload fails
      }

      await recordSignature(tenantId, contract.id, signatureUrl, ip);

      // Fire-and-forget: notify studio
      fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "contract_signed",
          contractTitle: contract.title,
          contractNumber: contract.contractNumber,
          partyBName: contract.partyB.name,
          signedAt: new Date().toISOString(),
        }),
      }).catch(() => {});

      setState("success");
    } catch {
      setSigning(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-[#F4F4F1] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#4B56D2]" />
      </div>
    );
  }

  // ── Invalid ───────────────────────────────────────────────────────────────
  if (state === "invalid") {
    return (
      <div className="min-h-screen bg-[#F4F4F1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h2>
          <p className="text-sm text-gray-500">
            This signing link is invalid or has been revoked.
          </p>
        </div>
      </div>
    );
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (state === "expired") {
    return (
      <div className="min-h-screen bg-[#F4F4F1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-sm text-gray-500">
            This signing link has expired. Please contact the studio to request a new link.
          </p>
        </div>
      </div>
    );
  }

  // ── Already Signed ────────────────────────────────────────────────────────
  if (state === "already-signed") {
    return (
      <div className="min-h-screen bg-[#F4F4F1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Already Signed</h2>
          <p className="text-sm text-gray-500">
            This contract has already been signed. Thank you!
          </p>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="min-h-screen bg-[#F4F4F1] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Contract Signed!</h2>
          <p className="text-sm text-gray-500">
            Thank you, <strong>{contract?.partyB.name}</strong>. Your signature has been recorded
            and the studio has been notified.
          </p>
          <div className="mt-4 bg-gray-50 rounded-xl p-3 text-left">
            <p className="text-xs text-gray-400 mb-1">Contract</p>
            <p className="text-sm font-semibold text-gray-800">{contract?.title}</p>
            <p className="text-xs font-mono text-gray-400">{contract?.contractNumber}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Signing ───────────────────────────────────────────────────────────────
  if (!contract) return null;

  return (
    <div className="min-h-screen bg-[#F4F4F1] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Studio Header */}
        <div className="text-center">
          <div className="h-10 w-10 rounded-xl bg-[#0A0A0A] flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-base">
              {contract.partyA.name?.charAt(0) ?? "S"}
            </span>
          </div>
          <h1 className="font-bold text-xl text-[#0A0A0A]">{contract.partyA.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Interior Studio</p>
        </div>

        {/* Contract Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Contract header */}
          <div className="bg-[#0A0A0A] px-6 py-5">
            <p className="text-[11px] font-mono text-white/40 mb-1">{contract.contractNumber}</p>
            <h2 className="text-xl font-bold text-white">{contract.title}</h2>
            <p className="text-sm text-white/50 mt-1 capitalize">{contract.type} Agreement</p>
          </div>

          <div className="p-6">
            <ContractDisplay contract={contract} />
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-bold text-gray-900">Sign This Contract</h3>
          <p className="text-sm text-gray-500">
            By signing, you agree to all the terms and conditions stated above.
          </p>

          <SignaturePad onSign={handleSign} disabled={signing || !agreed} />

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#4B56D2] focus:ring-[#4B56D2]"
            />
            <span className="text-sm text-gray-600">
              I, <strong>{contract.partyB.name}</strong>, agree to all the terms and conditions
              of this contract and confirm that my digital signature above is legally binding.
            </span>
          </label>

          {!agreed && (
            <p className="text-[12px] text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Please check the "I agree" box before signing.
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 pb-4">
          Secured by UNMATRIX · Digital signature is legally binding.
        </p>
      </div>
    </div>
  );
}
