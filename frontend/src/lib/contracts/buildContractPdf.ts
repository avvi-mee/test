import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Contract, PaymentMilestone } from "@/types/contracts";
import { substituteAllClauses } from "./substituteVariables";

/**
 * Pure jsPDF builder — no uploads, no side-effects.
 * Works in both browser (client PDF download) and Node.js (server-side route).
 *
 * Variable tokens in clause bodies are substituted before rendering so the
 * generated PDF never shows raw `{partyBName}`-style placeholders.
 */
export function buildContractPdf(contract: Contract): jsPDF {
  const pdf = new jsPDF();
  const W = 196;
  const L = 14;

  // ── Page 1: Header ──────────────────────────────────────────────────────────
  pdf.setFontSize(18);
  pdf.setTextColor(15, 23, 42);
  pdf.text(contract.partyA.name || "Studio", 105, 20, { align: "center" });

  pdf.setDrawColor(200, 200, 200);
  pdf.line(L, 25, W, 25);

  pdf.setFontSize(13);
  pdf.setTextColor(60, 60, 60);
  pdf.text(contract.title, 105, 34, { align: "center" });

  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Contract No: ${contract.contractNumber}`, L, 42);
  pdf.text(`Type: ${contract.type.toUpperCase()}`, L, 47);
  pdf.text(
    `Status: ${contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}`,
    L,
    52
  );
  const today = new Date().toLocaleDateString("en-IN");
  pdf.text(`Date: ${today}`, L, 57);

  // ── Parties Table ───────────────────────────────────────────────────────────
  autoTable(pdf, {
    startY: 64,
    head: [["Party A (Studio)", "Party B (Counterparty)"]],
    body: [
      [
        `${contract.partyA.name}\n${contract.partyA.email || ""}${contract.partyA.phone ? "\n" + contract.partyA.phone : ""}`,
        `${contract.partyB.name}\n${contract.partyB.email || ""}${contract.partyB.phone ? "\n" + contract.partyB.phone : ""}`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { textColor: [60, 60, 60], fontSize: 9 },
    columnStyles: { 0: { cellWidth: 91 }, 1: { cellWidth: 91 } },
  });

  let currentY = (pdf as any).lastAutoTable.finalY + 10;

  // ── Contract Dates ──────────────────────────────────────────────────────────
  if (contract.startDate || contract.endDate) {
    const dateRows: [string, string][] = [];
    if (contract.startDate) dateRows.push(["Start Date", contract.startDate]);
    if (contract.endDate) dateRows.push(["End Date", contract.endDate]);
    autoTable(pdf, {
      startY: currentY,
      head: [["Field", "Value"]],
      body: dateRows,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 10;
  }

  // ── Clauses (with variable substitution) ───────────────────────────────────
  pdf.addPage();
  currentY = 14;

  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Terms & Conditions", L, currentY);
  currentY += 6;

  const substitutedClauses = substituteAllClauses(contract);

  if (substitutedClauses.length > 0) {
    autoTable(pdf, {
      startY: currentY,
      head: [["#", "Clause", "Terms"]],
      body: substitutedClauses.map((c) => [
        String(c.order),
        c.title,
        c.body,
      ]),
      theme: "striped",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { textColor: [60, 60, 60], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 127 },
      },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ── Custom Fields Table ─────────────────────────────────────────────────────
  const cf = contract.customFields as any;
  const cfRows: [string, string][] = [];

  if (contract.type === "client") {
    if (cf.projectName) cfRows.push(["Project Name", cf.projectName]);
    if (cf.totalValue) cfRows.push(["Total Value", `₹${Number(cf.totalValue).toLocaleString("en-IN")}`]);
    if (cf.completionDate) cfRows.push(["Completion Date", cf.completionDate]);
    if (cf.warrantyPeriodDays) cfRows.push(["Warranty Period", `${cf.warrantyPeriodDays} days`]);
  } else if (contract.type === "employee") {
    if (cf.designation) cfRows.push(["Designation", cf.designation]);
    if (cf.department) cfRows.push(["Department", cf.department]);
    if (cf.salary) cfRows.push(["Gross Salary", `₹${Number(cf.salary).toLocaleString("en-IN")}/month`]);
    if (cf.joiningDate) cfRows.push(["Joining Date", cf.joiningDate]);
    if (cf.probationDays) cfRows.push(["Probation", `${cf.probationDays} days`]);
    if (cf.noticePeriodDays) cfRows.push(["Notice Period", `${cf.noticePeriodDays} days`]);
  } else if (contract.type === "contractor") {
    if (cf.projectName) cfRows.push(["Project Name", cf.projectName]);
    if (cf.totalValue) cfRows.push(["Total Value", `₹${Number(cf.totalValue).toLocaleString("en-IN")}`]);
    if (cf.scopeOfWork) cfRows.push(["Scope of Work", cf.scopeOfWork]);
  } else if (contract.type === "vendor") {
    if (cf.vendorCategory) cfRows.push(["Category", cf.vendorCategory]);
    if (cf.creditPeriodDays) cfRows.push(["Credit Period", `${cf.creditPeriodDays} days`]);
    if (cf.discountPercent) cfRows.push(["Discount", `${cf.discountPercent}%`]);
    if (cf.deliveryTerms) cfRows.push(["Delivery Terms", cf.deliveryTerms]);
  }

  if (cfRows.length > 0) {
    if (currentY > 240) { pdf.addPage(); currentY = 14; }
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`${contract.type.charAt(0).toUpperCase() + contract.type.slice(1)} Details`, L, currentY);
    currentY += 5;
    autoTable(pdf, {
      startY: currentY,
      body: cfRows,
      theme: "striped",
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" }, 1: { cellWidth: 122 } },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ── Payment Schedule ────────────────────────────────────────────────────────
  const schedule: PaymentMilestone[] = cf?.paymentSchedule ?? [];
  if (schedule.length > 0) {
    if (currentY > 230) { pdf.addPage(); currentY = 14; }
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text("Payment Schedule", L, currentY);
    currentY += 5;
    autoTable(pdf, {
      startY: currentY,
      head: [["Milestone", "%", "Amount (₹)", "Due Date", "Paid"]],
      body: schedule.map((m) => [
        m.label,
        `${m.percentage}%`,
        Number(m.amount).toLocaleString("en-IN"),
        m.dueDate || "—",
        m.isPaid ? "Yes" : "No",
      ]),
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });
    currentY = (pdf as any).lastAutoTable.finalY + 12;
  }

  // ── Signature Section ───────────────────────────────────────────────────────
  if (currentY > 220) { pdf.addPage(); currentY = 14; }
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text("Signatures", L, currentY);
  currentY += 8;

  // Party A box
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(L, currentY, 85, 45);
  pdf.setFontSize(9);
  pdf.setTextColor(100, 100, 100);
  pdf.text("Party A (Studio)", L + 3, currentY + 6);
  pdf.text(contract.partyA.name, L + 3, currentY + 13);
  if (contract.partyASignature) {
    try {
      pdf.addImage(contract.partyASignature, "PNG", L + 3, currentY + 15, 60, 20);
    } catch {}
  } else {
    pdf.text("Signature: _______________", L + 3, currentY + 32);
  }
  if (contract.partyASignedAt) {
    const dt = contract.partyASignedAt?.toDate
      ? contract.partyASignedAt.toDate().toLocaleDateString("en-IN")
      : String(contract.partyASignedAt);
    pdf.text(`Date: ${dt}`, L + 3, currentY + 40);
  }

  // Party B box
  pdf.rect(L + 97, currentY, 85, 45);
  pdf.text("Party B (Counterparty)", L + 100, currentY + 6);
  pdf.text(contract.partyB.name, L + 100, currentY + 13);
  if (contract.partyBSignature) {
    try {
      pdf.addImage(contract.partyBSignature, "PNG", L + 100, currentY + 15, 60, 20);
    } catch {}
  } else {
    pdf.text("Signature: _______________", L + 100, currentY + 32);
  }
  if (contract.partyBSignedAt) {
    const dt = contract.partyBSignedAt?.toDate
      ? contract.partyBSignedAt.toDate().toLocaleDateString("en-IN")
      : String(contract.partyBSignedAt);
    pdf.text(`Date: ${dt}`, L + 100, currentY + 40);
  }

  // Footer on every page
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${contract.contractNumber} — Page ${i} of ${pageCount}`, 105, 290, { align: "center" });
  }

  return pdf;
}
