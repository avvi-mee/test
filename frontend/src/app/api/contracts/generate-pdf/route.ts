import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb, getAdminStorage } from "@/lib/firebaseAdmin";
import { buildContractPdf } from "@/lib/contracts/buildContractPdf";
import { rateLimit } from "@/lib/rateLimit";
import type { Contract } from "@/types/contracts";

export async function POST(req: NextRequest) {
  // Rate limit: 20 requests per minute per IP
  const rateLimitResponse = rateLimit(req, { max: 20, windowMs: 60_000, keyPrefix: "generate-pdf" });
  if (rateLimitResponse) return rateLimitResponse;

  // Auth
  const { user, response: authResponse } = await verifyAuth(req);
  if (authResponse) return authResponse;

  const body = await req.json();
  const { tenantId, contractId } = body as { tenantId?: string; contractId?: string };

  if (!tenantId || !contractId) {
    return NextResponse.json({ error: "tenantId and contractId are required" }, { status: 400 });
  }

  // Verify tenant membership
  const hasAccess = await verifyTenantAccess(user!.id, tenantId, user!.email);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Fetch contract
    const db = getAdminDb();
    const contractSnap = await db.doc(`tenants/${tenantId}/contracts/${contractId}`).get();
    if (!contractSnap.exists) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const contract: Contract = {
      id: contractSnap.id,
      ...(contractSnap.data() as Omit<Contract, "id">),
    };

    // Build PDF
    const pdf = buildContractPdf(contract);
    const buf = Buffer.from(pdf.output("arraybuffer"));

    // Upload to Storage
    const storage = getAdminStorage();
    const filePath = `contracts/${tenantId}/${contractId}/contract.pdf`;
    const fileRef = storage.bucket().file(filePath);

    await fileRef.save(buf, {
      metadata: { contentType: "application/pdf" },
    });

    // Get a long-lived signed URL
    const [pdfUrl] = await fileRef.getSignedUrl({
      action: "read",
      expires: "03-01-2500",
    });

    // Update Firestore
    const pdfGeneratedAt = new Date().toISOString();
    await db.doc(`tenants/${tenantId}/contracts/${contractId}`).update({
      pdfUrl,
      pdfGeneratedAt,
    });

    return NextResponse.json({ success: true, pdfUrl });
  } catch (err) {
    console.error("Error generating contract PDF:", err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
