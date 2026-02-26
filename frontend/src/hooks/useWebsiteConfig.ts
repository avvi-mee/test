"use client";

import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp, collection, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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

export function useWebsiteConfig(tenantId: string | null) {
    const [config, setConfig] = useState<WebsiteConfig>(defaultConfig);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Real-time listener
    useEffect(() => {
        if (!tenantId || !db) {
            if (!db) console.warn("Firestore not initialized. Skipping config listener.");
            setLoading(false);
            return;
        }

        const configRef = doc(db, "tenants", tenantId, "websiteConfig", "settings");

        const unsubscribe = onSnapshot(
            configRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    setConfig({ ...defaultConfig, ...snapshot.data() } as WebsiteConfig);
                } else {
                    setConfig(defaultConfig);
                }
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching website config:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    // Save config
    const saveConfig = async (updates: Partial<WebsiteConfig>) => {
        if (!tenantId) return false;

        setSaving(true);
        try {
            const configRef = doc(db, "tenants", tenantId, "websiteConfig", "settings");
            await setDoc(configRef, {
                ...config,
                ...updates,
                updatedAt: serverTimestamp(),
            }, { merge: true });
            return true;
        } catch (error) {
            console.error("Error saving website config:", error);
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Upload image
    const uploadImage = async (file: File, type: "logo" | "hero"): Promise<string | null> => {
        if (!tenantId) return null;

        try {
            const path = `tenants/${tenantId}/website/${type}_${Date.now()}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

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
    const [config, setConfig] = useState<WebsiteConfig | null>(null);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Resolve slug to tenant ID
    useEffect(() => {
        if (!storeSlug) {
            setLoading(false);
            return;
        }

        let resolved = false;

        // Set a timeout to prevent indefinite loading
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                console.warn(`Timeout resolving tenant: ${storeSlug}. Using defaults.`);
                setConfig(defaultConfig);
                setLoading(false);
            }
        }, 3000); // 3 second timeout

        const resolveTenant = async () => {
            try {
                const { getTenantByStoreId } = await import("@/lib/firestoreHelpers");
                if (!db) {
                    console.warn("Firestore not initialized. Cannot resolve tenant.");
                    setConfig(defaultConfig);
                    setLoading(false);
                    clearTimeout(timeoutId);
                    return;
                }
                const tenant = await getTenantByStoreId(storeSlug.toLowerCase()) || await getTenantByStoreId(storeSlug);
                resolved = true;
                clearTimeout(timeoutId);
                if (tenant) {
                    setTenantId(tenant.id);
                } else {
                    console.warn(`Tenant not found: ${storeSlug}. Using defaults.`);
                    setConfig(defaultConfig);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Error resolving tenant:", error);
                resolved = true;
                clearTimeout(timeoutId);
                setConfig(defaultConfig);
                setLoading(false);
            }
        };

        resolveTenant();

        return () => clearTimeout(timeoutId);
    }, [storeSlug]);

    // Real-time config listener (Merged from brand and theme)
    useEffect(() => {
        if (!tenantId || !db) {
            if (!db && tenantId) console.warn("Firestore not initialized. Skipping public config listener.");
            return;
        }

        let brandData = {};
        let themeData = {};
        let dataLoaded = false;

        const brandRef = doc(db, "tenants", tenantId, "brand", "config");
        const themeRef = doc(db, "tenants", tenantId, "theme", "config");

        const updateConfig = () => {
            dataLoaded = true;
            clearTimeout(timeoutId);
            setConfig({
                ...defaultConfig,
                ...brandData,
                ...themeData,
            } as WebsiteConfig);
            setLoading(false);
        };

        const timeoutId = setTimeout(() => {
            if (!dataLoaded) {
                console.warn(`Timeout fetching config for tenant: ${tenantId}. Using defaults.`);
                setConfig(defaultConfig);
                setLoading(false);
            }
        }, 3000);

        const unsubBrand = onSnapshot(brandRef, (snapshot) => {
            if (snapshot.exists()) {
                brandData = snapshot.data();
            }
            updateConfig();
        });

        const unsubTheme = onSnapshot(themeRef, (snapshot) => {
            if (snapshot.exists()) {
                themeData = snapshot.data();
            }
            updateConfig();
        });

        return () => {
            unsubBrand();
            unsubTheme();
            clearTimeout(timeoutId);
        };
    }, [tenantId]);

    return { config, tenantId, loading };
}

// Public hook - for storefront navigation (reads custom pages)
export function usePublicCustomPages(tenantId: string | null) {
    const [customPages, setCustomPages] = useState<{ title: string; slug: string; order: number }[]>([]);

    useEffect(() => {
        if (!tenantId || !db) return;

        const pagesRef = collection(db, "tenants", tenantId, "pages", "custom", "items");
        const q = query(pagesRef, orderBy("order", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map((d) => d.data() as { title: string; slug: string; order: number; isPublished?: boolean; showInNav?: boolean })
                .filter((p) => p.isPublished && p.showInNav);
            setCustomPages(data);
        });

        return () => unsubscribe();
    }, [tenantId]);

    return { customPages };
}
