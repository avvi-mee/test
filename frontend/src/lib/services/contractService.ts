import { getDb, getFirebaseStorage } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  collection,
  query,
  orderBy,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type {
  Contract,
  ContractActivityLog,
  ContractClause,
  ContractStats,
  ContractType,
} from "@/types/contracts";

// ── Contract Number ───────────────────────────────────────────────────────────
// Format: CON-YYYY-NNN  (year-aware counter, resets each year)
// Counter doc: tenants/{tenantId}/counters/contracts_{year}

export async function generateContractNumber(tenantId: string): Promise<string> {
  const db = getDb();
  const year = new Date().getFullYear();
  const counterRef = doc(db, `tenants/${tenantId}/counters/contracts_${year}`);

  const nextNum = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists() ? (snap.data()?.lastNumber ?? 0) : 0;
    const next = last + 1;
    tx.set(counterRef, { lastNumber: next, prefix: "CON", year }, { merge: true });
    return next;
  });

  return `CON-${year}-${String(nextNum).padStart(3, "0")}`;
}

// ── Sign Token ────────────────────────────────────────────────────────────────
// 32-char hex, 7-day expiry

export function generateSignToken(): { token: string; expiry: Date } {
  const array = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Server-side fallback (Node.js)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require("crypto");
    const buf = crypto.randomBytes(16);
    for (let i = 0; i < 16; i++) array[i] = buf[i];
  }
  const token = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return { token, expiry };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createContract(
  tenantId: string,
  data: Omit<Contract, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getDb();
  const docRef = await addDoc(collection(db, `tenants/${tenantId}/contracts`), {
    ...data,
    tenantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateContract(
  tenantId: string,
  contractId: string,
  updates: Partial<Omit<Contract, "id" | "tenantId" | "createdAt">>
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, `tenants/${tenantId}/contracts`, contractId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteContract(
  tenantId: string,
  contractId: string
): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, `tenants/${tenantId}/contracts`, contractId));
}

// ── Send For Signing ──────────────────────────────────────────────────────────
// Sets signToken + expiry + status='sent' + sentAt
// Also writes top-level contractTokenIndex/{token} = { tenantId, contractId }

export async function sendForSigning(
  tenantId: string,
  contractId: string
): Promise<string> {
  const db = getDb();
  const { token, expiry } = generateSignToken();

  await updateDoc(doc(db, `tenants/${tenantId}/contracts`, contractId), {
    signToken: token,
    signTokenExpiry: expiry.toISOString(),
    status: "sent",
    sentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Write top-level token index (public readable, needed by sign page)
  await setDoc(doc(db, "contractTokenIndex", token), {
    tenantId,
    contractId,
    createdAt: serverTimestamp(),
  });

  return token;
}

// ── Activity Log ──────────────────────────────────────────────────────────────

export async function logActivity(
  tenantId: string,
  contractId: string,
  entry: Omit<ContractActivityLog, "id" | "createdAt">
): Promise<void> {
  const db = getDb();
  await addDoc(
    collection(db, `tenants/${tenantId}/contracts/${contractId}/activityLog`),
    {
      ...entry,
      createdAt: serverTimestamp(),
    }
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function computeContractStats(contracts: Contract[]): ContractStats {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  let totalValue = 0;
  let expiring = 0;

  for (const c of contracts) {
    // Accumulate value from customFields
    const cf = c.customFields as any;
    if (cf?.totalValue) totalValue += cf.totalValue;
    else if (cf?.salary) totalValue += cf.salary;

    // Expiring: endDate within 30 days
    if (c.endDate && c.status === "active") {
      const endMs = new Date(c.endDate).getTime();
      if (endMs > now && endMs - now <= thirtyDays) expiring++;
    }
  }

  return {
    total: contracts.length,
    draft: contracts.filter((c) => c.status === "draft").length,
    active: contracts.filter((c) => c.status === "active").length,
    awaitingSignature: contracts.filter((c) => c.status === "sent" || c.status === "viewed").length,
    expiring,
    expired: contracts.filter((c) => c.status === "expired").length,
    terminated: contracts.filter((c) => c.status === "terminated").length,
    totalValue,
  };
}

// ── Get Contract By Token ─────────────────────────────────────────────────────
// Looks up contractTokenIndex/{token} → { tenantId, contractId }
// then fetches the contract doc

export async function getContractByToken(
  token: string
): Promise<{ contract: Contract; tenantId: string } | null> {
  const db = getDb();
  const indexSnap = await getDoc(doc(db, "contractTokenIndex", token));
  if (!indexSnap.exists()) return null;

  const { tenantId, contractId } = indexSnap.data() as {
    tenantId: string;
    contractId: string;
  };

  const contractSnap = await getDoc(
    doc(db, `tenants/${tenantId}/contracts`, contractId)
  );
  if (!contractSnap.exists()) return null;

  const contract: Contract = {
    id: contractSnap.id,
    ...(contractSnap.data() as Omit<Contract, "id">),
  };

  return { contract, tenantId };
}

// ── Record Signature ──────────────────────────────────────────────────────────

export async function recordSignature(
  tenantId: string,
  contractId: string,
  signatureDataUrl: string,
  ip: string
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, `tenants/${tenantId}/contracts`, contractId), {
    signedByPartyB: true,
    partyBSignature: signatureDataUrl,
    partyBSignedAt: serverTimestamp(),
    partyBSignedIP: ip,
    status: "signed",
    updatedAt: serverTimestamp(),
  });
  logActivity(tenantId, contractId, {
    action: "signed_party_b",
    summary: "Contract signed by Party B",
    actorId: "party_b",
  }).catch(console.error);
}

// ── Upload Contract PDF ───────────────────────────────────────────────────────
// Uploads PDF blob to Storage: contracts/{tenantId}/{contractId}/contract.pdf
// Returns download URL; updates contract with pdfUrl + pdfGeneratedAt

export async function uploadContractPdf(
  tenantId: string,
  contractId: string,
  pdfBlob: Blob
): Promise<string> {
  const storage = getFirebaseStorage();
  const storageRef = ref(
    storage,
    `contracts/${tenantId}/${contractId}/contract.pdf`
  );

  await uploadBytes(storageRef, pdfBlob, { contentType: "application/pdf" });
  const pdfUrl = await getDownloadURL(storageRef);

  await updateContract(tenantId, contractId, {
    pdfUrl,
    pdfGeneratedAt: serverTimestamp(),
  });

  return pdfUrl;
}

// ── Fetch Activity Log ────────────────────────────────────────────────────────

export async function fetchActivityLog(
  tenantId: string,
  contractId: string
): Promise<ContractActivityLog[]> {
  const db = getDb();
  const snap = await getDocs(
    query(
      collection(db, `tenants/${tenantId}/contracts/${contractId}/activityLog`),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ContractActivityLog, "id">),
  }));
}

// ── Clause Management ─────────────────────────────────────────────────────────

export async function updateClauses(
  tenantId: string,
  contractId: string,
  clauses: ContractClause[]
): Promise<void> {
  await updateContract(tenantId, contractId, { clauses });
  logActivity(tenantId, contractId, {
    action: "clauses_updated",
    summary: "Clauses updated",
    actorId: "admin",
  }).catch(console.error);
}

// ── Status Transitions ────────────────────────────────────────────────────────

export async function activateContract(
  tenantId: string,
  contractId: string
): Promise<void> {
  await updateContract(tenantId, contractId, { status: "active" });
  logActivity(tenantId, contractId, {
    action: "activated",
    summary: "Contract activated",
    actorId: "admin",
  }).catch(console.error);
}

export async function terminateContract(
  tenantId: string,
  contractId: string,
  reason: string
): Promise<void> {
  await updateContract(tenantId, contractId, { status: "terminated" });
  logActivity(tenantId, contractId, {
    action: "terminated",
    summary: `Contract terminated: ${reason}`,
    actorId: "admin",
  }).catch(console.error);
}

export async function renewContract(
  tenantId: string,
  contractId: string,
  newEndDate: string
): Promise<void> {
  await updateContract(tenantId, contractId, { status: "renewed", endDate: newEndDate });
  logActivity(tenantId, contractId, {
    action: "renewed",
    summary: `Contract renewed until ${newEndDate}`,
    actorId: "admin",
  }).catch(console.error);
}

// ── Template Persistence ──────────────────────────────────────────────────────

export async function saveTemplate(
  tenantId: string,
  type: ContractType,
  clauses: ContractClause[]
): Promise<void> {
  const db = getDb();
  await setDoc(
    doc(db, `tenants/${tenantId}/contractTemplates`, type),
    {
      tenantId,
      type,
      defaultClauses: clauses,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
