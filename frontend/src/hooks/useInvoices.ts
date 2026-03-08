"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import {
  type Invoice,
  type Payment,
  mapRowToInvoice,
  createInvoice as createInvoiceSvc,
  updateInvoice,
  addPaymentToInvoice,
} from "@/lib/services/invoiceService";

export type { Invoice };

export function useInvoices(
  tenantId: string | null,
  projectId?: string | null
) {
  const queryClient = useQueryClient();
  const qk = ["invoices", tenantId, projectId ?? null] as const;
  const db = getDb();

  const invoicesQuery = useMemo(() => {
    if (!tenantId) return null;
    const col = collection(db, `tenants/${tenantId}/invoices`);
    if (projectId) {
      return query(col, where("projectId", "==", projectId), orderBy("createdAt", "desc"));
    }
    return query(col, orderBy("createdAt", "desc"));
  }, [db, tenantId, projectId]);

  const { data: invoices = [], isLoading: loading } = useFirestoreQuery<Invoice>({
    queryKey: qk,
    collectionRef: invoicesQuery!,
    mapDoc: (snap) => mapRowToInvoice(snap.id, snap.data() || {}),
    enabled: !!tenantId && !!invoicesQuery,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  const createInvoice = useCallback(
    async (data: Parameters<typeof createInvoiceSvc>[1]): Promise<string | null> => {
      if (!tenantId) return null;
      try {
        const id = await createInvoiceSvc(tenantId, data);
        invalidate();
        return id;
      } catch (err) {
        console.error("Error creating invoice:", err);
        return null;
      }
    },
    [tenantId, invalidate]
  );

  const updateInvoiceStatus = useCallback(
    async (invoiceId: string, status: Invoice["status"]): Promise<boolean> => {
      if (!tenantId) return false;
      try {
        await updateInvoice(tenantId, invoiceId, { status });
        invalidate();
        return true;
      } catch (err) {
        console.error("Error updating invoice status:", err);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  const recordPayment = useCallback(
    async (
      invoiceId: string,
      payment: {
        amount: number;
        paidOn: Date;
        method: Payment["method"];
        reference?: string;
        createdBy?: string;
      }
    ): Promise<boolean> => {
      if (!tenantId) return false;
      try {
        await addPaymentToInvoice(tenantId, invoiceId, payment);
        invalidate();
        return true;
      } catch (err) {
        console.error("Error recording invoice payment:", err);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  return { invoices, loading, createInvoice, updateInvoiceStatus, recordPayment };
}
