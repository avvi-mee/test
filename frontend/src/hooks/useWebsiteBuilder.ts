"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";
import { useRealtimeQuery } from "@/lib/supabaseQuery";
import type {
    BrandConfig,
    ThemeConfig,
    HomePageContent,
    HomeSectionConfig,
    PortfolioProject,
    Testimonial,
    AboutUsContent,
    ContactPageContent,
    HeroSlide,
    Service,
    WhyChooseUsItem,
    TeamMember,
    CustomContentSection,
    CustomPage,
} from "@/types/website";

export const DEFAULT_SECTION_LAYOUT: HomeSectionConfig[] = [
    { id: "hero",           label: "Hero Slider",     enabled: true,  order: 0 },
    { id: "services",       label: "Our Services",    enabled: true,  order: 1 },
    { id: "about",          label: "About Preview",   enabled: true,  order: 2 },
    { id: "portfolio",      label: "Portfolio",        enabled: true,  order: 3 },
    { id: "testimonials",   label: "Testimonials",    enabled: true,  order: 4 },
    { id: "whyChooseUs",    label: "Why Choose Us",   enabled: false, order: 5 },
    { id: "cta",            label: "Call to Action",   enabled: false, order: 6 },
    { id: "customSections", label: "Custom Sections", enabled: true,  order: 7 },
    { id: "contact",        label: "Contact",          enabled: true,  order: 8 },
];

// ============================================
// PAGE CONFIG HELPERS (tenant_page_configs)
// ============================================

async function fetchPageContent<T>(tenantId: string, pageType: string, defaultValue: T): Promise<T> {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("tenant_page_configs")
        .select("content")
        .eq("tenant_id", tenantId)
        .eq("page_type", pageType)
        .maybeSingle();

    if (error) {
        console.error(`Error fetching ${pageType} config:`, error);
        return defaultValue;
    }
    return data?.content ? (data.content as T) : defaultValue;
}

