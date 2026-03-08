import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyTenantAccess } from "@/lib/firestoreServer";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { FieldValue } from "firebase-admin/firestore";
import type { Contract } from "@/types/contracts";

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per minute per IP
  const rateLimitResponse = rateLimit(req, { max: 5, windowMs: 60_000, keyPrefix: "send-sign-email" });
  if (rateLimitResponse) return rateLimitResponse;

  // Auth
  const { user, response: authResponse } = await verifyAuth(req);
  if (authResponse) return authResponse;

  const body = await req.json();
  const { tenantId, contractId, token } = body as {
    tenantId?: string;
    contractId?: string;
    token?: string;
  };

  if (!tenantId || !contractId || !token) {
    return NextResponse.json(
      { error: "tenantId, contractId, and token are required" },
      { status: 400 }
    );
  }

  // Verify tenant membership
  const hasAccess = await verifyTenantAccess(user!.id, tenantId, user!.email);
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const contractSnap = await db.doc(`tenants/${tenantId}/contracts/${contractId}`).get();
    if (!contractSnap.exists) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const contract = contractSnap.data() as Contract;

    // Verify token matches and hasn't expired
    if (contract.signToken !== token) {
      return NextResponse.json({ error: "Invalid sign token" }, { status: 400 });
    }
    if (contract.signTokenExpiry) {
      const expiry = new Date(
        typeof contract.signTokenExpiry === "string"
          ? contract.signTokenExpiry
          : contract.signTokenExpiry?.toDate?.() ?? contract.signTokenExpiry
      );
      if (expiry < new Date()) {
        return NextResponse.json({ error: "Sign token has expired" }, { status: 400 });
      }
    }

    // Build signing URL
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${req.headers.get("host")}`;
    const signingUrl = `${appUrl}/sign/${token}`;

    // Send email via existing send-email route
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `https://${req.headers.get("host")}`;

    await fetch(`${baseUrl}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "contract_signing",
        to: contract.partyB.email,
        partyBName: contract.partyB.name,
        contractTitle: contract.title,
        contractNumber: contract.contractNumber,
        signingUrl,
        tenantBusinessName: contract.partyA.name,
      }),
    });

    // Log activity
    await db
      .collection(`tenants/${tenantId}/contracts/${contractId}/activityLog`)
      .add({
        action: "signing_email_sent",
        summary: `Signing email sent to ${contract.partyB.email}`,
        actorId: user!.id,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error sending signing email:", err);
    return NextResponse.json({ error: "Failed to send signing email" }, { status: 500 });
  }
}
