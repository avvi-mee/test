"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  doc,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { addPaymentToVendorBill, type VendorPayment } from "@/lib/services/vendorBillService";

export interface Vendor {
  id: string;
  tenantId: string;
  name: string;
  category: "Materials" | "Labour" | "Equipment" | "Other";
  phone: string;
  email: string;
  gstNumber?: string;
  address?: string;
  creditDays: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  createdAt: any;
  updatedAt?: any;
}

export type VendorInput = Omit<Vendor, "id" | "tenantId" | "totalBilled" | "totalPaid" | "outstanding" | "createdAt" | "updatedAt">;

function mapDocToVendor(id: string, data: any): Vendor {
  const totalBilled = Number(data.totalBilled) || 0;
  const totalPaid = Number(data.totalPaid) || 0;
  return {
    id,
    tenantId: data.tenantId ?? "",
    name: data.name ?? "",
    category: data.category ?? "Other",
    phone: data.phone ?? "",
    email: data.email ?? "",
    gstNumber: data.gstNumber ?? undefined,
    address: data.address ?? undefined,
    creditDays: Number(data.creditDays) || 30,
    totalBilled,
    totalPaid,
    outstanding: totalBilled - totalPaid,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? undefined,
  };
}

export function useVendors(tenantId: string | null) {
  const queryClient = useQueryClient();
  const qk = ["vendors", tenantId] as const;
  const db = getDb();

  const vendorsQuery = useMemo(() => {
    if (!tenantId) return null;
    return query(
      collection(db, `tenants/${tenantId}/vendors`),
      orderBy("createdAt", "desc")
    );
  }, [db, tenantId]);

  const { data: vendors = [], isLoading: loading } = useFirestoreQuery<Vendor>({
    queryKey: qk,
    collectionRef: vendorsQuery!,
    mapDoc: (snap) => mapDocToVendor(snap.id, snap.data() || {}),
    enabled: !!tenantId && !!vendorsQuery,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  const addVendor = useCallback(
    async (data: VendorInput): Promise<string | null> => {
      if (!tenantId) return null;
      try {
        const ref = await addDoc(collection(db, `tenants/${tenantId}/vendors`), {
          tenantId,
          name: data.name,
          category: data.category,
          phone: data.phone,
          email: data.email,
          gstNumber: data.gstNumber || null,
          address: data.address || null,
          creditDays: data.creditDays,
          totalBilled: 0,
          totalPaid: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        invalidate();
        return ref.id;
      } catch (err) {
        console.error("Error adding vendor:", err);
        return null;
      }
    },
    [tenantId, db, invalidate]
  );

  const updateVendor = useCallback(
    async (vendorId: string, updates: Partial<VendorInput>): Promise<boolean> => {
      if (!tenantId) return false;
      try {
        await updateDoc(doc(db, `tenants/${tenantId}/vendors`, vendorId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        invalidate();
        return true;
      } catch (err) {
        console.error("Error updating vendor:", err);
        return false;
      }
    },
    [tenantId, db, invalidate]
  );

  const deleteVendor = useCallback(
    async (vendorId: string): Promise<boolean> => {
      if (!tenantId) return false;
      try {
        await deleteDoc(doc(db, `tenants/${tenantId}/vendors`, vendorId));
        invalidate();
        return true;
      } catch (err) {
        console.error("Error deleting vendor:", err);
        return false;
      }
    },
    [tenantId, db, invalidate]
  );

  const payBill = useCallback(
    async (
      billId: string,
      payment: {
        amount: number;
        paidOn: Date;
        method: VendorPayment["method"];
        reference?: string;
        createdBy?: string;
      }
    ): Promise<boolean> => {
      if (!tenantId) return false;
      try {
        await addPaymentToVendorBill(tenantId, billId, payment);
        invalidate();
        return true;
      } catch (err) {
        console.error("Error paying vendor bill:", err);
        return false;
      }
    },
    [tenantId, invalidate]
  );

  return { vendors, loading, addVendor, updateVendor, deleteVendor, payBill };
}
