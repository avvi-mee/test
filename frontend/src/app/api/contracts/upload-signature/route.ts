import { NextRequest, NextResponse } from "next/server";
import { getAdminStorage, getAdminAuth } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      await getAdminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { tenantId, contractId, dataUrl, filename = "signature-partyB.png" } = await req.json();

    if (!tenantId || !contractId || !dataUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Strip base64 header (e.g. "data:image/png;base64,")
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const filePath = `contracts/${tenantId}/${contractId}/${filename}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: { contentType: "image/png" },
      resumable: false,
    });

    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("Error uploading signature:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
