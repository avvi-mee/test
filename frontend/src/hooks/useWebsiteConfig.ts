"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";

export interface WebsiteConfig {
    brandName: string;
    headerTitle: string;
    phone: string;
    email: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl: string;
    faviconUrl: string;
    heroImageUrl: string;
    heroHeading: string;
    heroSubheading: string;
    footerText: string;
    accentColor?: string;
    buttonRadius?: number;
    backgroundColor?: string;
    fontStyle?: "modern" | "elegant" | "minimal";
    updatedAt?: any;
}

const defaultConfig: WebsiteConfig = {
    brandName: "",
    headerTitle: "",
    phone: "",
    email: "",
    primaryColor: "#ea580c",
    secondaryColor: "#1c1917",
    logoUrl: "",
    faviconUrl: "",
    heroImageUrl: "",
    heroHeading: "Design your dream home with perfection.",
    heroSubheading: "From modular kitchens to complete home renovations, we bring luxury and functionality together.",
    footerText: "Transforming spaces into dreams.",
    backgroundColor: "#ffffff",
};

// Helper: map DB row (tenant_page_configs content) to WebsiteConfig
function rowToConfig(content: any): WebsiteConfig {
    if (!content) return defaultConfig;
    return {
        ...defaultConfig,
        brandName: content.brandName ?? content.brand_name ?? defaultConfig.brandName,
        headerTitle: content.headerTitle ?? content.header_title ?? defaultConfig.headerTitle,
        phone: content.phone ?? defaultConfig.phone,
        email: content.email ?? defaultConfig.email,
        primaryColor: content.primaryColor ?? content.primary_color ?? defaultConfig.primaryColor,
        secondaryColor: content.secondaryColor ?? content.secondary_color ?? defaultConfig.secondaryColor,
        logoUrl: content.logoUrl ?? content.logo_url ?? defaultConfig.logoUrl,
        faviconUrl: content.faviconUrl ?? content.favicon_url ?? defaultConfig.faviconUrl,
        heroImageUrl: content.heroImageUrl ?? content.hero_image_url ?? defaultConfig.heroImageUrl,
        heroHeading: content.heroHeading ?? content.hero_heading ?? defaultConfig.heroHeading,
        heroSubheading: content.heroSubheading ?? content.hero_subheading ?? defaultConfig.heroSubheading,
        footerText: content.footerText ?? content.footer_text ?? defaultConfig.footerText,
        accentColor: content.accentColor ?? content.accent_color ?? undefined,
        buttonRadius: content.buttonRadius ?? content.button_radius ?? undefined,
        backgroundColor: content.backgroundColor ?? content.background_color ?? defaultConfig.backgroundColor,
        fontStyle: content.fontStyle ?? content.font_style ?? undefined,
        updatedAt: content.updatedAt ?? content.updated_at ?? undefined,
    };
}

export function useWebsiteConfig(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-config", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: config = defaultConfig, isLoading: loading } = useRealtimeQuery<WebsiteConfig>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("tenant_page_configs")
                .select("content")
                .eq("tenant_id", tenantId!)
                .eq("page_type", "website_config")
                .maybeSingle();

            if (error) {
                console.error("Error fetching website config:", error);
                return defaultConfig;
            }

            if (data && data.content) {
                return rowToConfig(data.content);
            }
            return defaultConfig;
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    // Save config
    const saveConfig = async (updates: Partial<WebsiteConfig>) => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const mergedContent = { ...config, ...updates };

            const { error } = await supabase
                .from("tenant_page_configs")
                .upsert(
                    {
                        tenant_id: tenantId,
                        page_type: "website_config",
                        content: mergedContent,
                    },
                    { onConflict: "tenant_id,page_type" }
                );

            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving website config:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Upload image (uses Supabase Storage)
    const uploadImage = async (file: File, type: "logo" | "hero"): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const supabase = getSupabase();
            const path = `tenants/${tenantId}/website/${type}_${Date.now()}`;

            const { error: uploadError } = await supabase.storage
                .from("tenant-assets")
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from("tenant-assets")
                .getPublicUrl(path);

            const url = urlData.publicUrl;

            // Auto-save URL
            const field = type === "logo" ? "logoUrl" : "heroImageUrl";
            await saveConfig({ [field]: url });

            return url;
        } catch (error) {
            console.error("Error uploading image:", error);
            return null;
        }
    };

    return {
        config,
        loading,
        saving,
        saveConfig,
        uploadImage,
    };
}

// Public hook - for storefront (no auth required)
export function usePublicWebsiteConfig(storeSlug: string) {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [resolving, setResolving] = useState(true);

    // Resolve slug to tenant ID
    useEffect(() => {
        if (!storeSlug) {
            setResolving(false);
            return;
        }

        let cancelled = false;

        const timeoutId = setTimeout(() => {
            if (!cancelled) {
                console.warn(`Timeout resolving tenant: ${storeSlug}. Using defaults.`);
                setResolving(false);
            }
        }, 3000);

        const resolveTenant = async () => {
            try {
                const { getTenantBySlug } = await import("@/lib/firestoreHelpers");
                const tenant = await getTenantBySlug(storeSlug.toLowerCase()) || await getTenantBySlug(storeSlug);
                if (cancelled) return;
                clearTimeout(timeoutId);
                if (tenant) {
                    setTenantId(tenant.id);
                } else {
                    console.warn(`Tenant not found: ${storeSlug}. Using defaults.`);
                }
                setResolving(false);
            } catch (error) {
                console.error("Error resolving tenant:", error);
                if (!cancelled) {
                    clearTimeout(timeoutId);
                    setResolving(false);
                }
            }
        };

        resolveTenant();

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [storeSlug]);

    const qk = ["public-website-config", tenantId] as const;

    const { data: config = null, isLoading: queryLoading } = useRealtimeQuery<WebsiteConfig>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();

            // Fetch brand and theme configs in parallel
            const [brandRes, themeRes, configRes] = await Promise.all([
                supabase
                    .from("tenant_page_configs")
                    .select("content")
                    .eq("tenant_id", tenantId!)
                    .eq("page_type", "brand")
                    .maybeSingle(),
                supabase
                    .from("tenant_page_configs")
                    .select("content")
                    .eq("tenant_id", tenantId!)
                    .eq("page_type", "theme")
                    .maybeSingle(),
                supabase
                    .from("tenant_page_configs")
                    .select("content")
                    .eq("tenant_id", tenantId!)
                    .eq("page_type", "website_config")
                    .maybeSingle(),
            ]);

            const brandData = brandRes.data?.content || {};
            const themeData = themeRes.data?.content || {};
            const configData = configRes.data?.content || {};

            return {
                ...defaultConfig,
                ...brandData,
                ...themeData,
                ...configData,
            } as WebsiteConfig;
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const loading = resolving || queryLoading;

    return { config: config ?? defaultConfig, tenantId, loading };
}

// Public hook - for storefront navigation (reads custom pages)
export function usePublicCustomPages(tenantId: string | null) {
    const qk = ["public-custom-pages", tenantId] as const;

    const { data: customPages = [] } = useRealtimeQuery<{ title: string; slug: string; order: number }[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("custom_pages")
                .select("title, slug, sort_order, is_published")
                .eq("tenant_id", tenantId!)
                .eq("is_published", true)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching custom pages:", error);
                return [];
            }

            return (data ?? []).map((row: any) => ({
                title: row.title,
                slug: row.slug,
                order: row.sort_order ?? 0,
            }));
        },
        table: "custom_pages",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    return { customPages };
}
