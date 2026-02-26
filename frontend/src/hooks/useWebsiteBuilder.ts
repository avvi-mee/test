"use client";

import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import {
    doc,
    collection,
    onSnapshot,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    query,
    orderBy,
    getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type {
    BrandConfig,
    ThemeConfig,
    HomePageContent,
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

// ============================================
// BRAND HOOK
// ============================================
export function useBrand(tenantId: string | null) {
    const [brand, setBrand] = useState<BrandConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const brandRef = doc(db, "tenants", tenantId, "brand", "config");
        const unsubscribe = onSnapshot(
            brandRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setBrand(snapshot.data() as BrandConfig);
                } else {
                    setBrand({
                        brandName: "",
                        headerTitle: "",
                        phone: "",
                        email: "",
                        logoUrl: "",
                        faviconUrl: "",
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching brand:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const saveBrand = async (updates: Partial<BrandConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const brandRef = doc(db, "tenants", tenantId, "brand", "config");
            await setDoc(
                brandRef,
                {
                    ...updates,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
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
export function useTheme(tenantId: string | null) {
    const [theme, setTheme] = useState<ThemeConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const themeRef = doc(db, "tenants", tenantId, "theme", "config");
        const unsubscribe = onSnapshot(
            themeRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setTheme(snapshot.data() as ThemeConfig);
                } else {
                    setTheme({
                        primaryColor: "#ea580c",
                        secondaryColor: "#1c1917",
                        accentColor: "#f59e0b",
                        fontStyle: "modern",
                        buttonRadius: 8,
                        cardShadow: true,
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching theme:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const saveTheme = async (updates: Partial<ThemeConfig>): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const themeRef = doc(db, "tenants", tenantId, "theme", "config");
            await setDoc(
                themeRef,
                {
                    ...updates,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
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
export function useHomePage(tenantId: string | null) {
    const [homeContent, setHomeContent] = useState<HomePageContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const homeRef = doc(db, "tenants", tenantId, "pages", "home");
        const unsubscribe = onSnapshot(
            homeRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setHomeContent(snapshot.data() as HomePageContent);
                } else {
                    setHomeContent({
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
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching home content:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const saveHomeContent = async (
        updates: Partial<HomePageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const homeRef = doc(db, "tenants", tenantId, "pages", "home");
            await setDoc(
                homeRef,
                {
                    ...updates,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
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

export function useCustomPages(tenantId: string | null) {
    const [customPages, setCustomPages] = useState<CustomPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const pagesRef = collection(db, "tenants", tenantId, "pages", "custom", "items");
        const q = query(pagesRef, orderBy("order", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const data = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as CustomPage[];
                setCustomPages(data);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching custom pages:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

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
            const pagesRef = collection(db, "tenants", tenantId, "pages", "custom", "items");
            await addDoc(pagesRef, {
                ...page,
                order: customPages.length,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
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
            const pageRef = doc(db, "tenants", tenantId, "pages", "custom", "items", pageId);
            await updateDoc(pageRef, {
                ...updates,
                updatedAt: serverTimestamp(),
            });
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
            const pageRef = doc(db, "tenants", tenantId, "pages", "custom", "items", pageId);
            await deleteDoc(pageRef);
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
export function usePortfolio(tenantId: string | null) {
    const [projects, setProjects] = useState<PortfolioProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const projectsRef = collection(db, "tenants", tenantId, "pages", "portfolio", "projects");
        const q = query(projectsRef, orderBy("order", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const projectsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as PortfolioProject[];
                setProjects(projectsData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching portfolio:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const addProject = async (
        project: Omit<PortfolioProject, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const projectsRef = collection(db, "tenants", tenantId, "pages", "portfolio", "projects");
            await addDoc(projectsRef, {
                ...project,
                order: projects.length,
                createdAt: serverTimestamp(),
            });
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
            const projectRef = doc(db, "tenants", tenantId, "pages", "portfolio", "projects", projectId);
            await updateDoc(projectRef, updates);
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
            const projectRef = doc(db, "tenants", tenantId, "pages", "portfolio", "projects", projectId);
            await deleteDoc(projectRef);
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
export function useTestimonials(tenantId: string | null) {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const testimonialsRef = collection(
            db,
            "tenants",
            tenantId,
            "pages",
            "testimonials",
            "items"
        );
        const q = query(testimonialsRef, orderBy("order", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const testimonialsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Testimonial[];
                setTestimonials(testimonialsData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching testimonials:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const addTestimonial = async (
        testimonial: Omit<Testimonial, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const testimonialsRef = collection(
                db,
                "tenants",
                tenantId,
                "pages",
                "testimonials",
                "items"
            );
            await addDoc(testimonialsRef, {
                ...testimonial,
                order: testimonials.length,
                createdAt: serverTimestamp(),
            });
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
            const testimonialRef = doc(
                db,
                "tenants",
                tenantId,
                "pages",
                "testimonials",
                "items",
                testimonialId
            );
            await updateDoc(testimonialRef, updates);
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
            const testimonialRef = doc(
                db,
                "tenants",
                tenantId,
                "pages",
                "testimonials",
                "items",
                testimonialId
            );
            await deleteDoc(testimonialRef);
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
export function useAboutUs(tenantId: string | null) {
    const [aboutContent, setAboutContent] = useState<AboutUsContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const aboutRef = doc(db, "tenants", tenantId, "pages", "about");
        const unsubscribe = onSnapshot(
            aboutRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setAboutContent(snapshot.data() as AboutUsContent);
                } else {
                    setAboutContent({
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
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching about content:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const saveAboutContent = async (
        updates: Partial<AboutUsContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const aboutRef = doc(db, "tenants", tenantId, "pages", "about");
            await setDoc(
                aboutRef,
                {
                    ...updates,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
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
export function useContact(tenantId: string | null) {
    const [contactContent, setContactContent] = useState<ContactPageContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const contactRef = doc(db, "tenants", tenantId, "pages", "contact");
        const unsubscribe = onSnapshot(
            contactRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setContactContent(snapshot.data() as ContactPageContent);
                } else {
                    setContactContent({
                        address: "",
                        googleMapEmbedLink: "",
                        whatsappNumber: "",
                        instagramUrl: "",
                        facebookUrl: "",
                        officeHours: "",
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching contact content:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const saveContactContent = async (
        updates: Partial<ContactPageContent>
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const contactRef = doc(db, "tenants", tenantId, "pages", "contact");
            await setDoc(
                contactRef,
                {
                    ...updates,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
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
export function useTeamMembers(tenantId: string | null) {
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        const teamRef = collection(db, "tenants", tenantId, "pages", "about", "teamMembers");
        const q = query(teamRef, orderBy("order", "asc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const teamData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as TeamMember[];
                setTeamMembers(teamData);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching team members:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    const addTeamMember = async (
        member: Omit<TeamMember, "id" | "order" | "createdAt">
    ): Promise<boolean> => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const teamRef = collection(db, "tenants", tenantId, "pages", "about", "teamMembers");
            await addDoc(teamRef, {
                ...member,
                order: teamMembers.length,
                createdAt: serverTimestamp(),
            });
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
            const memberRef = doc(
                db,
                "tenants",
                tenantId,
                "pages",
                "about",
                "teamMembers",
                memberId
            );
            await updateDoc(memberRef, updates);
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
            const memberRef = doc(
                db,
                "tenants",
                tenantId,
                "pages",
                "about",
                "teamMembers",
                memberId
            );
            await deleteDoc(memberRef);
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
