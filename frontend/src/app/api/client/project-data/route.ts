import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
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

    const db = getAdminDb();

    // 2. Find clientAccount by email (doc ID = uid, email field stored in doc)
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

    const { tenantId, projectId, name } = clientData;

    // 3. Parallel fetch: project, phases, files, invoices, queries
    const [projectDoc, phasesSnap, filesSnap, invoicesSnap, queriesSnap] = await Promise.all([
      db.doc(`tenants/${tenantId}/projects/${projectId}`).get(),
      db
        .collection(`tenants/${tenantId}/projects/${projectId}/phases`)
        .orderBy("order")
        .get(),
      db
        .collection(`tenants/${tenantId}/projects/${projectId}/files`)
        .where("visibleToClient", "==", true)
        .get(),
      db
        .collection(`tenants/${tenantId}/invoices`)
        .where("projectId", "==", projectId)
        .get(),
      db
        .collection(`tenants/${tenantId}/projects/${projectId}/queries`)
        .orderBy("createdAt", "desc")
        .get(),
    ]);

    if (!projectDoc.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = { id: projectDoc.id, ...projectDoc.data() };
    const phases = phasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const files = filesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const invoices = invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const queries = queriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 4. Resolve team members
    const teamData = (project as any).team || {};
    const designerIds: string[] = teamData.designerIds || [];
    const supervisorIds: string[] = teamData.supervisorIds || [];
    const pmIds: string[] = teamData.pmIds || [];

    const allMemberIds = [...new Set([...designerIds, ...supervisorIds, ...pmIds])];

    const employeeDocs = await Promise.all(
      allMemberIds.map((id) =>
        db.doc(`tenants/${tenantId}/employees/${id}`).get()
      )
    );

    const employeeMap: Record<string, { fullName: string; phone: string }> = {};
    employeeDocs.forEach((doc) => {
      if (doc.exists) {
        const d = doc.data()!;
        employeeMap[doc.id] = { fullName: d.fullName || "", phone: d.phone || "" };
      }
    });

    const team: {
      designer?: { fullName: string; phone: string };
      supervisor?: { fullName: string; phone: string };
      projectManager?: { fullName: string; phone: string };
    } = {};

    const firstDesignerId = designerIds[0];
    const firstSupervisorId = supervisorIds[0];
    const firstPmId = pmIds[0];

    if (firstDesignerId && employeeMap[firstDesignerId]) {
      team.designer = employeeMap[firstDesignerId];
    }
    if (firstSupervisorId && employeeMap[firstSupervisorId]) {
      team.supervisor = employeeMap[firstSupervisorId];
    }
    if (firstPmId && employeeMap[firstPmId]) {
      team.projectManager = employeeMap[firstPmId];
    }

    return NextResponse.json({
      clientAccount: {
        name: name || email,
        email,
        tenantId,
        projectId,
        authUid: uid,
      },
      project,
      phases,
      files,
      invoices,
      team,
      queries,
    });
  } catch (err) {
    console.error("Error fetching client project data:", err);
    return NextResponse.json(
      { error: "Failed to fetch project data" },
      { status: 500 }
    );
  }
}
