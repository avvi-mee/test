import { uploadContractPdf } from "@/lib/services/contractService";
import { buildContractPdf } from "@/lib/contracts/buildContractPdf";
import type { Contract } from "@/types/contracts";

export async function generateContractPdf(
  contract: Contract,
  options: { download?: boolean; uploadToStorage?: boolean; tenantId: string }
): Promise<{ success: boolean; pdfUrl?: string }> {
  try {
    const pdf = buildContractPdf(contract);

    const filename = `${contract.contractNumber.replace(/-/g, "_")}_${contract.partyB.name.replace(/\s+/g, "_")}.pdf`;

    let pdfUrl: string | undefined;

    if (options.uploadToStorage) {
      try {
        const pdfBlob = pdf.output("blob");
        pdfUrl = await uploadContractPdf(options.tenantId, contract.id, pdfBlob);
      } catch (e) {
        console.error("Error uploading contract PDF:", e);
      }
    }

    if (options.download) {
      pdf.save(filename);
    }

    return { success: true, pdfUrl };
  } catch (error) {
    console.error("Error generating contract PDF:", error);
    throw error;
  }
}
