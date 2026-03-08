"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDb } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestoreQuery } from "@/lib/firestoreQuery";
import { uploadImage } from "@/lib/storageHelpers";

export type ProjectFileType =
  | "floor_plan"
  | "render_3d"
  | "mood_board"
  | "material_board"
  | "drawing"
  | "site_photo"
  | "document"
  | "other";

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type: ProjectFileType;
  phase?: string;
  size?: number;
  uploadedBy: string;
  visibleToClient: boolean;
  notes?: string;
  createdAt: any;
}

export function useProjectFiles(
  tenantId: string | null,
  projectId: string | null
) {
  const queryClient = useQueryClient();
  const qk = ["project-files", tenantId, projectId] as const;
  const db = getDb();
  const [uploading, setUploading] = useState(false);

  const filesQuery = useMemo(() => {
    if (!tenantId || !projectId) return null;
    return query(
      collection(db, `tenants/${tenantId}/projects/${projectId}/files`),
      orderBy("createdAt", "desc")
    );
  }, [db, tenantId, projectId]);

  const { data: files = [], isLoading: loading } = useFirestoreQuery<ProjectFile>({
    queryKey: qk,
    collectionRef: filesQuery!,
    mapDoc: (snap) => {
      const data = snap.data() || {};
      return {
        id: snap.id,
        projectId: data.projectId ?? projectId ?? "",
        name: data.name ?? "",
        url: data.url ?? "",
        type: data.type ?? "other",
        phase: data.phase ?? undefined,
        size: data.size ?? undefined,
        uploadedBy: data.uploadedBy ?? "",
        visibleToClient: data.visibleToClient ?? false,
        notes: data.notes ?? undefined,
        createdAt: data.createdAt,
      };
    },
    enabled: !!tenantId && !!projectId && !!filesQuery,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: qk }),
    [queryClient, qk]
  );

  const uploadFile = useCallback(
    async (params: {
      file: File;
      type: ProjectFileType;
      phase?: string;
      visibleToClient?: boolean;
      notes?: string;
      uploadedBy: string;
    }): Promise<boolean> => {
      if (!tenantId || !projectId) return false;
      setUploading(true);
      try {
        const url = await uploadImage(params.file, tenantId, "projects");
        await addDoc(
          collection(db, `tenants/${tenantId}/projects/${projectId}/files`),
          {
            projectId,
            name: params.file.name,
            url,
            type: params.type,
            phase: params.phase ?? null,
            size: params.file.size,
            uploadedBy: params.uploadedBy,
            visibleToClient: params.visibleToClient ?? false,
            notes: params.notes ?? null,
            createdAt: serverTimestamp(),
          }
        );
        invalidate();
        return true;
      } catch (err) {
        console.error("Error uploading project file:", err);
        return false;
      } finally {
        setUploading(false);
      }
    },
    [tenantId, projectId, db, invalidate]
  );

  const toggleClientVisibility = useCallback(
    async (fileId: string, visible: boolean): Promise<boolean> => {
      if (!tenantId || !projectId) return false;
      try {
        await updateDoc(
          doc(db, `tenants/${tenantId}/projects/${projectId}/files`, fileId),
          { visibleToClient: visible }
        );
        invalidate();
        return true;
      } catch (err) {
        console.error("Error toggling file visibility:", err);
        return false;
      }
    },
    [tenantId, projectId, db, invalidate]
  );

  const deleteFile = useCallback(
    async (fileId: string): Promise<boolean> => {
      if (!tenantId || !projectId) return false;
      try {
        await deleteDoc(
          doc(db, `tenants/${tenantId}/projects/${projectId}/files`, fileId)
        );
        invalidate();
        return true;
      } catch (err) {
        console.error("Error deleting project file:", err);
        return false;
      }
    },
    [tenantId, projectId, db, invalidate]
  );

  return { files, loading, uploading, uploadFile, toggleClientVisibility, deleteFile };
}
