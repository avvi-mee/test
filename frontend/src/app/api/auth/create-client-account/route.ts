import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, projectId, clientEmail, clientName } = await req.json();

    if (!tenantId || !projectId || !clientEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const db   = getAdminDb();

    let uid: string;
    let isNew = false;
    let tempPassword: string | null = null;

    // 1. Try to get existing user, create if not found
    try {
      const existing = await auth.getUserByEmail(clientEmail);
      uid = existing.uid;
      // Send password reset link so they can log in
      await auth.generatePasswordResetLink(clientEmail);
    } catch {
      // User does not exist — create with a random temp password
      tempPassword = Math.random().toString(36).slice(-8) + "X1!";
      const newUser = await auth.createUser({
        email: clientEmail,
        displayName: clientName || clientEmail,
        password: tempPassword,
        emailVerified: false,
      });
      uid = newUser.uid;
      isNew = true;
    }

    // 2. Create/update clientAccounts doc
    await db
      .collection(`tenants/${tenantId}/clientAccounts`)
      .doc(uid)
      .set({
        email: clientEmail,
        name: clientName || clientEmail,
        projectId,
        tenantId,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true });

    // 3. Update project with clientAccessEmail
    await db
      .collection(`tenants/${tenantId}/projects`)
      .doc(projectId)
      .update({
        clientAccessEmail: clientEmail,
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true, uid, isNew, tempPassword });
  } catch (err) {
    console.error("Error creating client account:", err);
    return NextResponse.json({ error: "Failed to create client account" }, { status: 500 });
  }
}