async function savePageContent(tenantId: string, pageType: string, updates: Record<string, any>): Promise<boolean> {
    const supabase = getSupabase();
    const { data: existing } = await supabase
        .from("tenant_page_configs")
        .select("id, content")
        .eq("tenant_id", tenantId)
        .eq("page_type", pageType)
        .maybeSingle();

    const newContent = existing ? { ...existing.content, ...updates } : { ...updates };

    if (existing) {
        const { error } = await supabase
            .from("tenant_page_configs")
            .update({ content: newContent })
            .eq("id", existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from("tenant_page_configs")
            .insert({ tenant_id: tenantId, page_type: pageType, content: newContent });
        if (error) throw error;
    }
    return true;
}

// ============================================
// BRAND HOOK
// ============================================
const DEFAULT_BRAND: BrandConfig = {
    brandName: "",
    headerTitle: "",
    phone: "",
    email: "",
    logoUrl: "",
    faviconUrl: "",
};

export function useBrand(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-brand", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: brand = null, isLoading: loading } = useRealtimeQuery<BrandConfig | null>({
        queryKey: qk,
        queryFn: async () => {
            return fetchPageContent<BrandConfig>(tenantId!, "brand", DEFAULT_BRAND);
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveBrand = async (updates: Partial<BrandConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageContent(tenantId, "brand", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving brand:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadBrandImage = async (
        file: File,
        type: "logo" | "favicon"
    ): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", `brand/${type}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            const url = data.url;

            const field = type === "logo" ? "logoUrl" : "faviconUrl";
            await saveBrand({ [field]: url });

            return url;
        } catch (error) {
            console.error("Error uploading brand image:", error);
            return null;
        }
    };

    return { brand, loading, saving, saveBrand, uploadBrandImage };
}

// ============================================
// THEME HOOK
// ============================================
const DEFAULT_THEME: ThemeConfig = {
    primaryColor: "#ea580c",
    secondaryColor: "#1c1917",
    accentColor: "#f59e0b",
    fontStyle: "modern",
    buttonRadius: 8,
    cardShadow: true,
};

export function useTheme(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-theme", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: theme = null, isLoading: loading } = useRealtimeQuery<ThemeConfig | null>({
        queryKey: qk,
        queryFn: async () => {
            return fetchPageContent<ThemeConfig>(tenantId!, "theme", DEFAULT_THEME);
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveTheme = async (updates: Partial<ThemeConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageContent(tenantId, "theme", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving theme:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    return { theme, loading, saving, saveTheme };
}

// ============================================
// HOME PAGE HOOK
// ============================================
const DEFAULT_HOME: HomePageContent = {
    heroSlides: [],
    aboutPreview: {
        title: "",
        description: "",
        imageUrl: "",
    },
    services: [],
    whyChooseUs: [],
    cta: {
        heading: "",
        subheading: "",
        buttonText: "",
        buttonLink: "",
    },
    customSections: [],
};

export function useHomePage(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-home", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: homeContent = null, isLoading: loading } = useRealtimeQuery<HomePageContent | null>({
        queryKey: qk,
        queryFn: async () => {
            return fetchPageContent<HomePageContent>(tenantId!, "home", DEFAULT_HOME);
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveHomeContent = async (
        updates: Partial<HomePageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageContent(tenantId, "home", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving home content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadHomeImage = async (
        file: File,
        section: string
    ): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", `pages/home/${section}`);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading home image:", error);
            return null;
        }
    };

    // Hero Slides
    const addHeroSlide = async (slide: Omit<HeroSlide, "id" | "order">): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const newSlide: HeroSlide = {
            ...slide,
            id: `slide_${Date.now()}`,
            order: slides.length,
            primaryButtonText: slide.primaryButtonText || "Get Estimate",
            primaryButtonLink: slide.primaryButtonLink || "/estimate",
            secondaryButtonText: slide.secondaryButtonText || "Book Consultation",
            secondaryButtonLink: slide.secondaryButtonLink || "/book-consultation",
        };

        return saveHomeContent({
            heroSlides: [...slides, newSlide],
        });
    };

    const updateHeroSlide = async (
        slideId: string,
        updates: Partial<HeroSlide>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const updatedSlides = slides.map((s) =>
            s.id === slideId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ heroSlides: updatedSlides });
    };

    const deleteHeroSlide = async (slideId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const slides = homeContent.heroSlides || [];
        const updatedSlides = slides.filter((s) => s.id !== slideId);
        return saveHomeContent({ heroSlides: updatedSlides });
    };

    const reorderHeroSlides = async (slides: HeroSlide[]): Promise<boolean> => {
        const reorderedSlides = slides.map((slide, index) => ({
            ...slide,
            order: index,
        }));
        return saveHomeContent({ heroSlides: reorderedSlides });
    };

    // Services
    const addService = async (service: Omit<Service, "id" | "order">): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const newService: Service = {
            ...service,
            id: `service_${Date.now()}`,
            order: services.length,
        };

        return saveHomeContent({
            services: [...services, newService],
        });
    };

    const updateService = async (
        serviceId: string,
        updates: Partial<Service>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const updatedServices = services.map((s) =>
            s.id === serviceId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ services: updatedServices });
    };

    const deleteService = async (serviceId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const services = homeContent.services || [];
        const updatedServices = services.filter((s) => s.id !== serviceId);
        return saveHomeContent({ services: updatedServices });
    };

    // Why Choose Us
    const addWhyChooseUs = async (
        item: Omit<WhyChooseUsItem, "id" | "order">
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const newItem: WhyChooseUsItem = {
            ...item,
            id: `why_${Date.now()}`,
            order: items.length,
        };

        return saveHomeContent({
            whyChooseUs: [...items, newItem],
        });
    };

    const updateWhyChooseUs = async (
        itemId: string,
        updates: Partial<WhyChooseUsItem>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const updatedItems = items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
        );

        return saveHomeContent({ whyChooseUs: updatedItems });
    };

    const deleteWhyChooseUs = async (itemId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const items = homeContent.whyChooseUs || [];
        const updatedItems = items.filter((item) => item.id !== itemId);
        return saveHomeContent({ whyChooseUs: updatedItems });
    };

    // Custom Content Sections
    const addCustomSection = async (
        section: Omit<CustomContentSection, "id" | "order">
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const newSection: CustomContentSection = {
            ...section,
            id: `section_${Date.now()}`,
            order: sections.length,
        };

        return saveHomeContent({
            customSections: [...sections, newSection],
        });
    };

    const updateCustomSection = async (
        sectionId: string,
        updates: Partial<CustomContentSection>
    ): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const updatedSections = sections.map((s) =>
            s.id === sectionId ? { ...s, ...updates } : s
        );

        return saveHomeContent({ customSections: updatedSections });
    };

    const deleteCustomSection = async (sectionId: string): Promise<boolean> => {
        if (!homeContent) return false;

        const sections = homeContent.customSections || [];
        const updatedSections = sections.filter((s) => s.id !== sectionId);
        return saveHomeContent({ customSections: updatedSections });
    };

    const getSectionLayout = (): HomeSectionConfig[] => {
        if (homeContent?.sectionLayout && homeContent.sectionLayout.length > 0) {
            return [...homeContent.sectionLayout].sort((a, b) => a.order - b.order);
        }
        return DEFAULT_SECTION_LAYOUT;
    };

    const saveSectionLayout = async (layout: HomeSectionConfig[]): Promise<boolean> => {
        const reindexed = layout.map((section, index) => ({
            ...section,
            order: index,
        }));
        return saveHomeContent({ sectionLayout: reindexed });
    };

    return {
        homeContent,
        loading,
        saving,
        saveHomeContent,
        uploadHomeImage,
        addHeroSlide,
        updateHeroSlide,
        deleteHeroSlide,
        reorderHeroSlides,
        addService,
        updateService,
        deleteService,
        addWhyChooseUs,
        updateWhyChooseUs,
        deleteWhyChooseUs,
        addCustomSection,
        updateCustomSection,
        deleteCustomSection,
        getSectionLayout,
        saveSectionLayout,
    };
}

