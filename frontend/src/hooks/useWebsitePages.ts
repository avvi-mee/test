"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface PageSection {
    id: string;
    type: "text" | "image" | "gallery" | "cta";
    content: string;
    imageUrl?: string;
    imageUrls?: string[];
    buttonText?: string;
    buttonLink?: string;
    order: number;
}

export interface WebsitePage {
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
    order: number;
    sections: PageSection[];
    createdAt?: any;
    updatedAt?: any;
}

export function useWebsitePages(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-pages", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: pages = [], isLoading: loading } = useRealtimeQuery<WebsitePage[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("custom_pages")
                .select("*")
                .eq("tenant_id", tenantId!)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching pages:", error);
                return [];
            }

            return (data ?? []).map((row: any): WebsitePage => ({
                id: row.id,
                slug: row.slug ?? "",
                title: row.title ?? "",
                isPublished: row.is_published ?? false,
                order: row.sort_order ?? 0,
                sections: row.sections ?? [],
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            }));
        },
        table: "custom_pages",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Create a new page
    const createPage = async (title: string, slug: string): Promise<string | null> => {
        if (!tenantId) return null;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("custom_pages")
                .insert({
                    tenant_id: tenantId,
                    title,
                    slug: slug.toLowerCase().replace(/\s+/g, "-"),
                    is_published: false,
                    sort_order: pages.length,
                    sections: [],
                })
                .select("id")
                .single();

            if (error) throw error;
            invalidate();
            return data.id;
        } catch (error) {
            console.error("Error creating page:", error);
            return null;
        } finally {
            setSaving(false);
        }
    };

    // Update a page
    const updatePage = async (pageId: string, updates: Partial<WebsitePage>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const dbUpdates: Record<string, any> = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
            if (updates.isPublished !== undefined) dbUpdates.is_published = updates.isPublished;
            if (updates.order !== undefined) dbUpdates.sort_order = updates.order;
            if (updates.sections !== undefined) dbUpdates.sections = updates.sections;

            const { error } = await supabase
                .from("custom_pages")
                .update(dbUpdates)
                .eq("id", pageId);

            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Delete a page
    const deletePage = async (pageId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("custom_pages")
                .delete()
                .eq("id", pageId);

            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Toggle page publish status
    const togglePublish = async (pageId: string, isPublished: boolean): Promise<boolean> => {
        return updatePage(pageId, { isPublished });
    };

    // Add section to page
    const addSection = async (
        pageId: string,
        type: PageSection["type"],
        content: string = ""
    ): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const newSection: PageSection = {
            id: `section_${Date.now()}`,
            type,
            content,
            order: page.sections.length,
        };

        return updatePage(pageId, {
            sections: [...page.sections, newSection],
        });
    };

    // Update section
    const updateSection = async (
        pageId: string,
        sectionId: string,
        updates: Partial<PageSection>
    ): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const updatedSections = page.sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates } : s
        );

        return updatePage(pageId, { sections: updatedSections });
    };

    // Delete section
    const deleteSection = async (pageId: string, sectionId: string): Promise<boolean> => {
        const page = pages.find((p) => p.id === pageId);
        if (!page) return false;

        const updatedSections = page.sections.filter((s) => s.id !== sectionId);
        return updatePage(pageId, { sections: updatedSections });
    };

    // Reorder pages
    const reorderPages = async (reorderedPages: WebsitePage[]): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            await Promise.all(
                reorderedPages.map((page, index) =>
                    supabase
                        .from("custom_pages")
                        .update({ sort_order: index })
                        .eq("id", page.id)
                )
            );
            invalidate();
            return true;
        } catch (error) {
            console.error("Error reordering pages:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Upload image for section (uses Supabase Storage)
    const uploadSectionImage = async (file: File, pageId: string): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const supabase = getSupabase();
            const path = `tenants/${tenantId}/pages/${pageId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from("tenant-assets")
                .upload(path, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from("tenant-assets")
                .getPublicUrl(path);

            return urlData.publicUrl;
        } catch (error) {
            console.error("Error uploading section image:", error);
            return null;
        }
    };

    // Get published pages only (for public website)
    const publishedPages = useMemo(() => pages.filter((p) => p.isPublished), [pages]);

    return {
        pages,
        publishedPages,
        loading,
        saving,
        createPage,
        updatePage,
        deletePage,
        togglePublish,
        addSection,
        updateSection,
        deleteSection,
        reorderPages,
        uploadSectionImage,
    };
}
