import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const tenantId = formData.get("tenantId") as string;
        const rawFolder = (formData.get("folder") as string) || "general";
        // sanitize folder path
        const folder = rawFolder.replace(/\.\./g, "").replace(/[^a-z0-9/_-]/gi, "").slice(0, 128) || "general";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        if (!tenantId) {
            return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ["image/", "application/pdf"];
        const isAllowed = allowedTypes.some(t => file.type.startsWith(t));
        if (!isAllowed) {
            return NextResponse.json({ error: "Only image and PDF files are allowed" }, { status: 400 });
        }

        // Generate a unique filename
        const extension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
        const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

        // Save to: public/uploads/[tenantId]/[folder]/[filename]
        const uploadDir = path.join(process.cwd(), "public", "uploads", tenantId, folder);
        await mkdir(uploadDir, { recursive: true });

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(path.join(uploadDir, filename), buffer);

        const url = `/uploads/${tenantId}/${folder}/${filename}`;
        return NextResponse.json({ url });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({
            error: "Internal server error",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