// ============================================
// CUSTOM PAGES HOOK
// ============================================
const RESERVED_SLUGS = [
    "about", "about-us", "portfolio", "testimonials", "contact",
    "estimate", "book-consultation", "dashboard", "login", "signup",
    "forgot-password", "store", "services", "admin",
];

function mapRowToCustomPage(row: any): CustomPage {
    return {
        id: row.id,
        title: row.title || "",
        slug: row.slug || "",
        heading: row.heading || "",
        description: row.description || "",
        imageUrl: row.image_url || "",
        showInNav: row.show_in_nav ?? false,
        isPublished: row.is_published ?? false,
        order: row.sort_order ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function useCustomPages(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-custom-pages", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: customPages = [], isLoading: loading } = useRealtimeQuery<CustomPage[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("custom_pages")
                .select("*")
                .eq("tenant_id", tenantId!)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching custom pages:", error);
                return [];
            }
            return (data || []).map(mapRowToCustomPage);
        },
        table: "custom_pages",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const generateSlug = (title: string): string => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    };

    const isSlugAvailable = (slug: string, excludeId?: string): boolean => {
        if (RESERVED_SLUGS.includes(slug)) return false;
        return !customPages.some((p) => p.slug === slug && p.id !== excludeId);
    };

    const addCustomPage = async (
        page: Omit<CustomPage, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        if (!isSlugAvailable(page.slug)) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("custom_pages")
                .insert({
                    tenant_id: tenantId,
                    title: page.title,
                    slug: page.slug,
                    heading: page.heading || null,
                    description: page.description || null,
                    image_url: page.imageUrl || null,
                    show_in_nav: page.showInNav ?? false,
                    is_published: page.isPublished ?? false,
                    sort_order: customPages.length,
                });
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateCustomPage = async (
        pageId: string,
        updates: Partial<CustomPage>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        if (updates.slug && !isSlugAvailable(updates.slug, pageId)) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const dbUpdates: Record<string, any> = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
            if (updates.heading !== undefined) dbUpdates.heading = updates.heading;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
            if (updates.showInNav !== undefined) dbUpdates.show_in_nav = updates.showInNav;
            if (updates.isPublished !== undefined) dbUpdates.is_published = updates.isPublished;
            if (updates.order !== undefined) dbUpdates.sort_order = updates.order;

            const { error } = await supabase
                .from("custom_pages")
                .update(dbUpdates)
                .eq("id", pageId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteCustomPage = async (pageId: string): Promise<boolean> => {
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
            console.error("Error deleting custom page:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadCustomPageImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/custom");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading custom page image:", error);
            return null;
        }
    };

    return {
        customPages,
        loading,
        saving,
        generateSlug,
        isSlugAvailable,
        addCustomPage,
        updateCustomPage,
        deleteCustomPage,
        uploadCustomPageImage,
    };
}

// ============================================
// PORTFOLIO HOOK
// ============================================
function mapRowToPortfolio(row: any): PortfolioProject {
    return {
        id: row.id,
        title: row.title || "",
        category: row.category || "residential",
        description: row.description || "",
        beforeImageUrl: row.before_image_url || "",
        afterImageUrl: row.after_image_url || row.image_url || "",
        imageStyle: row.image_style || "single",
        location: row.location || "",
        showOnHomepage: row.show_on_homepage ?? false,
        order: row.sort_order ?? 0,
        createdAt: row.created_at,
    };
}

export function usePortfolio(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-portfolio", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: projects = [], isLoading: loading } = useRealtimeQuery<PortfolioProject[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("portfolio_projects")
                .select("*")
                .eq("tenant_id", tenantId!)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching portfolio:", error);
                return [];
            }
            return (data || []).map(mapRowToPortfolio);
        },
        table: "portfolio_projects",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addProject = async (
        project: Omit<PortfolioProject, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("portfolio_projects")
                .insert({
                    tenant_id: tenantId,
                    title: project.title,
                    category: project.category,
                    description: project.description || null,
                    image_url: project.afterImageUrl || null,
                    before_image_url: project.beforeImageUrl || null,
                    after_image_url: project.afterImageUrl || null,
                    image_style: project.imageStyle || "single",
                    location: project.location || null,
                    show_on_homepage: project.showOnHomepage ?? false,
                    sort_order: projects.length,
                });
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateProject = async (
        projectId: string,
        updates: Partial<PortfolioProject>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const dbUpdates: Record<string, any> = {};
            if (updates.title !== undefined) dbUpdates.title = updates.title;
            if (updates.category !== undefined) dbUpdates.category = updates.category;
            if (updates.description !== undefined) dbUpdates.description = updates.description;
            if (updates.beforeImageUrl !== undefined) dbUpdates.before_image_url = updates.beforeImageUrl;
            if (updates.afterImageUrl !== undefined) {
                dbUpdates.after_image_url = updates.afterImageUrl;
                dbUpdates.image_url = updates.afterImageUrl;
            }
            if (updates.imageStyle !== undefined) dbUpdates.image_style = updates.imageStyle;
            if (updates.location !== undefined) dbUpdates.location = updates.location;
            if (updates.showOnHomepage !== undefined) dbUpdates.show_on_homepage = updates.showOnHomepage;
            if (updates.order !== undefined) dbUpdates.sort_order = updates.order;

            const { error } = await supabase
                .from("portfolio_projects")
                .update(dbUpdates)
                .eq("id", projectId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteProject = async (projectId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("portfolio_projects")
                .delete()
                .eq("id", projectId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting project:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadProjectImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/portfolio");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading project image:", error);
            return null;
        }
    };

    return {
        projects,
        loading,
        saving,
        addProject,
        updateProject,
        deleteProject,
        uploadProjectImage,
    };
}

// ============================================
// TESTIMONIALS HOOK
// ============================================
function mapRowToTestimonial(row: any): Testimonial {
    return {
        id: row.id,
        clientName: row.client_name || "",
        clientTitle: row.client_title || "",
        location: row.location,
        clientImageUrl: row.client_image_url || "",
        reviewText: row.review_text || "",
        rating: row.rating || 5,
        showOnHomepage: row.show_on_homepage ?? false,
        order: row.sort_order ?? 0,
        createdAt: row.created_at,
    };
}

export function useTestimonials(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-testimonials", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: testimonials = [], isLoading: loading } = useRealtimeQuery<Testimonial[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("testimonials")
                .select("*")
                .eq("tenant_id", tenantId!)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching testimonials:", error);
                return [];
            }
            return (data || []).map(mapRowToTestimonial);
        },
        table: "testimonials",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addTestimonial = async (
        testimonial: Omit<Testimonial, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("testimonials")
                .insert({
                    tenant_id: tenantId,
                    client_name: testimonial.clientName,
                    client_title: testimonial.clientTitle || null,
                    location: testimonial.location || null,
                    client_image_url: testimonial.clientImageUrl || null,
                    review_text: testimonial.reviewText,
                    rating: testimonial.rating,
                    show_on_homepage: testimonial.showOnHomepage ?? false,
                    sort_order: testimonials.length,
                });
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateTestimonial = async (
        testimonialId: string,
        updates: Partial<Testimonial>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const dbUpdates: Record<string, any> = {};
            if (updates.clientName !== undefined) dbUpdates.client_name = updates.clientName;
            if (updates.clientTitle !== undefined) dbUpdates.client_title = updates.clientTitle;
            if (updates.location !== undefined) dbUpdates.location = updates.location;
            if (updates.clientImageUrl !== undefined) dbUpdates.client_image_url = updates.clientImageUrl;
            if (updates.reviewText !== undefined) dbUpdates.review_text = updates.reviewText;
            if (updates.rating !== undefined) dbUpdates.rating = updates.rating;
            if (updates.showOnHomepage !== undefined) dbUpdates.show_on_homepage = updates.showOnHomepage;
            if (updates.order !== undefined) dbUpdates.sort_order = updates.order;

            const { error } = await supabase
                .from("testimonials")
                .update(dbUpdates)
                .eq("id", testimonialId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteTestimonial = async (testimonialId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("testimonials")
                .delete()
                .eq("id", testimonialId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting testimonial:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadTestimonialImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/testimonials");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading testimonial image:", error);
            return null;
        }
    };

    return {
        testimonials,
        loading,
        saving,
        addTestimonial,
        updateTestimonial,
        deleteTestimonial,
        uploadTestimonialImage,
    };
}

// ============================================
// ABOUT US HOOK
// ============================================
const DEFAULT_ABOUT: AboutUsContent = {
    mainHeading: "",
    companyStory: "",
    vision: "",
    mission: "",
    founderName: "",
    founderRole: "",
    founderDescription: "",
    founderImageUrl: "",
    founderLinkedinUrl: "",
    founderInstagramUrl: "",
    yearsExperience: 0,
    projectsCompleted: 0,
};

export function useAboutUs(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-about", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: aboutContent = null, isLoading: loading } = useRealtimeQuery<AboutUsContent | null>({
        queryKey: qk,
        queryFn: async () => {
            return fetchPageContent<AboutUsContent>(tenantId!, "about", DEFAULT_ABOUT);
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveAboutContent = async (
        updates: Partial<AboutUsContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageContent(tenantId, "about", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving about content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadAboutImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/about");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading about image:", error);
            return null;
        }
    };

    return {
        aboutContent,
        loading,
        saving,
        saveAboutContent,
        uploadAboutImage,
    };
}

// ============================================
// CONTACT HOOK
// ============================================
const DEFAULT_CONTACT: ContactPageContent = {
    address: "",
    googleMapEmbedLink: "",
    whatsappNumber: "",
    instagramUrl: "",
    facebookUrl: "",
    officeHours: "",
};

export function useContact(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-contact", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: contactContent = null, isLoading: loading } = useRealtimeQuery<ContactPageContent | null>({
        queryKey: qk,
        queryFn: async () => {
            return fetchPageContent<ContactPageContent>(tenantId!, "contact", DEFAULT_CONTACT);
        },
        table: "tenant_page_configs",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const saveContactContent = async (
        updates: Partial<ContactPageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            await savePageContent(tenantId, "contact", updates);
            invalidate();
            return true;
        } catch (error) {
            console.error("Error saving contact content:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        contactContent,
        loading,
        saving,
        saveContactContent,
    };
}

// ============================================
// TEAM MEMBERS HOOK
// ============================================
function mapRowToTeamMember(row: any): TeamMember {
    const social = row.social_links || {};
    return {
        id: row.id,
        name: row.name || "",
        role: row.role || "",
        bio: row.bio || "",
        imageUrl: row.image_url || "",
        linkedinUrl: social.linkedin || "",
        instagramUrl: social.instagram || "",
        order: row.sort_order ?? 0,
        createdAt: row.created_at,
    };
}

export function useTeamMembers(tenantId: string | null) {
    const queryClient = useQueryClient();
    const qk = ["website-builder-team-members", tenantId] as const;
    const [saving, setSaving] = useState(false);

    const { data: teamMembers = [], isLoading: loading } = useRealtimeQuery<TeamMember[]>({
        queryKey: qk,
        queryFn: async () => {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from("team_members")
                .select("*")
                .eq("tenant_id", tenantId!)
                .order("sort_order", { ascending: true });

            if (error) {
                console.error("Error fetching team members:", error);
                return [];
            }
            return (data || []).map(mapRowToTeamMember);
        },
        table: "team_members",
        filter: `tenant_id=eq.${tenantId}`,
        enabled: !!tenantId,
    });

    const invalidate = useCallback(
        () => queryClient.invalidateQueries({ queryKey: qk }),
        [queryClient, qk]
    );

    const addTeamMember = async (
        member: Omit<TeamMember, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const socialLinks: Record<string, string> = {};
            if (member.linkedinUrl) socialLinks.linkedin = member.linkedinUrl;
            if (member.instagramUrl) socialLinks.instagram = member.instagramUrl;

            const { error } = await supabase
                .from("team_members")
                .insert({
                    tenant_id: tenantId,
                    name: member.name,
                    role: member.role || null,
                    bio: member.bio || null,
                    image_url: member.imageUrl || null,
                    social_links: Object.keys(socialLinks).length > 0 ? socialLinks : null,
                    sort_order: teamMembers.length,
                });
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error adding team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const updateTeamMember = async (
        memberId: string,
        updates: Partial<TeamMember>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const dbUpdates: Record<string, any> = {};
            if (updates.name !== undefined) dbUpdates.name = updates.name;
            if (updates.role !== undefined) dbUpdates.role = updates.role;
            if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
            if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
            if (updates.order !== undefined) dbUpdates.sort_order = updates.order;

            if (updates.linkedinUrl !== undefined || updates.instagramUrl !== undefined) {
                // Fetch current social_links to merge
                const { data: current } = await supabase
                    .from("team_members")
                    .select("social_links")
                    .eq("id", memberId)
                    .single();
                const social = { ...(current?.social_links || {}) };
                if (updates.linkedinUrl !== undefined) social.linkedin = updates.linkedinUrl;
                if (updates.instagramUrl !== undefined) social.instagram = updates.instagramUrl;
                dbUpdates.social_links = social;
            }

            const { error } = await supabase
                .from("team_members")
                .update(dbUpdates)
                .eq("id", memberId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error updating team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const deleteTeamMember = async (memberId: string): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const supabase = getSupabase();
            const { error } = await supabase
                .from("team_members")
                .delete()
                .eq("id", memberId);
            if (error) throw error;
            invalidate();
            return true;
        } catch (error) {
            console.error("Error deleting team member:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    const uploadTeamMemberImage = async (file: File): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tenantId", tenantId);
            formData.append("folder", "pages/about/team");

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const data = await response.json();
            return data.url;
        } catch (error) {
            console.error("Error uploading team member image:", error);
            return null;
        }
    };

    return {
        teamMembers,
        loading,
        saving,
        addTeamMember,
        updateTeamMember,
        deleteTeamMember,
        uploadTeamMemberImage,
    };
}
