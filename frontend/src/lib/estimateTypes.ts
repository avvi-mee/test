export interface ItemQuantity {
    [itemId: string]: number;
}

export interface BedroomConfig {
    items: ItemQuantity;
}

export interface BathroomConfig {
    items: ItemQuantity;
}

export interface EstimateDraft {
    segment: 'Residential' | 'Commercial';
    plan: 'Basic' | 'Standard' | 'Luxe';
    carpetArea: number;
    bedroomCount: number;
    bathroomCount: number;
    cabinCount: number;
    livingAreaItems: ItemQuantity;
    kitchenLayout: string;
    kitchenMaterial: string;
    kitchenItems: ItemQuantity;
    bedrooms: BedroomConfig[];
    bathrooms: BathroomConfig[];
    cabins: BedroomConfig[];
    tenantId: string;       // Firestore document ID of the tenant
    tenantSlug: string;     // URL slug (storeId)
    savedAt: number;        // Date.now() timestamp
}

function getKey(tenantSlug: string) {
    return `estimate_draft_${tenantSlug}`;
}

export function saveEstimateDraft(tenantSlug: string, draft: EstimateDraft): void {
    try {
        localStorage.setItem(getKey(tenantSlug), JSON.stringify(draft));
    } catch (e) {
        console.error("Failed to save estimate draft:", e);
    }
}

export function getEstimateDraft(tenantSlug: string): EstimateDraft | null {
    try {
        const raw = localStorage.getItem(getKey(tenantSlug));
        if (!raw) return null;
        return JSON.parse(raw) as EstimateDraft;
    } catch (e) {
        console.error("Failed to read estimate draft:", e);
        return null;
    }
}

export function clearEstimateDraft(tenantSlug: string): void {
    try {
        localStorage.removeItem(getKey(tenantSlug));
    } catch (e) {
        console.error("Failed to clear estimate draft:", e);
    }
}
