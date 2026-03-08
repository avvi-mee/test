"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  limit as firestoreLimit,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import {
  createContract as svcCreate,
  updateContract as svcUpdate,
  deleteContract as svcDelete,
  sendForSigning as svcSendForSigning,
  computeContractStats,
  fetchActivityLog as svcFetchActivityLog,
  updateClauses as svcUpdateClauses,
  activateContract as svcActivate,
  terminateContract as svcTerminate,
  renewContract as svcRenew,
  saveTemplate as svcSaveTemplate,
} from "@/lib/services/contractService";
import type {
  Contract,
  ContractClause,
  ContractStats,
  ContractActivityLog,
  ContractTemplate,
  ContractType,
} from "@/types/contracts";

export function useContracts(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["contracts", tenantId] as const;
  const tqk = ["contractTemplates", tenantId] as const;
  const db = getDb();

  // ── Real-time contracts listener ──────────────────────────────────────────

  const contractsQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/contracts`),
      orderBy("createdAt", "desc"),
      firestoreLimit(200)
    );
  }, [db, tenantId]);

  const { data: contracts = [], isLoading: loading } = useFirestoreQuery<Contract>({
    queryKey: qk,
    collectionRef: contractsQuery!,
    mapDoc: (snap) => ({
      id: snap.id,
      ...(snap.data() as Omit<Contract, "id">),
    }),
    enabled: !!tenantId && !!contractsQuery,
  });

  // ── Real-time templates listener ──────────────────────────────────────────

  const templatesQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/contractTemplates`)
    );
  }, [db, tenantId]);

  const { data: templates = [] } = useFirestoreQuery<ContractTemplate>({
    queryKey: tqk,
    collectionRef: templatesQuery!,
    mapDoc: (snap) => ({
      id: snap.id,
      ...(snap.data() as Omit<ContractTemplate, "id">),
    }),
    enabled: !!tenantId && !!templatesQuery,
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo<ContractStats>(
    () => computeContractStats(contracts),
    [contracts]
  );

  // ── Invalidation helper ───────────────────────────────────────────────────

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient]
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createContract = useCallback(
    async (data: Omit<Contract, "id" | "createdAt" | "updatedAt">) => {
      if (!tenantId) return null;
      try {
        const id = await svcCreate(tenantId, data);
        invalidate();
        return id;
      } catch (err) {
        console.error("Error creating contract:", err);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  const updateContract = useCallback(
    async (
      contractId: string,
      updates: Partial<Omit<Contract, "id" | "tenantId" | "createdAt">>
    ) => {
      if (!tenantId) return;
      try {
        await svcUpdate(tenantId, contractId, updates);
        invalidate();
      } catch (err) {
        console.error("Error updating contract:", err);
      }
    },
    [tenantId, invalidate]
  );

  const deleteContract = useCallback(
    async (contractId: string) => {
      if (!tenantId) return;
      try {
        await svcDelete(tenantId, contractId);
        invalidate();
      } catch (err) {
        console.error("Error deleting contract:", err);
      }
    },
    [tenantId, invalidate]
  );

  const sendForSigning = useCallback(
    async (contractId: string): Promise<string | null> => {
      if (!tenantId) return null;
      try {
        const token = await svcSendForSigning(tenantId, contractId);
        invalidate();
        return token;
      } catch (err) {
        console.error("Error sending for signing:", err);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  // ── One-shot activity log fetch ───────────────────────────────────────────

  const fetchActivityLog = useCallback(
    async (contractId: string): Promise<ContractActivityLog[]> => {
      if (!tenantId) return [];
      return svcFetchActivityLog(tenantId, contractId);
    },
    [tenantId]
  );

  // ── Clause mutations ──────────────────────────────────────────────────────

  const updateClauses = useCallback(
    async (contractId: string, clauses: ContractClause[]) => {
      if (!tenantId) return;
      try {
        await svcUpdateClauses(tenantId, contractId, clauses);
        invalidate();
      } catch (err) {
        console.error("Error updating clauses:", err);
      }
    },
    [tenantId, invalidate]
  );

  // ── Status transitions ────────────────────────────────────────────────────

  const activateContract = useCallback(
    async (contractId: string) => {
      if (!tenantId) return;
      try {
        await svcActivate(tenantId, contractId);
        invalidate();
      } catch (err) {
        console.error("Error activating contract:", err);
      }
    },
    [tenantId, invalidate]
  );

  const terminateContract = useCallback(
    async (contractId: string, reason: string) => {
      if (!tenantId) return;
      try {
        await svcTerminate(tenantId, contractId, reason);
        invalidate();
      } catch (err) {
        console.error("Error terminating contract:", err);
      }
    },
    [tenantId, invalidate]
  );

  const renewContract = useCallback(
    async (contractId: string, newEndDate: string) => {
      if (!tenantId) return;
      try {
        await svcRenew(tenantId, contractId, newEndDate);
        invalidate();
      } catch (err) {
        console.error("Error renewing contract:", err);
      }
    },
    [tenantId, invalidate]
  );

  // ── Template save ─────────────────────────────────────────────────────────

  const saveTemplate = useCallback(
    async (type: ContractType, clauses: ContractClause[]) => {
      if (!tenantId) return;
      try {
        await svcSaveTemplate(tenantId, type, clauses);
        queryClient.invalidateQueries({ queryKey: tqk });
      } catch (err) {
        console.error("Error saving template:", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenantId, queryClient]
  );

  // ── Auto-expiry checker (runs once per mount when contracts are loaded) ────

  const ranRef = useRef(false);
  useEffect(() => {
    if (!tenantId || contracts.length === 0 || ranRef.current) return;
    ranRef.current = true;
    const now = new Date();
    contracts
      .filter((c) => c.status === "active" && c.endDate && new Date(c.endDate) < now)
      .forEach((c) =>
        updateDoc(doc(db, `tenants/${tenantId}/contracts`, c.id), {
          status: "expired",
          updatedAt: serverTimestamp(),
        }).catch(console.error)
      );
  }, [contracts, tenantId, db]);

  return {
    contracts,
    stats,
    loading,
    templates,
    createContract,
    updateContract,
    deleteContract,
    sendForSigning,
    fetchActivityLog,
    updateClauses,
    activateContract,
    terminateContract,
    renewContract,
    saveTemplate,
  };
}
