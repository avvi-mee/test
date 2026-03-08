import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getFirebaseAuth } from "@/lib/firebase";
import type { Invoice, InvoiceLineItem } from "@/lib/services/invoiceService";

function formatRupees(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: any): string {
  if (!d) return "";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export interface GenerateInvoicePdfOptions {
  download?: boolean;
  uploadToStorage?: boolean;
  tenantId?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyGst?: string;
}

export async function generateInvoicePdf(
  invoice: Invoice,
  options: GenerateInvoicePdfOptions = { download: true }
): Promise<{ success: boolean; pdfUrl?: string; blob?: Blob }> {
  const {
    companyName = "Interior Design Studio",
    companyAddress = "",
    companyPhone = "",
    companyEmail = "",
    companyGst = "",
    download = true,
    uploadToStorage = false,
    tenantId,
  } = options;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 14;

  // ── Header ─────────────────────────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageWidth, 32, "F");

  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text(companyName, margin, 14);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(180, 190, 210);
  const headerLines: string[] = [];
  if (companyAddress) headerLines.push(companyAddress);
  if (companyPhone) headerLines.push(`Phone: ${companyPhone}`);
  if (companyEmail) headerLines.push(`Email: ${companyEmail}`);
  if (companyGst) headerLines.push(`GST: ${companyGst}`);
  headerLines.forEach((line, i) => pdf.text(line, margin, 21 + i * 4));

  // ── INVOICE label ───────────────────────────────────────────────────────────
  pdf.setFontSize(22);
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.text("INVOICE", pageWidth - margin, 44, { align: "right" });

  // ── Invoice meta ────────────────────────────────────────────────────────────
  const typeLabel = invoice.type
    ? invoice.type.charAt(0).toUpperCase() + invoice.type.slice(1) + " Invoice"
    : "Invoice";

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 90);

  const metaLeft = margin;
  const metaRight = pageWidth - margin;
  let y = 50;

  pdf.text(`Invoice No:`, metaLeft, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(invoice.invoiceNumber, metaLeft + 28, y);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 90);
  pdf.text("Type:", metaRight - 55, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(typeLabel, metaRight - 55 + 15, y);

  y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 90);
  pdf.text("Date:", metaLeft, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatDate(invoice.createdAt), metaLeft + 28, y);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 90);
  pdf.text("Due Date:", metaRight - 55, y);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(formatDate(invoice.dueDate), metaRight - 55 + 22, y);

  // ── Bill To ─────────────────────────────────────────────────────────────────
  y += 10;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(100, 100, 120);
  pdf.text("BILL TO", metaLeft, y);

  y += 5;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(invoice.clientName, metaLeft, y);

  // ── Divider ─────────────────────────────────────────────────────────────────
  y += 6;
  pdf.setDrawColor(220, 220, 230);
  pdf.line(metaLeft, y, pageWidth - metaLeft, y);
  y += 4;

  // ── Line Items Table ────────────────────────────────────────────────────────
  const lineItems: InvoiceLineItem[] = invoice.lineItems && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [{ description: invoice.description || "Interior Design Services", quantity: 1, unitRate: invoice.amount, amount: invoice.amount }];

  const tableBody = lineItems.map((item, i) => [
    String(i + 1),
    item.description,
    item.unit || "nos",
    String(item.quantity),
    formatRupees(item.unitRate),
    formatRupees(item.amount),
  ]);

  autoTable(pdf, {
    startY: y,
    head: [["#", "Description", "Unit", "Qty", "Rate", "Amount"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [40, 40, 50],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { halign: "center", cellWidth: 18 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "right", cellWidth: 32 },
      5: { halign: "right", cellWidth: 32 },
    },
    margin: { left: margin, right: margin },
  });

  let finalY: number = (pdf as any).lastAutoTable.finalY + 6;

  // ── Totals ──────────────────────────────────────────────────────────────────
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstPercent = invoice.gstPercent ?? 0;
  const gstAmount = invoice.gstAmount ?? (subtotal * gstPercent) / 100;
  const total = invoice.amount;

  const totalsX = pageWidth - margin - 80;

  const addTotalRow = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(bold ? 15 : 80, bold ? 23 : 80, bold ? 42 : 90);
    pdf.text(label, totalsX, finalY);
    pdf.text(value, pageWidth - margin, finalY, { align: "right" });
    finalY += 6;
  };

  addTotalRow("Subtotal:", formatRupees(subtotal));
  if (gstPercent > 0) {
    addTotalRow(`GST (${gstPercent}%):`, formatRupees(gstAmount));
  }

  // Total box
  pdf.setFillColor(15, 23, 42);
  pdf.roundedRect(totalsX - 4, finalY - 3, pageWidth - margin - totalsX + 8, 10, 1.5, 1.5, "F");
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("Total:", totalsX, finalY + 4);
  pdf.text(formatRupees(total), pageWidth - margin, finalY + 4, { align: "right" });
  finalY += 14;

  // ── Status & Payment info ───────────────────────────────────────────────────
  const statusColors: Record<string, [number, number, number]> = {
    paid: [26, 122, 71],
    sent: [29, 111, 164],
    partial: [160, 112, 10],
    overdue: [184, 50, 50],
    draft: [100, 100, 120],
  };
  const sc = statusColors[invoice.status] ?? [100, 100, 120];
  pdf.setFillColor(...sc);
  pdf.roundedRect(margin, finalY, 32, 8, 1.5, 1.5, "F");
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text(invoice.status.toUpperCase(), margin + 16, finalY + 5.5, { align: "center" });

  // ── Footer ──────────────────────────────────────────────────────────────────
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 150, 160);
  pdf.text("Thank you for your business.", 105, 282, { align: "center" });
  pdf.text(`Generated by ${companyName}`, 105, 287, { align: "center" });

  // ── Upload / Download ────────────────────────────────────────────────────────
  let pdfUrl: string | undefined;

  if (uploadToStorage && tenantId) {
    try {
      const pdfBlob = pdf.output("blob");
      const pdfFile = new File([pdfBlob], `${invoice.invoiceNumber}.pdf`, { type: "application/pdf" });
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("tenantId", tenantId);
      formData.append("folder", "invoices");

      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        pdfUrl = data.url;
      }
    } catch (err) {
      console.error("Invoice PDF upload error:", err);
    }
  }

  if (download) {
    pdf.save(`${invoice.invoiceNumber}.pdf`);
  }

  const blob = pdf.output("blob");
  return { success: true, pdfUrl, blob };
}
