import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Bearer idToken
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const idToken = authHeader.slice(7);

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const { uid, email } = decoded;

    if (!email) {
      return NextResponse.json({ error: "Token has no email" }, { status: 401 });
    }

    // 2. Parse and validate body
    const body = await req.json();
    const message: string = body?.message ?? "";

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Message must be 2000 characters or fewer" },
        { status: 400 }
      );
    }

    const db = getAdminDb();

    // 3. Find clientAccount
    const clientSnap = await db
      .collectionGroup("clientAccounts")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (clientSnap.empty) {
      return NextResponse.json({ error: "No client account found" }, { status: 403 });
    }

    const clientData = clientSnap.docs[0].data();
    if (!clientData.isActive) {
      return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
    }

    const { tenantId, projectId, name: clientName } = clientData;

    // 4. Write query document
    const queryRef = db
      .collection(`tenants/${tenantId}/projects/${projectId}/queries`)
      .doc();

    await queryRef.set({
      clientName: clientName || email,
      clientEmail: email,
      clientAuthUid: uid,
      message: message.trim(),
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, queryId: queryRef.id });
  } catch (err) {
    console.error("Error raising client query:", err);
    return NextResponse.json(
      { error: "Failed to raise query" },
      { status: 500 }
    );
  }
}
